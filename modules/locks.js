'use strict';

var async = require('async');
var bignum = require('../helpers/bignum.js');
var constants = require('../helpers/constants.js');
var crypto = require('crypto');
var sandboxHelper = require('../helpers/sandbox.js');
var schema = require('../schema/locks.js');
var Lock = require('../logic/lock.js');
var lockSettings = require('../helpers/lockSettings.js');
var sql = require('../sql/locks.js');
var transactionTypes = require('../helpers/transactionTypes.js');
var slots = require('../helpers/slots.js');
var popsicle = require('popsicle');
var jobsQueue = require('../helpers/jobsQueue.js');

// Private fields
var modules, library, self, __private = {}, shared = {};

__private.storagePeers = {};
__private.markForRemoval = {};
__private.totalBytes = [];
__private.assetTypes = {};
__private.lastSlotSaved = null;

/**
 * Initializes library with scope content and generates a Lock instance.
 * Calls logic.transaction.attachAssetType().
 * @memberof module:locks
 * @class
 * @classdesc Main lock methods.
 * @param {function} cb - Callback function.
 * @param {scope} scope - App instance.
 * @return {setImmediateCallback} Callback function with `self` as data.
 */
// Constructor
function Locks (cb, scope) {
	library = {
		logger: scope.logger,
		db: scope.db,
		schema: scope.schema,
		ed: scope.ed,
		balancesSequence: scope.balancesSequence,
		logic: {
			lock: scope.logic.lock,
			transaction: scope.logic.transaction
		},
		config: {
			storage: scope.config.storage
		}
	};
	self = this;

	__private.lock = new Lock(
		scope.schema,
		scope.logger
	);

	// Lock
	__private.assetTypes[transactionTypes.LOCK] = library.logic.transaction.attachAssetType(
		transactionTypes.LOCK,
		__private.lock
	);

	// Unlock
	__private.assetTypes[transactionTypes.UNLOCK] = library.logic.transaction.attachAssetType(
		transactionTypes.UNLOCK,
		__private.lock
	);

	__private.storagePeers = library.config.storage.peers;

	setImmediate(cb, null, self);
}

/**
 * Gets the total amount of locked balance for an account
 * @param {string} publicKey
 * @param {function} cb - Callback function.
 * @returns {setImmediateCallback} error | data: {balance}
 */
Locks.prototype.getLockedBalance = function (publicKey, cb) {
	library.db.query(sql.getLockedBalance, {publicKey: publicKey}).then(function (rows) {
		var balance = 0;
		if (rows.length > 0) {
			balance = rows[0].locked_balance;
		}

		return setImmediate(cb, null, balance);
	}).catch(function (err) {
		library.logger.error(err.stack);
		return setImmediate(cb, 'Locks#getLockedBalance error');
	});
};

/**
 * Gets the total sum of locked balance of all accounts
 * @param {function} cb - Callback function.
 * @returns {setImmediateCallback} error | data: {bytes}
 */
Locks.prototype.getTotalLockedBalance = function (cb) {
	library.db.query(sql.getTotalLockedBalance).then(function (rows) {
		if (rows.length === 0) {
			return setImmediate(cb, null, 0);
		}

		var balance = rows[0].sum;

		return setImmediate(cb, null, balance);
	}).catch(function (err) {
		library.logger.error(err.stack);
		return setImmediate(cb, 'Locks#getTotalLockedBalance error');
	});
};

/**
 * Gets the total amount of locked bytes for an account
 * @param {string} publicKey
 * @param {function} cb - Callback function.
 * @returns {setImmediateCallback} error | data: {bytes}
 */
Locks.prototype.getLockedBytes = function (publicKey, cb) {
	library.db.query(sql.getLockedBytes, {publicKey: publicKey}).then(function (rows) {
		var bytes = 0;
		if (rows.length > 0) {
			bytes = rows[0].locked_bytes;
		}

		return setImmediate(cb, null, bytes);
	}).catch(function (err) {
		library.logger.error(err.stack);
		return setImmediate(cb, 'Locks#getLockedBytes error');
	});
};

