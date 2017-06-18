'use strict';

module.exports = {
	currentVersion: '6.4.1',
	minVersion: [
		{ height: 1,      ver: '^6.1.0'},
		{ height: 600000, ver: '^6.3.0'}
	],
	activeDelegates: 101,
	addressLength: 208,
	blockHeaderLength: 248,
	blockTime: 27000,
	blockReceiptTimeOut: 27*2, // 2 blocks
	confirmationLength: 77,
	epochTime: new Date(Date.UTC(2016, 4, 24, 17, 0, 0, 0)),
	fees: {
		send: 10000000,
		vote: 100000000,
		secondsignature: 500000000,
		delegate: 6000000000,
		multisignature: 500000000,
		dapp: 2500000000
	},
	feeStart: 1,
	feeStartVolume: 10000 * 100000000,
	fixedPoint: Math.pow(10, 8),
	maxAddressesLength: 208 * 128,
	maxAmount: 100000000,
	maxConfirmations: 77 * 100,
	maxPayloadLength: 1024 * 1024,
	maxPeers: 100,
	maxRequests: 10000 * 12,
	maxSharedTxs: 100,
	maxSignaturesLength: 196 * 256,
	maxTxsPerBlock: 25,
	minBroadhashConsensus: 51,
	nethashes: [
		// Mainnet
		'7337a324ef27e1e234d1e9018cacff7d4f299a09c2df9be460543b8f7ef652f1',
		// Testnet
		'cba57b868c8571599ad594c6607a77cad60cf0372ecde803004d87e679117c12'
	],
	numberLength: 100000000,
	requestLength: 104,
	rewards: [
		{ height: 1,        reward: 0},
		{ height: 10,       reward: 100000000},
		{ height: 11,       reward: 30000000},
		{ height: 12,       reward: 20000000},
		{ height: 13,       reward: 100000000},
		{ height: 640000,   reward: 110000000},
		{ height: 1808000,  reward: 90000000},
		{ height: 2976000,  reward: 70000000},
		{ height: 4144000,  reward: 50000000},
		{ height: 5312000,  reward: 30000000},
	],
	signatureLength: 196,
	totalAmount: 1009000000000000,
	unconfirmedTransactionTimeOut: 10800 // 1080 blocks
};
