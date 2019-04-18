'use strict';

var constants = require('../helpers/constants.js');

module.exports = {
	getFee: {
		id: 'locks.getFee',
		type: 'object',
		properties: {
			height: {
				type: 'integer',
				minimum: 1
			}
		}
	},
	calcLockBytes: {
		id: 'locks.calcLockBytes',
		type: 'object',
		properties: {
			amount: {
				type: 'integer',
				minimum: 0,
//				maximum: constants.fixedPoint
			}
		},
		required: ['amount']
	},
	calcUnlockBytes: {
		id: 'locks.calcUnlockBytes',
		type: 'object',
		properties: {
			publicKey: {
				type: 'string',
				format: 'publicKey'
			},
			amount: {
				type: 'integer',
				minimum: 0,
//				maximum: constants.fixedPoint
			}
		},
		required: ['publicKey', 'amount']
	},
	getLockedBalance: {
		id: 'locks.getLockedBalance',
		type: 'object',
		properties: {
			publicKey: {
				type: 'string',
				format: 'publicKey'
			}
		},
		required: ['publicKey']
	},
	getLockedBytes: {
		id: 'locks.getLockedBytes',
		type: 'object',
		properties: {
			publicKey: {
				type: 'string',
				format: 'publicKey'
			}
		},
		required: ['publicKey']
	},
	getClusterStats: {
		id: 'locks.getClusterStats',
		type: 'object',
		properties: {
			timestamp: {
				type: 'integer',
				minimum: 0,
				maximum: 8640000000000000
			}
		}
	},
	setClusterStats: {
		id: 'locks.setClusterStats',
		type: 'object',
		properties: {
			id: {
				type: 'integer',
				minimum: 1
			},
			locked_balance: {
				type: 'integer',
				minimum: 0,
			},
			locked_bytes: {
				type: 'integer',
				minimum: 0,
			},
			total_bytes: {
				type: 'integer',
				minimum: 0,
			},
			used_bytes: {
				type: 'integer',
				minimum: 0,
			},
			timestamp: {
				type: 'integer',
				minimum: 0,
				maximum: 8640000000000000
			}
		},
		required: ['id', 'total_bytes', 'timestamp']
	},
	getBlockStats: {
		id: 'locks.getBlockStats',
		type: 'object',
		properties: {
			timestamp: {
				type: 'integer',
				minimum: 0,
				maximum: 8640000000000000
			}
		},
		required: ['timestamp']
	}
};
