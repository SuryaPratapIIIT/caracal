# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Agent coordinator image; build context must be the caracal/ workspace root.

FROM golang:1.26-alpine AS go-builder
WORKDIR /build
COPY go.work go.work
COPY packages/shared/ packages/shared/
COPY apps/agent-coordinator/relay/ apps/agent-coordinator/relay/
WORKDIR /build/apps/agent-coordinator/relay
RUN go mod download && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -o /relay ./cmd/relay

FROM node:24-alpine AS node-builder
WORKDIR /app
COPY apps/agent-coordinator/package.json .
RUN npm install --omit=dev
COPY apps/agent-coordinator/tsconfig.json .
COPY apps/agent-coordinator/src/ src/
RUN npx tsc --outDir dist

FROM node:24-alpine
WORKDIR /app
COPY --from=go-builder /relay /relay
COPY --from=node-builder /app/dist/ ./dist/
COPY --from=node-builder /app/node_modules/ ./node_modules/
COPY apps/agent-coordinator/start.sh /start.sh
RUN chmod +x /start.sh && chown -R node:node /app /relay /start.sh
USER node
ENTRYPOINT ["/start.sh"]
