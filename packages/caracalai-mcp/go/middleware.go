// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// net/http middleware that validates Caracal JWTs at every MCP tool boundary.

package mcp

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/garudex-labs/caracal/identity"
)

// Options configures the auth middleware.
type Options struct {
	Issuer         string
	Audience       string
	ZoneID         string
	RequiredScopes []string
}

type errBody struct {
	Error            string `json:"error"`
	ErrorDescription string `json:"error_description"`
}

// Middleware returns a net/http middleware that validates Caracal JWTs.
func Middleware(opts Options) func(http.Handler) http.Handler {
	cfg := identity.Config{
		Issuer:         opts.Issuer,
		Audience:       opts.Audience,
		ZoneID:         opts.ZoneID,
		RequiredScopes: opts.RequiredScopes,
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token, ok := extractBearer(r)
			if !ok {
				writeErr(w, http.StatusUnauthorized, "invalid_token", "Missing bearer token")
				return
			}

			_, err := identity.Verify(token, cfg)
			if err != nil {
				var scopeErr *identity.ScopeMissingError
				switch {
				case errors.As(err, &scopeErr):
					writeErr(w, http.StatusForbidden, "insufficient_scope", "Missing scope: "+scopeErr.Scope)
				case errors.Is(err, identity.ErrZoneInvalid):
					writeErr(w, http.StatusUnauthorized, "invalid_token", "Token zone validation failed")
				default:
					writeErr(w, http.StatusUnauthorized, "invalid_token", "Token validation failed")
				}
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func extractBearer(r *http.Request) (string, bool) {
	auth := r.Header.Get("Authorization")
	if !strings.HasPrefix(auth, "Bearer ") {
		return "", false
	}
	token := strings.TrimSpace(strings.TrimPrefix(auth, "Bearer "))
	if token == "" {
		return "", false
	}
	return token, true
}

func writeErr(w http.ResponseWriter, status int, code, desc string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(errBody{Error: code, ErrorDescription: desc}); err != nil {
		log.Printf("caracalai-mcp: failed to encode error response: %v", err)
	}
}
