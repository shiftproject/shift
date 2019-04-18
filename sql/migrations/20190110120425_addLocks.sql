/*
 * Create table 'locks'
 */

BEGIN;

CREATE TABLE IF NOT EXISTS "locks"(
  "bytes" BIGINT NOT NULL,
  "transactionId" VARCHAR(20) NOT NULL,
  FOREIGN KEY("transactionId") REFERENCES "trs"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "locksBytes" ON locks("bytes");

COMMIT;
