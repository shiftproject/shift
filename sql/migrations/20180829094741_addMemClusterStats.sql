/*
 * Add locked balances to mem_accounts
 */

BEGIN;

CREATE TABLE IF NOT EXISTS "mem_cluster_stats"(
  "id" VARCHAR(22) NOT NULL PRIMARY KEY,
  "total_locked_balance" BIGINT NOT NULL DEFAULT(0),
  "total_locked_bytes" BIGINT NOT NULL DEFAULT(0),
  "latest_cluster_total" BIGINT NOT NULL DEFAULT(0),
  "latest_cluster_used" BIGINT NOT NULL DEFAULT(0),
  "stats_timestamp" INT
);

COMMIT;
