'use strict';

var async = require('async');
var lockSettings = require('../helpers/lockSettings.js');
var transactionTypes = require('../helpers/transactionTypes.js');
var bignum = require('../helpers/bignum.js');
var ByteBuffer = require('bytebuffer');

// Private fields
var modules, library, self, __private = {};

/**
 * Main lock logic.
 * @memberof module:lock
 * @class
 * @classdesc Main lock logic.
 */
// Constructor
function Lock (schema, logger) {
	library = {
		schema: schema,
		logger: logger
	};
	self = this;
}

/**
 * Binds input parameters to private variable modules.
 * @param {Accounts} accounts
 * @param {System} system
 * @param {Rounds} rounds
 * @param {Blocks} blocks
 * @param {Locks} locks
 * @param {Pins} pins
 */
Lock.prototype.bind = function (accounts, system, rounds, blocks, locks, pins) {
	modules = {
		accounts: accounts,
		system: system,
		rounds: rounds,
		blocks: blocks,
		locks: locks,
		pins: pins
	};
};

/**
 * Assigns data to transaction recipientId and amount.
 * @param {Object} data
 * @param {transaction} trs
 * @return {transaction} trs with assigned data
 */
Lock.prototype.create = function (data, trs) {
	trs.recipientId = null; //data.recipientId;
	trs.amount = data.amount;

	trs.asset.lock = {
		bytes: data.bytes
	};

	return trs;
};

/**
 * Returns send fees from constants.
 * @param {transaction} trs
 * @param {account} sender
 * @return {number} fee
 */
Lock.prototype.calculateFee = function (trs, sender, height) {
	if (trs.type == transactionTypes.LOCK) {
		return modules.system.getFees(height).fees.lock;
	} else if (trs.type == transactionTypes.UNLOCK) {
		return modules.system.getFees(height).fees.unlock;
	}
};

/**
 * Verifies recipientId and amount greather than 0.
 * @param {transaction} trs
 * @param {account} sender
 * @param {function} cb
 * @return {setImmediateCallback} errors | trs
 */
Lock.prototype.verify = function (trs, sender, cb) {
	if (!sender) {
		return setImmediate(cb, 'Missing sender', sender);
	}

	if (trs.recipientId) {
		return setImmediate(cb, 'Invalid recipient');
	}

	if (trs.amount <= 0) {
		return setImmediate(cb, 'Invalid transaction amount');
	}

	if (!trs.asset || !trs.asset.lock) {
		return setImmediate(cb, 'Invalid transaction asset');
	}

	var availableBalance = new bignum(sender.balance.toString());
	if (trs.type == transactionTypes.LOCK) {
		var totalAmount = new bignum(trs.amount.toString()).plus(trs.fee);
		if (availableBalance.lessThan(totalAmount)) {
			var err = [
				'Account does not have enough SHIFT to perform this lock request:', sender.address,
				'Available balance:', availableBalance.div(Math.pow(10,8))
			].join(' ');

			return setImmediate(cb, err);
		}

		var lastBlock = modules.blocks.lastBlock.get();
		self.calcLockBytes(lastBlock.height, trs.amount, trs.timestamp, function(err, bytes){
			if (err) {
				// Unable to calculate | incomplete stats
				return setImmediate(cb, err, trs);
			}

			var lockBytes = Math.floor(bytes);
			if (lockBytes < trs.asset.lock.bytes) {
				var err = 'Bytes to lock (' + trs.asset.lock.bytes + ') cannot exceed calculated bytes (' + lockBytes + ')';
				return setImmediate(cb, err);
			}

			return setImmediate(cb, err, trs);
		});
	} else if (trs.type == transactionTypes.UNLOCK) {
		if (availableBalance.lessThan(trs.fee)) {
			var err = 'Not enough SHIFT to perform this unlock request: '+ trs.id;
			return setImmediate(cb, err);
		}

		var totalAmount = new bignum(trs.amount.toString());
		var lockedBalance = new bignum(sender.locked_balance.toString());
		if (lockedBalance.lessThan(totalAmount)) {
			var err = "SHIFT to unlock " + totalAmount.div(Math.pow(10,8)) + " cannot exceed locked SHIFT (" + lockedBalance.div(Math.pow(10,8)) + ')';
			return setImmediate(cb, err);
		}

		var publicKey = trs.senderPublicKey;
		self.calcUnlockBytes(trs, function (err, unlockBytes) {
			if (err || !unlockBytes) {
				return cb('calcUnlockBytes error: ' + err);
			}

			modules.locks.getLockedBytes(publicKey, function (err, lockedBytes) {
				if (err || !lockedBytes) {
					return cb('getLockedBytes error: ' + err);
				}

				if (lockedBytes < trs.asset.lock.bytes) {
					return setImmediate(cb, "Bytes to unlock " + trs.asset.lock.bytes + " cannot exceed locked bytes (" + lockedBytes + ')');
				}

				modules.pins.getPinnedBytes(publicKey, function (err, pinnedBytes) {
					var availableLockedBytes = lockedBytes - pinnedBytes;

					if (availableLockedBytes < unlockBytes) {
						var err = 'Account does not have enough available bytes locked to complete unlock request';
						return setImmediate(cb, err);
					}

					return setImmediate(cb, err, trs);
				});
			});
		});
	}
};

