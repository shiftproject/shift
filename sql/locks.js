'use strict';

var LocksSql = {
	getByIds: 'SELECT * FROM locks WHERE "transactionId" IN ($1:csv)',
	getTotalLockedBalance: 'SELECT SUM("locked_balance") FROM mem_accounts',
	getTotalLockedBytes: 'SELECT SUM("locked_bytes") FROM mem_accounts',
	getLockedBalance: 'SELECT "locked_balance" FROM mem_accounts WHERE "publicKey" = DECODE(${publicKey}, \'hex\')',
	getLockedBytes: 'SELECT "locked_bytes" FROM mem_accounts WHERE "publicKey" = DECODE(${publicKey}, \'hex\')',
	getClusterStats: 'SELECT * FROM mem_cluster_stats ORDER BY "stats_timestamp" DESC LIMIT ${limit}',
	setClusterStats: 'INSERT INTO mem_cluster_stats '+
	'("id","total_locked_balance","total_locked_bytes","latest_cluster_total","latest_cluster_used","stats_timestamp") '+
	'VALUES (${id}, ${locked_balance}, ${locked_bytes}, ${total_bytes}, ${used_bytes}, ${timestamp}) '+
	'ON CONFLICT (id) DO UPDATE set "total_locked_balance" = ${locked_balance}, "total_locked_bytes" = ${locked_bytes}, "latest_cluster_total" = ${total_bytes}, "latest_cluster_used" = ${used_bytes}, "stats_timestamp" = ${timestamp}',
	getBlockStats: 'SELECT "timestamp", "height", "lockedBytes", "clusterSize" FROM blocks WHERE "timestamp" < ${timestamp} ORDER BY "height" DESC LIMIT 1'
};

module.exports = LocksSql;
