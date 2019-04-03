'use strict';

var PinsSql = {
	getByIds: 'SELECT * FROM pins WHERE "transactionId" IN ($1:csv)',
	getPinsByParent: 'SELECT p.*, t.type from pins p JOIN trs t ON p."transactionId" = t."id" WHERE p."parent" = ${parent} AND t."type" = ${type} ORDER BY t."timestamp" DESC',
	getMostRecentPin: 'SELECT p.*, t.type from pins p JOIN trs t ON p."transactionId" = t."id" WHERE p."hash" = ${hash} AND t."senderId" = ${senderId} ORDER BY t."timestamp" DESC LIMIT 1',
	getPinnedBytes: 'SELECT "pinned_bytes" from mem_accounts WHERE "publicKey" = DECODE(${publicKey}, \'hex\')'
};

module.exports = PinsSql;
