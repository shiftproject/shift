'use strict';

var constants = require('../helpers/constants.js');

// Private fields
var __private = {};

// Private methods
/**
 * Returns absolute value from number.
 * @private
 * @param {number} height
 * @return {number}
 * @throws Invalid block height
 */
__private.parseHeight = function (height) {
	if (!Number.isInteger(height) || height < 1) {
		throw 'Invalid block height';
	} else {
		return Math.abs(height);
	}
};

/**
 * @namespace
 */
module.exports = {
	locks: constants.locks,

	/**
	 * @implements {__private.parseHeight}
	 * @param {number} height
	 * @return {number}
	 */
	calcMilestone: function (height) {
		height = __private.parseHeight(height);

		for (var i=this.locks.length-1; i>=0; i--)	{
			if (height>=this.locks[i].height) {
				return i;
			}
		}
		return 0;
	},

	/**
	 * @implements {__private.parseHeight}
	 * @implements {LockSettings.calcMilestone}
	 * @param {number} height
	 * @return {number}
	 */
	calcCompensation: function (height, useBuffer) {
		if (useBuffer === undefined) {
			useBuffer = true;
		}

		var replication = this.locks[this.calcMilestone(height)].replication; // 3
		var conversion = 1 / replication; // 0.33

		if (useBuffer) {
			var buffer = this.calcBuffer(height);
			conversion = Math.round(conversion * buffer) / buffer; // 0.3
		}

		return conversion;
	},

	/**
	 * @implements {__private.parseHeight}
	 * @implements {LockSettings.calcMilestone}
	 * @param {number} height
	 * @return {number}
	 */
	calcRatioFactor: function (height) {
		return this.locks[this.calcMilestone(height)].ratioFactor;
	},

	/**
	 * @implements {__private.parseHeight}
	 * @implements {LockSettings.calcMilestone}
	 * @param {number} height
	 * @return {number}
	 */
	calcBuffer: function (height) {
		return this.locks[this.calcMilestone(height)].buffer;
	}
};
