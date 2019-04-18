/*
 * Create table 'pins'
 */

BEGIN;

CREATE TABLE IF NOT EXISTS "pins"(
  "hash" VARCHAR(60) NOT NULL,
  "bytes" BIGINT NOT NULL,
  "parent" VARCHAR(20) NULL,
  "transactionId" VARCHAR(20) NOT NULL,
  FOREIGN KEY("transactionId") REFERENCES "trs"("id") ON DELETE CASCADE
);

COMMIT;

BEGIN;

CREATE INDEX IF NOT EXISTS "pinsHash" ON pins("hash");

COMMIT;