/**
 * Gets the total sum of locked bytes of all accounts
 * @param {function} cb - Callback function.
 * @returns {setImmediateCallback} error | data: {bytes}
 */
Locks.prototype.getTotalLockedBytes = function (cb) {
	library.db.query(sql.getTotalLockedBytes).then(function (rows) {
		if (rows.length === 0) {
			return setImmediate(cb, null, 0);
		}

		var bytes = rows[0].sum;

		return setImmediate(cb, null, bytes);
	}).catch(function (err) {
		library.logger.error(err.stack);
		return setImmediate(cb, 'Locks#getTotalLockedBytes error');
	});
};

/**
 * Get replication factor of last block
 * @return replication
 */
Locks.prototype.getReplication = function () {
	var lastBlock = modules.blocks.lastBlock.get();
	var replication = lockSettings.locks[lockSettings.calcMilestone(lastBlock.height)].replication;

	return replication;
}

/**
 * Get stats from block or memtables
 * @param {string[]} timestamp
 * @param {function} cb
 * @return {setImmediateCallback} error description | lockedBytes, clusterSize
 */
Locks.prototype.getClusterStats = function (timestamp, blockStats, cb) {
	if (timestamp && blockStats) {
		// Lookup stats in blocks, to validate trs
		var lastBlock = modules.blocks.lastBlock.get();

		library.db.query(sql.getBlockStats, {timestamp: timestamp}).then(function (blocks) {
			if (blocks.length === 0) {
				return setImmediate(cb, 'Block stats not found');
			}
			var block = blocks[0];

			if (lastBlock.height - block.height > constants.blockSlotWindow) {
				return setImmediate(cb, 'Block stats are too old');
			}

			return setImmediate(cb, null, block.lockedBytes, block.clusterSize);
		}).catch(function (err) {
			library.logger.error(err.stack);
			return setImmediate(cb, 'Locks#getBlockStats error');
		});
	} else {
		// Lookup stats in memtables, to validate block
		self.getTotalLockedBytes(function (err, lockedBytes) {
			if (err) {
				return setImmediate(cb, err);
			}

			self.getClusterSize(timestamp, function (err, clusterSize) {
				if (err) {
					return setImmediate(cb, err);
				}

				return setImmediate(cb, null, lockedBytes, clusterSize);
			});
		});
	}
};

/**
 * Gets records from `mem_cluster_stats` table based on slots
 * @implements {library.db.query}
 * @param {string[]} timestamp
 * @param {function} cb
 * @return {setImmediateCallback} error description | rows data
 */
Locks.prototype.getClusterSize = function (timestamp, cb) {
	library.db.query(sql.getClusterStats, {limit: constants.blockStatsInterval}).then(function (rows) {
		var err = null;
		var mode_avg = 0;
		var totals = [];
		if (rows.length > 0 && rows.length >= constants.blockStatsInterval) {
			rows.forEach(function(stat){
				if (timestamp) {
					var blockSlotNumber = slots.getSlotNumber(timestamp) - 1;
					var lastRoundTime = slots.getSlotTime(blockSlotNumber > constants.activeDelegates ? blockSlotNumber - constants.activeDelegates : constants.activeDelegates);

					if (stat.stats_timestamp < lastRoundTime || stat.stats_timestamp > timestamp) {
						err = 'Not enough recent stats available';
						return false;
					}
				}
				totals.push(stat.latest_cluster_total);
			});

			// Remove latest snapshot from desc list
			if (totals.length == constants.blockStatsInterval) {
				totals.splice(0, 1);
			}

			// Sort values asc
			totals.sort();

			// Pick value in middle
			var middle = Math.floor(totals.length / 2);
			var mode_avg = totals[middle];

			return setImmediate(cb, err, mode_avg);
		} else {
			return setImmediate(cb, 'Not enough stats available');
		}
	}).catch(function (err) {
		library.logger.error(err.stack);
		return setImmediate(cb, 'Locks#getClusterSize error');
	});
};