/**
 * @param {transaction} trs
 * @param {account} sender
 * @param {function} cb
 * @return {setImmediateCallback} cb, null, trs
 */
Lock.prototype.process = function (trs, sender, cb) {
	return setImmediate(cb, null, trs);
};

/**
 * Creates a buffer with asset.lock information.
 * @param {transaction} trs
 * @return {Array} Buffer
 * @throws {e} error
 */
Lock.prototype.getBytes = function (trs) {
	if (!trs.asset.lock.bytes) {
		return null;
	}

	var buf;

	try {
		buf = Buffer.from([]);

		var byteBuf = new ByteBuffer(8, true);
		byteBuf.writeUint64(trs.asset.lock.bytes, 0);
		var arrayBuf = Buffer.from(new Uint8Array(byteBuf.toArrayBuffer()));

		buf = Buffer.concat([buf, arrayBuf]);
	} catch (e) {
		throw e;
	}

	return buf;
};

/**
 * Calculates how many bytes to lock for the offered amount of coins
 * @param {blockHeight} height
 * @param {number} amount
 * @param {function} cb
 * @return {setImmediateCallback} error | cb
 */
Lock.prototype.calcLockBytes = function (height, amount, timestamp, cb) {
	var compensationFactor = lockSettings.calcCompensation(height, true);
	var ratioFactor = lockSettings.calcRatioFactor(height);
	var buffer = lockSettings.calcBuffer(height);

	if (!amount || !compensationFactor || !ratioFactor) {
		return setImmediate(cb, "Amount is 0");
	}

	modules.locks.getClusterStats(timestamp, true, function (err, totalLockedBytes, totalBytes) {
		if (err) {
			return setImmediate(cb, err);
		}

		totalLockedBytes = totalLockedBytes ? new bignum(totalLockedBytes.toString()).toNumber() : 0;
		totalBytes = totalBytes ? new bignum(totalBytes.toString()).toNumber() : 0;

		// Total minus used is available (10% buffer)
		var freeBytes = (totalBytes - (totalBytes / buffer)) - totalLockedBytes;
		if (freeBytes < 0) {
			return setImmediate(cb, "No free bytes available");
		}

		// The actual amount to bytes calculation. We mind the replication in compensationFactor.
		if (totalLockedBytes > 0) {
			var lockBytes = Math.round(amount / (compensationFactor * (totalLockedBytes / freeBytes) * ratioFactor));
		} else {
			var lockBytes = Math.round(amount / (compensationFactor * ratioFactor));
		}

		var available = freeBytes - lockBytes;
		if (available < 0) {
			return setImmediate(cb, "Not enough storage in the cluster available: " + (available * -1) + ". Please lock a smaller amount or try again later.");
		}

		return setImmediate(cb, null, lockBytes);
	});
}

