-- Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
-- Caracal, a product of Garudex Labs
--
-- Gateway resource→client_id bindings: exchange-as-application identity per protected resource.

CREATE TABLE gateway_resource_bindings (
    resource_identifier TEXT PRIMARY KEY,
    client_id           TEXT NOT NULL,
    zone_id             TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON gateway_resource_bindings(zone_id);