/**
 * Requests the cluster stats of a random peer and writes to `mem_cluster_stats` table.
 * @param {function} cb - Callback function.
 * @return {setImmediateCallback} err | cb
 */
Locks.prototype.setClusterStats = function (cb) {
	var slotNumber = slots.getSlotNumber();
	var slotToSave = Math.floor(slotNumber % 100 / constants.blockStatsInterval) * constants.blockStatsInterval || 100;
	var lastRound = Math.floor(slotNumber / constants.activeDelegates);

	library.logger.trace('Modules/Locks->setClusterStats', {interval: constants.blockStatsInterval, slot: slotNumber});

	// No storage peers found. Reset to bootstrap peers
	if (__private.storagePeers.length === 0) {
		__private.storagePeers = library.config.storage.peers;
	}

	// Call a random peer from storage cluster
	var peer = __private.storagePeers[Math.floor(Math.random() * __private.storagePeers.length)];
	if (peer === undefined || __private.storagePeers.length === 0) {
		return setImmediate(cb, 'Not a valid storage peer');
	}

	var url = 'http://' + peer.ip + (peer.port && peer.port != 80 ? ':' + peer.port : '');
	var req = {
		url: url + '/peers',
		method: 'get',
		timeout: library.config.storage.options.timeout
	};

	// Populate peer list, every [3] times we come here
	var randomNum = Math.ceil(Math.random() * constants.lookupPerIterations);
	if (randomNum === constants.lookupPerIterations) {
		popsicle.request(req).then(function (result) {
			if (result.status === 200) {
				try {
					var rows = JSON.parse(result.body);
					for (var i = 0, row; row = rows[i]; i++) {
						if (row.Online === true) {
							__private.addPeer(row.Host, row.Port);
						} else {
							if (row.Host in __private.markForRemoval) {
								if (__private.markForRemoval[row.Host] > constants.maxRemovalMarks) {
									delete __private.markForRemoval[row.Host];
									__private.removePeer(row.Host);
								} else {
									__private.markForRemoval[row.Host]++;
								}
							} else {
								__private.markForRemoval[row.Host] = 1;
							}
						}
					}
				} catch(err) {}
			}
		}).catch(function (err) {
			if (peer !== undefined) {
				__private.removePeer(peer.ip);
				peer = __private.storagePeers[Math.floor(Math.random() * __private.storagePeers.length)];
			}
		});
	}

	async.series({
		lockedBalance: function (seriesCb) {
			self.getTotalLockedBalance(function (err, balance) {
				if (err) {
					return setImmediate(seriesCb, err);
				} else {
					return setImmediate(seriesCb, null, balance);
				}
			});
		},
		lockedBytes: function (seriesCb) {
			self.getTotalLockedBytes(function (err, bytes) {
				if (err) {
					return setImmediate(seriesCb, err);
				} else {
					return setImmediate(seriesCb, null, bytes);
				}
			});
		},
		clusterStats: function (seriesCb) {
			req.url = url + '/stats',
			popsicle.request(req).then(function (res) {
				if (res.status === 200) {
					delete __private.markForRemoval[peer.ip];
				} else {
					__private.removePeer(peer.ip);

					return setImmediate(seriesCb, ['Received bad response from cluster', res.status, req.method, req.url].join(' '));
				}

				// Parse stats result
				try {
					var cluster = JSON.parse(res.body);
					return setImmediate(seriesCb, null, cluster);
				} catch(err) {
					return setImmediate(seriesCb, 'Error parsing cluster response');
				};
			}).catch(function (err) {
				if (peer !== undefined) {
					__private.removePeer(peer.ip);
				}

				return setImmediate(seriesCb, [err.code, 'Request failed', req.method, req.url].join(' '));
			});
		}
	}, function (err, results) {
		if (err) {
			return setImmediate(cb, err);
		} else {
			var stats = {
				id: slotToSave,
				locked_balance: results.lockedBalance ? new bignum(results.lockedBalance).toNumber() : 0,
				locked_bytes: results.lockedBytes ? new bignum(results.lockedBytes).toNumber() : 0,
				total_bytes: results.clusterStats.TotalStorage ? new bignum(results.clusterStats.TotalStorage).toNumber() : 0,
				used_bytes: results.clusterStats.UsedStorage ? new bignum(results.clusterStats.UsedStorage).toNumber() : 0,
				timestamp: slots.getTime()
			};

			// Remember the received size
			if (!slotToSave || __private.lastSlotSaved == lastRound + '.' + slotToSave) {
				__private.totalBytes.push(stats.total_bytes);
				return cb();
			} else {
				// Save the most frequent size out of the collected sizes, once every [10] blocks
				if (__private.totalBytes.length > 0) {
					var mostFrequent = __private.getMostFrequent(__private.totalBytes);
					stats.total_bytes = mostFrequent;
				}

				// Save stats
				library.schema.validate(stats, schema.setClusterStats, function (err) {
					if (err) {
						return setImmediate(cb, err.message);
					}

					library.db.query(sql.setClusterStats, stats).then(function () {
						__private.lastSlotSaved = lastRound + '.' + slotToSave;
						__private.totalBytes = [];
						library.logger.log('Saved stats to memtable' + ':' + JSON.stringify(stats));
						return setImmediate(cb, null);
					}).catch(function (err) {
						library.logger.error(err.stack);
						return setImmediate(cb, 'Locks#setClusterStats error');
					});
				});
			}
		}
	});
}

