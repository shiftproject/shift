'use strict';

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
			id: {
				type: 'string',
				minLength: 1,
				maxLength: 20
			}
		}
	}
};
