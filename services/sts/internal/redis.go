// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Redis client and stream operations for the STS.

package internal

import (
	"context"
	"encoding/json"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisClient struct{ c *redis.Client }

func newRedis(dsn string) (*RedisClient, error) {
	opts, err := redis.ParseURL(dsn)
	if err != nil {
		return nil, err
	}
	return &RedisClient{c: redis.NewClient(opts)}, nil
}

func (r *RedisClient) XAdd(ctx context.Context, stream string, values map[string]interface{}) error {
	return r.c.XAdd(ctx, &redis.XAddArgs{
		Stream: stream,
		Values: values,
	}).Err()
}

func (r *RedisClient) XReadGroup(ctx context.Context, group, consumer, stream string, count int64) ([]redis.XMessage, error) {
	streams, err := r.c.XReadGroup(ctx, &redis.XReadGroupArgs{
		Group:    group,
		Consumer: consumer,
		Streams:  []string{stream, ">"},
		Count:    count,
		Block:    0,
	}).Result()
	if err != nil {
		return nil, err
	}
	if len(streams) == 0 {
		return nil, nil
	}
	return streams[0].Messages, nil
}

func (r *RedisClient) XAutoClaim(ctx context.Context, group, consumer, stream, start string, minIdle time.Duration, count int64) ([]redis.XMessage, string, error) {
	msgs, next, err := r.c.XAutoClaim(ctx, &redis.XAutoClaimArgs{
		Stream:   stream,
		Group:    group,
		Consumer: consumer,
		MinIdle:  minIdle,
		Start:    start,
		Count:    count,
	}).Result()
	return msgs, next, err
}

func (r *RedisClient) XAck(ctx context.Context, stream, group, id string) error {
	return r.c.XAck(ctx, stream, group, id).Err()
}

func (r *RedisClient) SetTTL(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	b, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return r.c.SetEx(ctx, key, string(b), ttl).Err()
}

func (r *RedisClient) Get(ctx context.Context, key string) (string, error) {
	return r.c.Get(ctx, key).Result()
}

func (r *RedisClient) Del(ctx context.Context, key string) error {
	return r.c.Del(ctx, key).Err()
}

func (r *RedisClient) Exists(ctx context.Context, key string) (bool, error) {
	n, err := r.c.Exists(ctx, key).Result()
	return n > 0, err
}

// IncrWithExpiry atomically increments key and sets TTL on first increment (fixed-window counter).
func (r *RedisClient) IncrWithExpiry(ctx context.Context, key string, ttl time.Duration) (int64, error) {
	script := `local c = redis.call('INCR', KEYS[1])
if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return c`
	return r.c.Eval(ctx, script, []string{key}, int(ttl.Seconds())).Int64()
}

// EnsureGroup creates a Redis consumer group (MKSTREAM) if it does not exist.
func (r *RedisClient) EnsureGroup(ctx context.Context, stream, group string) error {
	err := r.c.XGroupCreateMkStream(ctx, stream, group, "$").Err()
	if err != nil && err.Error() == "BUSYGROUP Consumer Group name already exists" {
		return nil
	}
	return err
}