// Private methods
__private.addPeer = function(ip, port) {
	var exists = false;
	if (__private.storagePeers.length > 0) {
		for (var i = 0; i < __private.storagePeers.length; i++) {
			var peer = __private.storagePeers[i];
			if (peer.hasOwnProperty('ip') && peer.ip === ip) {
				exists = true;
				break;
			}
		}
	}

	if (!exists) {
		library.logger.info('Add new storage peer to list', ip);
		__private.storagePeers.push({'ip': ip});
	}
}

__private.removePeer = function(ip) {
	if (__private.storagePeers.length > 0) {
		var remove = false;
		for (var i = __private.storagePeers.length-1; i >= 0; i--) {
			var peer = __private.storagePeers[i];
			if (peer.hasOwnProperty('ip') && peer.ip === ip) {
				remove = i;
				break;
			}
		}

		if (remove !== false) {
			library.logger.info('Remove bad storage peer from list', ip);
			__private.storagePeers.splice(remove, 1);
		}
	}
}

__private.getMostFrequent = function (array) {
	var temp, count = 1, most = array[0];
	for (var i = 0; i < array.length-1; i++) {
		temp = 0;
		for (var j = 1; j < array.length; j++) {
			if (array[i] == array[j]) {
				temp++;
			}
		}
		if (temp > count) {
			most = array[i];
			count = temp;
		}
	}

	return most;
}

// Public methods
/**
 * Checks if `modules` is loaded.
 * @return {boolean} True if `modules` is loaded.
 */
Locks.prototype.isLoaded = function () {
	return !!modules;
};

/**
 * Calls helpers.sandbox.callMethod().
 * @implements module:helpers#callMethod
 * @param {function} call - Method to call.
 * @param {} args - List of arguments.
 * @param {function} cb - Callback function.
 */
Locks.prototype.sandboxApi = function (call, args, cb) {
	sandboxHelper.callMethod(this.shared, call, args, cb);
};

// Events
/**
 * Calls Lock.bind() with modules params.
 * @implements module:locks#Lock~bind
 * @param {modules} scope - Loaded modules.
 */
