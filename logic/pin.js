'use strict';

var transactionTypes = require('../helpers/transactionTypes.js');
var bignum = require('../helpers/bignum.js');
var ByteBuffer = require('bytebuffer');
var CID = require('cids');

// Private fields
var modules, library, self, __private = {};

/**
 * Main pin logic.
 * @memberof module:pin
 * @class
 * @classdesc Main pin logic.
 */
// Constructor
function Pin (schema, logger) {
	library = {
		schema: schema,
		logger: logger
	};
	self = this;
}

/**
 * Binds input parameters to private variable modules.
 * @param {Accounts} accounts
 * @param {Rounds} rounds
 */
Pin.prototype.bind = function (accounts, system, rounds, transactions, locks, pins) {
	modules = {
		accounts: accounts,
		system: system,
		rounds: rounds,
		transactions: transactions,
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
Pin.prototype.create = function (data, trs) {
	trs.recipientId = null;
	trs.amount = 0;

	var hash = self.cid(data.hash, 0);

	trs.asset.pin = {
		hash: hash,
		bytes: data.bytes,
		parent: data.parent
	};

	return trs;
};

/**
 * Returns send fees from constants.
 * @param {transaction} trs
 * @param {account} sender
 * @return {number} fee
 */
Pin.prototype.calculateFee = function (trs, sender, height) {
	if (trs.type == transactionTypes.PIN) {
		return modules.system.getFees(height).fees.pin;
	} else {
		return modules.system.getFees(height).fees.unpin;
	}
};

/**
 * Verifies recipientId is null, sender and amount greather than 0.
 * verifies available balance and available locked bytes
 * @param {transaction} trs
 * @param {account} sender
 * @param {function} cb
 * @return {setImmediateCallback} errors | trs
 */
Pin.prototype.verify = function (trs, sender, cb) {
	if (!sender) {
		return setImmediate(cb, 'Missing sender', sender);
	}

	if (trs.recipientId) {
		return setImmediate(cb, 'Invalid recipient');
	}

	if (trs.amount != 0) {
		return setImmediate(cb, 'Invalid transaction amount');
	}

	if (!trs.asset || !trs.asset.pin || !trs.asset.pin.hash || !trs.asset.pin.bytes) {
		return setImmediate(cb, 'Invalid transaction asset');
	}

	var availableBalance = new bignum(sender.balance.toString());
	var totalAmount = new bignum(trs.fee.toString());
	if (availableBalance.lessThan(totalAmount)) {
		var err = [
			'Account does not have enough SHIFT:', sender.address,
			'Available balance:', availableBalance.div(Math.pow(10,8))
		].join(' ');
		return setImmediate(cb, err);
	}

	modules.pins.getMostRecentPin(trs.asset.pin.hash, trs.senderId, function (err, mostRecentPin) {
		if (err) {
			mostRecentPin = false;
		}

		if (mostRecentPin && mostRecentPin.timestamp > trs.timestamp) {
			return setImmediate(cb, "Timestamp cannot be older than the previous pin");
		}

		if (trs.type === transactionTypes.PIN) {
			if (mostRecentPin && mostRecentPin.type === transactionTypes.PIN) {
				return setImmediate(cb, "Can not pin a hash you have already pinned");
			}

			var publicKey = trs.senderPublicKey;
			modules.locks.getLockedBytes(publicKey, function (err, lockedBytes) {
				if (err || !lockedBytes) {
					return setImmediate(cb, "No locked bytes available");
				}

				modules.pins.getPinnedBytes(publicKey, function (err, pinnedBytes) {
					var replication = modules.locks.getReplication();
					var availableLockedBytes = lockedBytes - (pinnedBytes * replication);

					if (availableLockedBytes - (trs.asset.pin.bytes * replication) < 0) {
						var err = 'Not enough locked bytes available';
					}

					if (typeof trs.asset.pin.parent === 'undefined' || trs.asset.pin.parent === null) {
						return setImmediate(cb, err, trs);
					} else {
						modules.transactions.getById(trs.asset.pin.parent, function (err, transaction) {
							if (!transaction || err) {
								return setImmediate(cb, 'Parent transaction not found');
							}

							if (transaction.senderPublicKey !== trs.senderPublicKey) {
								var err = 'Sender of parent transaction does not match';
							}

							return setImmediate(cb, err, trs);
						});
					}
				});
			});
		} else if (trs.type === transactionTypes.UNPIN) {
			if (!mostRecentPin || mostRecentPin.type !== transactionTypes.PIN) {
				return setImmediate(cb, "Can not unpin an asset you have not pinned");
			}

			var pinnedBytes = new bignum(mostRecentPin.bytes).toNumber();
			if (pinnedBytes !== trs.asset.pin.bytes) {
				return setImmediate(cb, "Incorrect number of bytes to unpin");
			}

			return setImmediate(cb, null, trs);
		}
	});
};

/**
 * @param {transaction} trs
 * @param {account} sender
 * @param {function} cb
 * @return {setImmediateCallback} cb, null, trs
 */
Pin.prototype.process = function (trs, sender, cb) {
	return setImmediate(cb, null, trs);
};

/**
 * @param {transaction} trs
 * @return {null}
 */
Pin.prototype.getBytes = function (trs) {
	var buf;

	try {
		buf = Buffer.from([]);

		var hashBuf = Buffer.from(trs.asset.pin.hash.toString(), 'utf8');
		buf = Buffer.concat([buf, hashBuf]);

		var byteBuf = new ByteBuffer(8, true);
		byteBuf.writeUint64(trs.asset.pin.bytes, 0);
		var arrayBuf = Buffer.from(new Uint8Array(byteBuf.toArrayBuffer()));

		if (trs.asset.pin.parent) {
			var parentBuf = new ByteBuffer(8, true);
			parentBuf.writeUint64(trs.asset.pin.parent, 0);
			parentBuf = Buffer.from(new Uint8Array(parentBuf.toArrayBuffer()));

			arrayBuf = Buffer.concat([arrayBuf, parentBuf]);
		}

		buf = Buffer.concat([buf, arrayBuf]);
	} catch (e) {
		throw e;
	}

	return buf;
};

/**
 * Defines the pin values should be positive or negative based on the transaction type
 * @param {transaction} trs
 * @return error, pinBytes
 */
Pin.prototype.getPin = function (trs, revert) {
	var err = null, pinBytes = 0;

	if (trs.type == transactionTypes.PIN) {
		pinBytes = trs.asset.pin.bytes;
	} else if (trs.type == transactionTypes.UNPIN) {
		pinBytes = trs.asset.pin.bytes * -1;
	} else {
		err = 'Not a pin or unpin transaction type';
	}

	if (revert) {
		pinBytes *= -1;
	}

	return [err, pinBytes];
}

/**
 * Calls setAccountAndGet based on transaction senderId and
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
Pin.prototype.apply = function (trs, block, sender, cb) {
	var [err, pinBytes] = self.getPin(trs, false);
	if (err) {
		return setImmediate(cb, err);
	}

	library.logger.trace('Logic/Pin->apply ' + (trs.type == transactionTypes.PIN ? 'pin' : 'unpin'), {sender: trs.senderId, bytes: pinBytes, height: block.height});

	modules.accounts.mergeAccountAndGet({
		address: trs.senderId,
		pinned_bytes: pinBytes,
		blockId: block.id,
		round: modules.rounds.calc(block.height)
	}, function (err) {
		return setImmediate(cb, err);
	});
};

/**
 * Calls setAccountAndGet based on transaction senderId and
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
Pin.prototype.undo = function (trs, block, sender, cb) {
	var [err, pinBytes] = self.getPin(trs, true);
	if (err) {
		return setImmediate(cb, err);
	}

	modules.accounts.setAccountAndGet({address: trs.senderId}, function (err, recipient) {
		if (err) {
			return setImmediate(cb, err);
		}

		modules.accounts.mergeAccountAndGet({
			address: trs.senderId,
			pinned_bytes: pinBytes,
			blockId: block.id,
			round: modules.rounds.calc(block.height)
		}, function (err) {
			return setImmediate(cb, err);
		});
	});
};

/**
 * @param {transaction} trs
 * @param {account} sender
 * @param {function} cb
 * @return {setImmediateCallback} cb
 */
Pin.prototype.applyUnconfirmed = function (trs, sender, cb) {
	var [err, pinBytes] = self.getPin(trs, false);
	if (err) {
		return setImmediate(cb, err);
	}

	library.logger.trace('Logic/Pin->apply ' + (trs.type == transactionTypes.PIN ? 'pin' : 'unpin'), {sender: trs.senderId, bytes: pinBytes});

	modules.accounts.mergeAccountAndGet({
		address: trs.senderId,
		u_pinned_bytes: pinBytes
	}, function (err) {
		return setImmediate(cb, err);
	});
};

/**
 * @param {transaction} trs
 * @param {account} sender
 * @param {function} cb
 * @return {setImmediateCallback} cb
 */
Pin.prototype.undoUnconfirmed = function (trs, sender, cb) {
	var [err, pinBytes] = self.getPin(trs, true);
	if (err) {
		return setImmediate(cb, err);
	}

	modules.accounts.setAccountAndGet({address: trs.senderId}, function (err, recipient) {
		if (err) {
			return setImmediate(cb, err);
		}

		modules.accounts.mergeAccountAndGet({
			address: trs.senderId,
			u_pinned_bytes: pinBytes
		}, function (err) {
			return setImmediate(cb, err);
		});
	});
};

Pin.prototype.schema = {
	id: 'Pin',
	type: 'object',
	properties: {
		hash: {
			type: 'string',
			minLength: 46,
			maxLength: 60
		},
		bytes: {
			type: 'integer',
			minimum: 0,
			maximum: Number.MAX_SAFE_INTEGER
		},
		parent: {
			type: 'string',
			format: 'id',
			minLength: 1,
			maxLength: 20
		}
	},
	required: ['hash', 'bytes']
};

/**
 * Deletes blockId from transaction
 * @param {transaction} trs
 * @return {transaction}
 */
Pin.prototype.objectNormalize = function (trs) {
	delete trs.blockId;

	var report = library.schema.validate(trs.asset.pin, Pin.prototype.schema);

	if (!report) {
		throw 'Failed to validate pin schema: ' + this.scope.schema.getLastErrors().map(function (err) {
			return err.message;
		}).join(', ');
	}

	return trs;
};

Pin.prototype.cid = function (multihashStr, version = 1) {
	var cidv0, cidv1;
	var cid = new CID(multihashStr);

	if (cid.version === 1) { // multibaseName: base58btc
		cidv0 = (version === 0 ? cid.toV0() : cid).toBaseEncodedString();
		cidv1 = multihashStr;
	} else if (cid.version === 0) { // multibaseName: base32
		cidv0 = multihashStr;
		cidv1 = (version === 1 ? cid.toV1() : cid).toBaseEncodedString();
	}

	return version === 1 ? cidv1 : cidv0;
}

/**
 * @param {Object} raw
 * @return {null}
 */
Pin.prototype.dbRead = function (raw) {
	if (!raw.p_hash || !raw.p_bytes) {
		return null;
	} else {
		var hash = self.cid(raw.p_hash, 0); // Show as cidv0
		var data = {
			hash: hash,
			bytes: Math.round(raw.p_bytes)
		};
		if (raw.p_parent) {
			data.parent = raw.p_parent;
		}

		return {pin: data};
	}
};

Pin.prototype.dbTable = 'pins';

Pin.prototype.dbFields = [
	'hash',
	'bytes',
	'parent',
	'transactionId'
];

/**
 * @param {transaction} trs
 * @return {null}
 */
Pin.prototype.dbSave = function (trs) {
	var hash = self.cid(trs.asset.pin.hash, 1); // Save as cidv1

	return {
		table: this.dbTable,
		fields: this.dbFields,
		values: {
			hash: hash,
			bytes: trs.asset.pin.bytes,
			parent: trs.asset.pin.parent,
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
Pin.prototype.ready = function (trs, sender) {
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
module.exports = Pin;