Lock.prototype.calcUnlockBytes = function (trs, cb) {
	var publicKey = trs.senderPublicKey;

	modules.locks.getLockedBytes(publicKey, function (err, bytes) {
		if (err || !bytes) {
			return setImmediate(cb, "Locked bytes is 0");
		}

		var lockedBytes = new bignum(bytes.toString()).toNumber();

		modules.locks.getLockedBalance(publicKey, function (err, balance) {
			if (err || !balance) {
				return setImmediate(cb, "Locked balance is 0");
			}

			var lockedBalance = new bignum(balance.toString());
			var totalAmount = new bignum(trs.amount.toString());
			if (lockedBalance.lessThan(totalAmount)) {
				return setImmediate(cb, "Amount to unlock " + totalAmount.div(Math.pow(10,8)) + " cannot exceed locked balance  " + lockedBalance.div(Math.pow(10,8)));
			}

			var bytes = Math.round((lockedBytes / lockedBalance) * trs.amount);

			return setImmediate(cb, null, bytes);
		});
	});
}

/**
 * Defines the asset values should be positive or negative based on the transaction type
 * @param {transaction} trs
 * @return error, lockAmount, lockBytes
 */
Lock.prototype.getLock = function (trs, revert) {
	var err = null, lockAmount, lockBytes;

	if (trs.type == transactionTypes.LOCK) {
		lockAmount = trs.amount;
		lockBytes = trs.asset.lock.bytes;
	} else if (trs.type == transactionTypes.UNLOCK) {
		lockAmount = trs.amount * -1;
		lockBytes = trs.asset.lock.bytes * -1;
	} else {
		err = 'Not a lock or unlock transaction type';
	}

	if (revert) {
		lockAmount *= -1;
		lockBytes *= -1;
	}

	return [err, lockAmount, lockBytes];
}

/**
 * Calls setAccountAndGet based on transaction recipientId and
 * mergeAccountAndGet with unconfirmed trs amount.
 * @implements {modules.accounts.setAccountAndGet}
 * @implements {modules.accounts.mergeAccountAndGet}
 * @implements {modules.rounds.calc}
 * @param {transaction} trs
 * @param {block} block
 * @param {account} sender
 * @param {function} cb - Callback function
 * @return {setImmediateCallback} error, cb
 */
Lock.prototype.apply = function (trs, block, sender, cb) {
	var [err, lockAmount, lockBytes] = self.getLock(trs, false);
	if (err) {
		return setImmediate(cb, err);
	}

	library.logger.trace('Logic/Lock->apply ' + (trs.type == transactionTypes.LOCK ? 'lock' : 'unlock'), {sender: trs.senderId, balance: lockAmount, bytes: lockBytes, height: block.height});

	modules.accounts.mergeAccountAndGet({
		address: trs.senderId,
		locked_balance: lockAmount,
		locked_bytes: lockBytes,
		blockId: block.id,
		round: modules.rounds.calc(block.height)
	}, function (err) {
		return setImmediate(cb, err);
	});
};

/**
 * Calls setAccountAndGet based on transaction recipientId and
 * mergeAccountAndGet with unconfirmed trs amount and balance negative.
 * @implements {modules.accounts.setAccountAndGet}
 * @implements {modules.accounts.mergeAccountAndGet}
 * @implements {modules.rounds.calc}
 * @param {transaction} trs
 * @param {block} block
 * @param {account} sender
 * @param {function} cb - Callback function
 * @return {setImmediateCallback} error, cb
 */
