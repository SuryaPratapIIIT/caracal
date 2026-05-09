// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Verifies a Caracal JWT against an issuer JWKS and enforces zone and scope claims.

package identity

import (
	"errors"
	"fmt"

	"github.com/golang-jwt/jwt/v5"
)

// ErrTokenInvalid signals the token failed JWKS-backed signature or claim validation.
var ErrTokenInvalid = errors.New("token validation failed")

// ErrZoneInvalid signals the zone_id claim is missing or did not match Config.ZoneID.
var ErrZoneInvalid = errors.New("token zone validation failed")

// ScopeMissingError signals a required scope is absent from the token.
type ScopeMissingError struct {
	Scope string
}

func (e *ScopeMissingError) Error() string {
	return fmt.Sprintf("missing scope: %s", e.Scope)
}

// Verify parses and validates a JWT, returning typed Claims on success.
func Verify(tokenStr string, cfg Config) (Claims, error) {
	mapClaims := jwt.MapClaims{}
	_, err := jwt.ParseWithClaims(tokenStr, mapClaims, func(t *jwt.Token) (interface{}, error) {
		kid, _ := t.Header["kid"].(string)
		keys, err := GetJWKS(cfg.Issuer)
		if err != nil {
			return nil, err
		}
		if k, ok := keys[kid]; ok {
			return k, nil
		}
		return nil, jwt.ErrTokenSignatureInvalid
	}, jwt.WithIssuer(cfg.Issuer), jwt.WithAudience(cfg.Audience), jwt.WithValidMethods([]string{jwt.SigningMethodES256.Alg()}))
	if err != nil {
		return Claims{}, ErrTokenInvalid
	}

	scope, _ := mapClaims["scope"].(string)
	zoneID, _ := mapClaims["zone_id"].(string)
	if zoneID == "" || (cfg.ZoneID != "" && zoneID != cfg.ZoneID) {
		return Claims{}, ErrZoneInvalid
	}
	for _, required := range cfg.RequiredScopes {
		if !HasScope(scope, required) {
			return Claims{}, &ScopeMissingError{Scope: required}
		}
	}

	sub, _ := mapClaims["sub"].(string)
	sid, _ := mapClaims["sid"].(string)
	agentSessionID, _ := mapClaims["agent_session_id"].(string)
	return Claims{Sub: sub, ZoneID: zoneID, Sid: sid, Scope: scope, AgentSessionID: agentSessionID}, nil
}
