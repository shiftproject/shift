'use strict';

var constants = require('../helpers/constants.js');

// Private fields
var __private = {};

// Constructor
function BlockReward () {
	this.rewards = constants.rewards;
}

// Private methods
__private.parseHeight = function (height) {
	if (isNaN(height)) {
		throw 'Invalid block height';
	} else {
		return Math.abs(height);
	}
};

// Public methods
BlockReward.prototype.calcMilestone = function (height) {
	height = __private.parseHeight(height);

	for (var i=this.rewards.length-1; i>=0; i--)	{
		if (height>=this.rewards[i].height) {
			return i;
		}
	}
	return 0;
};

BlockReward.prototype.calcReward = function (height) {
	return this.rewards[this.calcMilestone(height)].reward;
};

BlockReward.prototype.calcSupply = function (height) {
	height = __private.parseHeight(height);

	var milestone = this.calcMilestone(height);
	var supply    = constants.totalAmount;
	var rewards   = [];

	var amount = 0;

	// sum up all completed milestonen
	for (var i = 0; i < milestone; i++) {
		amount = this.rewards[i+1].height-this.rewards[i].height;
		height -= amount;

		rewards.push([amount, this.rewards[i].reward]);
	}

	// add current milestone
	rewards.push([height, this.rewards[milestone].reward]);

	for (i = 0; i < rewards.length; i++) {
		var reward = rewards[i];
		supply += reward[0] * reward[1];
	}

	return supply;
};

// Export
module.exports = BlockReward;
