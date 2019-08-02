'use strict';

var PinsSql = {
	getByIds: 'SELECT * FROM pins WHERE "transactionId" IN ($1:csv)',
	getPinsByParent: 'SELECT p1.*, (SELECT t2."type" from trs t2 JOIN pins p2 ON p2."transactionId" = t2."id" AND p2."hash" = p1."hash" WHERE t1."senderPublicKey" = t2."senderPublicKey" ORDER BY t2."timestamp" DESC LIMIT 1) AS latest from pins p1 JOIN trs t1 ON p1."transactionId" = t1."id" WHERE p1."parent" = ${parent};',
	getMostRecentPin: 'SELECT p.*, t.type, t.timestamp from pins p JOIN trs t ON p."transactionId" = t."id" WHERE p."hash" = ${hash} AND t."senderId" = ${senderId} ORDER BY t."timestamp" DESC LIMIT 1',
	getPinnedBytes: 'SELECT "pinned_bytes" from mem_accounts WHERE "publicKey" = DECODE(${publicKey}, \'hex\')',
	getTotalPinnedBytes: 'SELECT SUM("pinned_bytes") FROM mem_accounts'
};

module.exports = PinsSql;