Locks.prototype.onBind = function (scope) {
	modules = {
		accounts: scope.accounts,
		system: scope.system,
		transactions: scope.transactions,
		blocks: scope.blocks
	};

	__private.lock.bind(
		scope.accounts,
		scope.system,
		scope.rounds,
		scope.blocks,
		self,
		scope.pins
	);

	// Cluster stats timer
	function setStats (cb) {
		self.setClusterStats(function (err) {
			if (err) {
				library.logger.error('Cluster stats timer', err);
			}
			return setImmediate(cb);
		});
	}

	jobsQueue.register('setClusterStats', setStats, constants.blockTime);
};

// Shared API
/**
 * @todo implement API comments with apidoc.
 * @see {@link http://apidocjs.com/}
 */
Locks.prototype.shared = {
	getFee: function (req, cb) {
		library.schema.validate(req.body, schema.getFee, function (err) {
			if (err) {
				return setImmediate(cb, err[0].message);
			}

			var f = modules.system.getFees(req.body.height);
			f.fee = {
				lock: f.fees.lock,
				unlock: f.fees.unlock
			};
			delete f.fees;
			return setImmediate(cb, null, f);
		});
	},
	calcLockBytes: function (req, cb) {
		library.schema.validate(req.body, schema.calcLockBytes, function (err) {
			if (err) {
				return setImmediate(cb, err[0].message);
			}

			var lastBlock = modules.blocks.lastBlock.get();
			__private.lock.calcLockBytes(lastBlock.height, req.body.amount, null, function(err, result) {
				if (err) {
					return setImmediate(cb, err);
				}

				var lockBytes = Math.round(result);

				return setImmediate(cb, null, {bytes: (lockBytes || 0)});
			});
		});
	},
	calcUnlockBytes: function (req, cb) {
		library.schema.validate(req.body, schema.calcUnlockBytes, function (err) {
			if (err) {
				return setImmediate(cb, err[0].message);
			}

			__private.lock.calcUnlockBytes({
				senderPublicKey: req.body.publicKey,
				amount: req.body.amount
			}, function(err, result) {
				if (err) {
					return setImmediate(cb, err);
				}

				var unlockBytes = Math.round(result);

				return setImmediate(cb, null, {bytes: (unlockBytes || 0)});
			});
		});
	},
	getLockedBalance: function (req, cb) {
		library.schema.validate(req.body, schema.getLockedBalance, function (err) {
			if (err) {
				return setImmediate(cb, err[0].message);
			}
			self.getLockedBalance(req.body.publicKey, function (err, balance) {
				if (err) {
					return setImmediate(cb, err);
				}

				return setImmediate(cb, null, {balance: (balance || 0) });
			});
		});
	},
	getTotalLockedBalance: function (req, cb) {
		self.getTotalLockedBalance(function (err, balance) {
			if (err) {
				return setImmediate(cb, err);
			}

			return setImmediate(cb, null, { balance: (balance || 0) });
		});
	},
	getLockedBytes: function (req, cb) {
		library.schema.validate(req.body, schema.getLockedBytes, function (err) {
			if (err) {
				return setImmediate(cb, err[0].message);
			}
			self.getLockedBytes(req.body.publicKey, function (err, bytes) {
				if (err) {
					return setImmediate(cb, err);
				}

				return setImmediate(cb, null, { bytes: (bytes || 0) });
			});
		});
	},
	getTotalLockedBytes: function (req, cb) {
		self.getTotalLockedBytes(function (err, bytes) {
			if (err) {
				return setImmediate(cb, err);
			}

			return setImmediate(cb, null, { bytes: (bytes || 0) });
		});
	},
	getClusterStats: function (req, cb) {
		library.schema.validate(req.body || {}, schema.getClusterStats, function (err) {
			if (err) {
				return setImmediate(cb, err[0].message);
			}
			self.getClusterStats(req.body.timestamp, false, function (err, lockedBytes, clusterSize) {
				if (err) {
					return setImmediate(cb, err);
				}

				return setImmediate(cb, null, { bytes: (lockedBytes || 0), size: (clusterSize || 0) });
			});
		});
	}
};

// Export
module.exports = Locks;
