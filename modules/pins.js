'use strict';

var async = require('async');
var constants = require('../helpers/constants.js');
var crypto = require('crypto');
var sandboxHelper = require('../helpers/sandbox.js');
var schema = require('../schema/pins.js');
var Pin = require('../logic/pin.js');
var lockSettings = require('../helpers/lockSettings.js');
var sql = require('../sql/pins.js');
var transactionTypes = require('../helpers/transactionTypes.js');
var slots = require('../helpers/slots.js');

// Private fields
var modules, library, self, __private = {}, shared = {};

__private.assetTypes = {};

/**
 * Initializes library with scope content and generates a Pin instance.
 * Calls logic.transaction.attachAssetType().
 * @memberof module:pins
 * @class
 * @classdesc Main pin methods.
 * @param {function} cb - Callback function.
 * @param {scope} scope - App instance.
 * @return {setImmediateCallback} Callback function with `self` as data.
 */
// Constructor
function Pins (cb, scope) {
	library = {
		logger: scope.logger,
		db: scope.db,
		schema: scope.schema,
		ed: scope.ed,
		balancesSequence: scope.balancesSequence,
		logic: {
			transaction: scope.logic.transaction
		},
		config: {
			storage: scope.config.storage
		}
	};
	self = this;

	__private.pin = new Pin(
		scope.schema,
		scope.logger
	);

	// Pin
	__private.assetTypes[transactionTypes.PIN] = library.logic.transaction.attachAssetType(
		transactionTypes.PIN,
		__private.pin
	);

	// Unpin
	__private.assetTypes[transactionTypes.UNPIN] = library.logic.transaction.attachAssetType(
		transactionTypes.UNPIN,
		__private.pin
	);

	setImmediate(cb, null, self);
}

// Private methods
/**
 * Gets pin transactions by parent ID
 * @private
 * @param {string} parent, type
 * @param {function} cb - Callback function.
 * @returns {setImmediateCallback} error | data: {pins}
 */
__private.getPinsByParent = function (id, type, cb) {
	library.db.query(sql.getPinsByParent, {parent: id}).then(function (pins) {
		if (pins.length === 0) {
			return setImmediate(cb, 'No pin transactions found with parent: ' + id);
		}

		var result = [];
		pins.forEach(function(pin) {
			if ((!type || pin.latest === type) && (pin.latest === transactionTypes.PIN || pin.latest === transactionTypes.UNPIN)) {
				pin.hash = __private.pin.cid(pin.hash, 0); // Show as cidv0
				result.push(pin);
			}
		});

		if (type === transactionTypes.PIN && result.length === 0) {
			return setImmediate(cb, 'Content with parent: ' + id + 'is unpinned');
		}

		return setImmediate(cb, null, result);
	}).catch(function (err) {
		library.logger.error(err.stack);
		return setImmediate(cb, 'Pins#getPinsByParent error');
	});
};

// Public methods
/**
 * Gets the total amount of pinned bytes for an account
 * @param {string} publicKey
 * @param {function} cb - Callback function.
 * @returns {setImmediateCallback} error | data: {bytes}
 */
Pins.prototype.getPinnedBytes = function (publicKey, cb) {
	library.db.query(sql.getPinnedBytes, {publicKey: publicKey}).then(function (pins) {
		if (pins.length === 0) {
			return setImmediate(cb, 0);
		}

		var bytes = pins[0].pinned_bytes;

		return setImmediate(cb, null, bytes);
	}).catch(function (err) {
		library.logger.error(err.stack);
		return setImmediate(cb, 'Pins#getPinnedBytes error');
	});
};

/**
 * Gets the total sum of pinned bytes of all accounts
 * @param {function} cb - Callback function.
 * @returns {setImmediateCallback} error | data: {bytes}
 */
Pins.prototype.getTotalPinnedBytes = function (cb) {
	library.db.query(sql.getTotalPinnedBytes).then(function (rows) {
		if (rows.length === 0) {
			return setImmediate(cb, null, 0);
		}

		var bytes = rows[0].sum;

		return setImmediate(cb, null, bytes);
	}).catch(function (err) {
		library.logger.error(err.stack);
		return setImmediate(cb, 'Pins#getTotalPinnedBytes error');
	});
};

/**
 * Gets the most recent pin
 * @param {string} hash
 * @param {int} bytes
 * @param {string} senderId
 * @param {function} cb - Callback function.
 * @returns {setImmediateCallback} error | data: {pin}
 */
