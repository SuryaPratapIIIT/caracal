// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Caracal JWT claim shapes and verification configuration.

package identity

// Config configures JWT verification.
type Config struct {
	Issuer         string
	Audience       string
	ZoneID         string
	RequiredScopes []string
}

// Claims is the validated subset of a Caracal JWT payload.
type Claims struct {
	Sub            string
	ZoneID         string
	Sid            string
	Scope          string
	AgentSessionID string
}
