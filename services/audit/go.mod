module github.com/garudex-labs/caracal/audit

go 1.26

require (
	github.com/garudex-labs/caracal/shared v0.0.0
	github.com/aws/aws-sdk-go-v2 v1.36.0
	github.com/aws/aws-sdk-go-v2/config v1.29.14
	github.com/aws/aws-sdk-go-v2/service/s3 v1.79.1
	github.com/jackc/pgx/v5 v5.7.4
	github.com/parquet-go/parquet-go v0.23.0
	github.com/redis/go-redis/v9 v9.7.3
	github.com/rs/zerolog v1.33.0
)

replace github.com/garudex-labs/caracal/shared => ../../packages/shared
