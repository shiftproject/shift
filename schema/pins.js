'use strict';

module.exports = {
	getFee: {
		id: 'pins.getFee',
		type: 'object',
		properties: {
			height: {
				type: 'integer',
				minimum: 1
			}
		}
	},
	verifyPin: {
		id: 'pins.verifyPin',
		type: 'object',
		properties: {
			hash: {
				type: 'string',
				minLength: 46,
				maxLength: 60
			},
			bytes: {
				type: 'integer',
				minimum: 1
			},
			senderId: {
				type: 'string',
				format: 'address',
				minLength: 1,
				maxLength: 22
			}
		},
		required: ['hash','bytes','senderId']
	},
	getPinnedBytes: {
		id: 'pins.getPinnedBytes',
		type: 'object',
		properties: {
			publicKey: {
				type: 'string',
				format: 'publicKey'
			},
		},
		required: ['publicKey']
	},
	getPinsByParent: {
		properties: {
			id: {
				type: 'string',
				format: 'id',
				minLength: 1,
				maxLength: 20
			}
		},
		required: ['id']
	}
};
