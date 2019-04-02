'use strict';

var PinsSql = {
	getByIds: 'SELECT * FROM pins WHERE "transactionId" IN ($1:csv)',
	getMostRecentPin: 'SELECT p.*, t.type from pins p JOIN trs t ON p."transactionId" = t."id" WHERE p."hash" = ${assetHash} AND t."senderId" = ${senderId} ORDER BY t."timestamp" DESC LIMIT 1',
	getPinnedBytes: 'SELECT "pinned_bytes" from mem_accounts WHERE "publicKey" = ${publicKey}'
};

module.exports = PinsSql;
