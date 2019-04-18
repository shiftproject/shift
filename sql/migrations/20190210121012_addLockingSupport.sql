/*
 * Add locked balances to mem_accounts
 */

BEGIN;

ALTER TABLE "mem_accounts" ADD COLUMN "locked_balance" BIGINT DEFAULT 0;
ALTER TABLE "mem_accounts" ADD COLUMN "u_locked_balance" BIGINT DEFAULT 0;
ALTER TABLE "mem_accounts" ADD COLUMN "locked_bytes" BIGINT DEFAULT 0;
ALTER TABLE "mem_accounts" ADD COLUMN "u_locked_bytes" BIGINT DEFAULT 0;
ALTER TABLE "mem_accounts" ADD COLUMN "pinned_bytes" BIGINT DEFAULT 0;
ALTER TABLE "mem_accounts" ADD COLUMN "u_pinned_bytes" BIGINT DEFAULT 0;

/*
 * Add locked bytes and cluster size to blocks
 */

ALTER TABLE "blocks" ADD COLUMN "lockedBytes" BIGINT DEFAULT 0;
ALTER TABLE "blocks" ADD COLUMN "clusterSize" BIGINT DEFAULT 0;

COMMIT;

BEGIN;

/* Alter view
 * Recreate blocks_list, add lockedBytes and clusterSize
 */

DROP VIEW IF EXISTS blocks_list;

CREATE VIEW blocks_list AS

SELECT b."id" AS "b_id",
       b."version" AS "b_version",
       b."timestamp" AS "b_timestamp",
       b."height" AS "b_height",
       b."previousBlock" AS "b_previousBlock",
       b."numberOfTransactions" AS "b_numberOfTransactions",
       (b."totalAmount")::bigint AS "b_totalAmount",
       (b."totalFee")::bigint AS "b_totalFee",
       (b."reward")::bigint AS "b_reward",
       (b."lockedBytes")::bigint AS "b_lockedBytes",
       (b."clusterSize")::bigint AS "b_clusterSize",
       b."payloadLength" AS "b_payloadLength",
       ENCODE(b."payloadHash", 'hex') AS "b_payloadHash",
       ENCODE(b."generatorPublicKey", 'hex') AS "b_generatorPublicKey",
       ENCODE(b."blockSignature", 'hex') AS "b_blockSignature",
       (SELECT MAX("height") + 1 FROM blocks) - b."height" AS "b_confirmations"

FROM blocks b;

/* Alter view
 * Recreate full_blocks_list, add join for locks and pins tables.
 */

DROP VIEW IF EXISTS full_blocks_list;

CREATE VIEW full_blocks_list AS

SELECT b."id" AS "b_id",
       b."version" AS "b_version",
       b."timestamp" AS "b_timestamp",
       b."height" AS "b_height",
       b."previousBlock" AS "b_previousBlock",
       b."numberOfTransactions" AS "b_numberOfTransactions",
       (b."totalAmount")::bigint AS "b_totalAmount",
       (b."totalFee")::bigint AS "b_totalFee",
       (b."reward")::bigint AS "b_reward",
       (b."lockedBytes")::bigint AS "b_lockedBytes",
       (b."clusterSize")::bigint AS "b_clusterSize",
       b."payloadLength" AS "b_payloadLength",
       ENCODE(b."payloadHash", 'hex') AS "b_payloadHash",
       ENCODE(b."generatorPublicKey", 'hex') AS "b_generatorPublicKey",
       ENCODE(b."blockSignature", 'hex') AS "b_blockSignature",
       t."id" AS "t_id",
       t."rowId" AS "t_rowId",
       t."type" AS "t_type",
       t."timestamp" AS "t_timestamp",
       ENCODE(t."senderPublicKey", 'hex') AS "t_senderPublicKey",
       t."senderId" AS "t_senderId",
       t."recipientId" AS "t_recipientId",
       (t."amount")::bigint AS "t_amount",
       (t."fee")::bigint AS "t_fee",
       ENCODE(t."signature", 'hex') AS "t_signature",
       ENCODE(t."signSignature", 'hex') AS "t_signSignature",
       ENCODE(s."publicKey", 'hex') AS "s_publicKey",
       d."username" AS "d_username",
       v."votes" AS "v_votes",
       m."min" AS "m_min",
       m."lifetime" AS "m_lifetime",
       m."keysgroup" AS "m_keysgroup",
       dapp."name" AS "dapp_name",
       dapp."description" AS "dapp_description",
       dapp."tags" AS "dapp_tags",
       dapp."type" AS "dapp_type",
       dapp."link" AS "dapp_link",
       dapp."category" AS "dapp_category",
       dapp."icon" AS "dapp_icon",
       it."dappId" AS "in_dappId",
       ot."dappId" AS "ot_dappId",
       ot."outTransactionId" AS "ot_outTransactionId",
       (lock."bytes")::bigint AS "l_bytes",
       pin."hash" AS "p_hash",
       (pin."bytes")::bigint AS "p_bytes",
       pin."parent" AS "p_parent",
       ENCODE(t."requesterPublicKey", 'hex') AS "t_requesterPublicKey",
       t."signatures" AS "t_signatures"

FROM blocks b

LEFT OUTER JOIN trs AS t ON t."blockId" = b."id"
LEFT OUTER JOIN delegates AS d ON d."transactionId" = t."id"
LEFT OUTER JOIN votes AS v ON v."transactionId" = t."id"
LEFT OUTER JOIN signatures AS s ON s."transactionId" = t."id"
LEFT OUTER JOIN multisignatures AS m ON m."transactionId" = t."id"
LEFT OUTER JOIN dapps AS dapp ON dapp."transactionId" = t."id"
LEFT OUTER JOIN intransfer AS it ON it."transactionId" = t."id"
LEFT OUTER JOIN outtransfer AS ot ON ot."transactionId" = t."id"
LEFT OUTER JOIN locks AS lock ON lock."transactionId" = t."id"
LEFT OUTER JOIN pins AS pin ON pin."transactionId" = t."id";

COMMIT;
