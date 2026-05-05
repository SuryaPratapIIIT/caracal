// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// OPA policy engine: compiles per-zone policy bundles and evaluates them.

package internal

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/open-policy-agent/opa/rego"
)

const pgPollInterval = 60 * time.Second

// opaZoneState holds a compiled query and the manifest SHA that produced it.
type opaZoneState struct {
	query       *rego.PreparedEvalQuery
	manifestSHA string
}

// OPAEngine maintains one compiled policy per zone, swapped atomically on invalidation.
type OPAEngine struct {
	mu      sync.RWMutex
	zones   map[string]*opaZoneState
	db      DBQuerier
	metrics OPAMetrics
}

type OPAMetrics struct {
	EvalTotal     atomic.Uint64
	EvalErrors    atomic.Uint64
	EvalNanos     atomic.Uint64
	CompileTotal  atomic.Uint64
	CompileErrors atomic.Uint64
	CompileNanos  atomic.Uint64
}

type OPAMetricsSnapshot struct {
	EvalTotal         uint64 `json:"eval_total"`
	EvalErrors        uint64 `json:"eval_errors"`
	EvalDurationNs    uint64 `json:"eval_duration_ns"`
	CompileTotal      uint64 `json:"compile_total"`
	CompileErrors     uint64 `json:"compile_errors"`
	CompileDurationNs uint64 `json:"compile_duration_ns"`
}

func newOPAEngine(db DBQuerier) *OPAEngine {
	return &OPAEngine{
		zones: make(map[string]*opaZoneState),
		db:    db,
	}
}

// Evaluate evaluates the active policy for the zone in input.Principal.ZoneID.
// Partial evaluation status always results in deny.
func (e *OPAEngine) Evaluate(ctx context.Context, input OPAInput) (*OPAResult, error) {
	started := time.Now()
	e.metrics.EvalTotal.Add(1)
	defer func() { e.metrics.EvalNanos.Add(uint64(time.Since(started).Nanoseconds())) }()
	e.mu.RLock()
	state, ok := e.zones[input.Principal.ZoneID]
	e.mu.RUnlock()

	if !ok {
		if err := e.loadZone(ctx, input.Principal.ZoneID); err != nil {
			e.metrics.EvalErrors.Add(1)
			return nil, fmt.Errorf("load policy for zone %s: %w", input.Principal.ZoneID, err)
		}
		e.mu.RLock()
		state = e.zones[input.Principal.ZoneID]
		e.mu.RUnlock()
	}

	rs, err := state.query.Eval(ctx, rego.EvalInput(input))
	if err != nil {
		e.metrics.EvalErrors.Add(1)
		return nil, fmt.Errorf("opa eval: %w", err)
	}

	if len(rs) == 0 || len(rs[0].Bindings) == 0 {
		return &OPAResult{Decision: "deny", EvaluationStatus: "complete"}, nil
	}

	raw, err := json.Marshal(rs[0].Bindings["result"])
	if err != nil {
		e.metrics.EvalErrors.Add(1)
		return nil, fmt.Errorf("marshal opa result: %w", err)
	}
	var result OPAResult
	if err := json.Unmarshal(raw, &result); err != nil {
		e.metrics.EvalErrors.Add(1)
		return nil, fmt.Errorf("unmarshal opa result: %w", err)
	}
	return &result, nil
}

func (e *OPAEngine) Metrics() OPAMetricsSnapshot {
	return OPAMetricsSnapshot{
		EvalTotal:         e.metrics.EvalTotal.Load(),
		EvalErrors:        e.metrics.EvalErrors.Load(),
		EvalDurationNs:    e.metrics.EvalNanos.Load(),
		CompileTotal:      e.metrics.CompileTotal.Load(),
		CompileErrors:     e.metrics.CompileErrors.Load(),
		CompileDurationNs: e.metrics.CompileNanos.Load(),
	}
}

// Reload replaces the compiled policy for zoneID with the current active bundle.
func (e *OPAEngine) Reload(ctx context.Context, zoneID string) error {
	return e.loadZone(ctx, zoneID)
}

// StartPGPolling polls PostgreSQL every 60 seconds for policy changes on all known zones.
// This ensures the OPA engine stays current when Redis invalidation events are missed.
func (e *OPAEngine) StartPGPolling(ctx context.Context) {
	ticker := time.NewTicker(pgPollInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			e.mu.RLock()
			zones := make([]string, 0, len(e.zones))
			for id := range e.zones {
				zones = append(zones, id)
			}
			e.mu.RUnlock()
			for _, zoneID := range zones {
				_ = e.loadZone(ctx, zoneID)
			}
		case <-ctx.Done():
			return
		}
	}
}

func (e *OPAEngine) loadZone(ctx context.Context, zoneID string) error {
	binding, err := e.db.GetActivePolicySetBinding(ctx, zoneID)
	if err != nil || binding.ActiveVersionID == nil {
		// No active policy set: install a deny-all fallback.
		e.storeFallback(zoneID)
		return nil
	}

	psv, err := e.db.GetPolicySetVersion(ctx, *binding.ActiveVersionID)
	if err != nil {
		return err
	}

	e.mu.RLock()
	if cur, ok := e.zones[zoneID]; ok && cur.manifestSHA == psv.ManifestSHA256 {
		e.mu.RUnlock()
		return nil
	}
	e.mu.RUnlock()

	var manifest []struct {
		PolicyVersionID string `json:"policy_version_id"`
	}
	if err := json.Unmarshal(psv.ManifestJSON, &manifest); err != nil {
		return err
	}

	ids := make([]string, len(manifest))
	for i, m := range manifest {
		ids[i] = m.PolicyVersionID
	}
	versions, err := e.db.GetPolicyVersionsByIDs(ctx, ids)
	if err != nil {
		return err
	}

	modules := make([]func(*rego.Rego), 0, len(versions))
	for _, v := range versions {
		modules = append(modules, rego.Module(v.ID+".rego", v.Content))
	}
	modules = append(modules, rego.Query("result = data.caracal.authz.result"))

	started := time.Now()
	e.metrics.CompileTotal.Add(1)
	pq, err := rego.New(modules...).PrepareForEval(ctx)
	e.metrics.CompileNanos.Add(uint64(time.Since(started).Nanoseconds()))
	if err != nil {
		e.metrics.CompileErrors.Add(1)
		return fmt.Errorf("compile policy bundle for zone %s: %w", zoneID, err)
	}

	e.mu.Lock()
	e.zones[zoneID] = &opaZoneState{query: &pq, manifestSHA: psv.ManifestSHA256}
	e.mu.Unlock()
	return nil
}

// denyAllPolicy is the deny-all fallback when no policy is active.
const denyAllPolicy = `
package caracal.authz
result := {"decision": "deny", "evaluation_status": "complete", "determining_policies": [], "diagnostics": [{"reason": "no_active_policy_set"}]}
`

func (e *OPAEngine) storeFallback(zoneID string) {
	pq, err := rego.New(
		rego.Module("fallback.rego", denyAllPolicy),
		rego.Query("result = data.caracal.authz.result"),
	).PrepareForEval(context.Background())
	if err != nil {
		return
	}
	e.mu.Lock()
	e.zones[zoneID] = &opaZoneState{query: &pq, manifestSHA: "no_active_policy_set"}
	e.mu.Unlock()
}
