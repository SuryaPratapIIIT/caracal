// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// STS service entry point.

package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/garudex-labs/caracal/core/logging"
	"github.com/garudex-labs/caracal/sts/internal"
)

func main() {
	log := logging.New("sts")
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	srv, err := internal.New(ctx)
	if err != nil {
		log.Fatal().Err(err).Msg("init failed")
	}

	if err := srv.Run(ctx); err != nil {
		log.Fatal().Err(err).Msg("run failed")
	}
}
