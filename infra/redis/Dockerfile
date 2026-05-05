# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Redis 8 image for the Caracal message bus.

FROM redis:8-alpine

COPY redis.conf /etc/caracal/redis.conf
EXPOSE 6379

ENTRYPOINT ["redis-server", "/etc/caracal/redis.conf"]