Pins.prototype.getMostRecentPin = function (hash, senderId, cb) {
	var pinnedHash = __private.pin.cid(hash, 1); // Query as cidv1
	library.db.query(sql.getMostRecentPin, {hash: pinnedHash, senderId: senderId}).then(function (pins) {
		if (pins.length === 0) {
			return setImmediate(cb, 'Pin transaction not found: ' + hash + ' with sender ' + senderId);
		}

		var pin = pins[0];
		pin.hash = __private.pin.cid(pin.hash, 0); // Show as cidv0

		return setImmediate(cb, null, pin);
	}).catch(function (err) {
		library.logger.error(err.stack);
		return setImmediate(cb, 'Pins#getMostRecentPin error');
	});
};

/**
 * Checks if `modules` is loaded.
 * @return {boolean} True if `modules` is loaded.
 */
Pins.prototype.isLoaded = function () {
	return !!modules;
};

/**
 * Calls helpers.sandbox.callMethod().
 * @implements module:helpers#callMethod
 * @param {function} call - Method to call.
 * @param {} args - List of arguments.
 * @param {function} cb - Callback function.
 */
Pins.prototype.sandboxApi = function (call, args, cb) {
	sandboxHelper.callMethod(this.shared, call, args, cb);
};

// Events
/**
 * Calls Pin.bind() with modules params.
 * @implements module:pins#Pin~bind
 * @param {modules} scope - Loaded modules.
 */
Pins.prototype.onBind = function (scope) {
	modules = {
		accounts: scope.accounts,
		system: scope.system,
		transactions: scope.transactions,
		locks: scope.locks
	};

	__private.pin.bind(
		scope.accounts,
		scope.system,
		scope.rounds,
		scope.transactions,
		scope.locks,
		self
	);
};

// Shared API
/**
 * @todo implement API comments with apidoc.
 * @see {@link http://apidocjs.com/}
 */
Pins.prototype.shared = {
	getFee: function (req, cb) {
		library.schema.validate(req.body, schema.getFee, function (err) {
			if (err) {
				return setImmediate(cb, err[0].message);
			}

			var f = modules.system.getFees(req.body.height);
			f.fee = {
				pin: f.fees.pin,
				unpin: f.fees.unpin
			};
			delete f.fees;
			return setImmediate(cb, null, f);
		});
	},
	verifyPin: function (req, cb) {
		library.schema.validate(req.body, schema.verifyPin, function (err) {
			if (err) {
				return setImmediate(cb, err[0].message);
			}

			self.getMostRecentPin(req.body.hash, req.body.senderId, function (err, transaction) {
				if (!transaction || err) {
					return setImmediate(cb, err);
				}

				if (transaction.type === transactionTypes.UNPIN) {
					return setImmediate(cb, 'Latest transaction type is unpin');
				}

				if (Math.round(transaction.bytes) != req.body.bytes) {
					return setImmediate(cb, 'Pin asset bytes does not match');
				}

				return setImmediate(cb, null, {pin: transaction});
			});
		});
	},
	getPinnedBytes: function (req, cb) {
		var replication = modules.locks.getReplication();

		library.schema.validate(req.body, schema.getPinnedBytes, function (err) {
			if (err) {
				return setImmediate(cb, err[0].message);
			}
			self.getPinnedBytes(req.body.publicKey, function (err, bytes) {
				if (err) {
					return setImmediate(cb, err);
				}

				return setImmediate(cb, null, {bytes: (bytes * replication)});
			});
		});
	},
	getTotalPinnedBytes: function (req, cb) {
		var replication = modules.locks.getReplication();

		self.getTotalPinnedBytes(function (err, bytes) {
			if (err) {
				return setImmediate(cb, err);
			}

			return setImmediate(cb, null, {bytes: (bytes * replication)});
		});
	},
	getPinsByParent: function (req, cb) {
		library.schema.validate(req.body, schema.getPinsByParent, function (err) {
			if (err) {
				return setImmediate(cb, err[0].message);
			}
			__private.getPinsByParent(req.body.id, req.body.type, function (err, transactions) {
				if (err) {
					return setImmediate(cb, err);
				}

				return setImmediate(cb, null, transactions);
			});
		});
	}
};

// Export
module.exports = Pins;