Lock.prototype.undo = function (trs, block, sender, cb) {
	var [err, lockAmount, lockBytes] = self.getLock(trs, true);
	if (err) {
		return setImmediate(cb, err);
	}

	modules.accounts.mergeAccountAndGet({
		address: trs.senderId,
		locked_balance: lockAmount,
		locked_bytes: lockBytes,
		blockId: block.id,
		round: modules.rounds.calc(block.height)
	}, function (err) {
		return setImmediate(cb, err);
	});
};

/**
 * @param {transaction} trs
 * @param {account} sender
 * @param {function} cb - Callback function.
 */
Lock.prototype.applyUnconfirmed = function (trs, sender, cb) {
	var [err, lockAmount, lockBytes] = self.getLock(trs, false);
	if (err) {
		return setImmediate(cb, err);
	}

	library.logger.trace('Logic/Lock->applyUnconfirmed ' + (trs.type == transactionTypes.LOCK ? 'lock' : 'unlock'), {sender: trs.senderId, balance: lockAmount, bytes: lockBytes});

	modules.accounts.mergeAccountAndGet({
		address: trs.senderId,
		u_locked_balance: lockAmount,
		u_locked_bytes: lockBytes
	}, function (err) {
		return setImmediate(cb, err);
	});
};

/**
 * @param {transaction} trs
 * @param {account} sender
 * @param {function} cb - Callback function.
 */
Lock.prototype.undoUnconfirmed = function (trs, sender, cb) {
	var [err, lockAmount, lockBytes] = self.getLock(trs, true);
	if (err) {
		return setImmediate(cb, err);
	}

	modules.accounts.mergeAccountAndGet({
		address: trs.senderId,
		u_locked_balance: lockAmount,
		u_locked_bytes: lockBytes
	}, function (err) {
		return setImmediate(cb, err);
	});
};

Lock.prototype.schema = {
	id: 'Locks',
	type: 'object',
	properties: {
		bytes: {
			type: 'integer',
			minimum: 0,
			maximum: Number.MAX_SAFE_INTEGER
		}
	},
	required: ['bytes']
};

/**
 * Deletes blockId from transaction
 * @param {transaction} trs
 * @return {transaction}
 */
Lock.prototype.objectNormalize = function (trs) {
	delete trs.blockId;

	var report = library.schema.validate(trs.asset.lock, Lock.prototype.schema);

	if (!report) {
		throw 'Failed to validate lock schema: ' + this.scope.schema.getLastErrors().map(function (err) {
			return err.message;
		}).join(', ');
	}

	return trs;
};

/**
 * Creates locks object based on raw data.
 * @param {Object} raw
 * @return {null|lock} lock object
 */
Lock.prototype.dbRead = function (raw) {
	if (!raw.l_bytes) {
		return null;
	} else {
		var data = {
			bytes: Math.round(raw.l_bytes)
		};

		return {lock: data};
	}
};

Lock.prototype.dbTable = 'locks';

Lock.prototype.dbFields = [
	'bytes',
	'transactionId'
];

/**
 * Creates Object based on trs data.
 * @param {transaction} trs - Contains bytes.
 * @returns {Object} {table:locks, bytes and transaction id}.
 */
Lock.prototype.dbSave = function (trs) {
	return {
		table: this.dbTable,
		fields: this.dbFields,
		values: {
			bytes: trs.asset.lock.bytes,
			transactionId: trs.id
		}
	};
};

/**
 * Checks sender multisignatures and transaction signatures.
 * @param {transaction} trs
 * @param {account} sender
 * @return {boolean} True if transaction signatures greather than
 * sender multimin or there are not sender multisignatures.
 */
Lock.prototype.ready = function (trs, sender) {
	if (Array.isArray(sender.multisignatures) && sender.multisignatures.length) {
		if (!Array.isArray(trs.signatures)) {
			return false;
		}
		return trs.signatures.length >= sender.multimin;
	} else {
		return true;
	}
};

// Export
module.exports = Lock;
