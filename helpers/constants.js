'use strict';

/**
 * @namespace constants
 * @memberof module:helpers
 * @property {number} activeDelegates - The default number of delegates.
 * @property {number} addressLength - The default address length.
 * @property {number} blockHeaderLength - The default block header length.
 * @property {number} blockSlotWindow - Max window in which a slot could be accepted
 * @property {number} blockTime
 * @property {number} blockReceiptTimeOut
 * @property {object} blockVersion - Block format version
 * @property {number} confirmationLength
 * @property {Date} epochTime
 * @property {object} fees - The default values for fees.
 * @property {number[]} fees.height
 * @property {number} fees.send
 * @property {number} fees.vote
 * @property {number} fees.secondsignature
 * @property {number} fees.delegate
 * @property {number} fees.multisignature
 * @property {number} fees.dapp
 * @property {number} fees.lock
 * @property {number} fees.unlock
 * @property {number} fees.pin
 * @property {number} fees.unpin
 * @property {number} feeStart
 * @property {number} feeStartVolume
 * @property {number} fixedPoint
 * @property {number} maxAddressesLength
 * @property {number} maxAmount
 * @property {number} maxConfirmations
 * @property {number} maxPayloadLength
 * @property {number} maxPeers
 * @property {number} maxRequests
 * @property {number} maxSharedTxs
 * @property {number} maxSignaturesLength
 * @property {number} maxTxsPerBlock
 * @property {number} minBroadhashConsensus
 * @property {string[]} nethashes - Mainnet and Testnet.
 * @property {number} numberLength
 * @property {number} requestLength
 * @property {object} rewards
 * @property {number[]} rewards.milestones - Initial 5, and decreasing until 1
 * @property {number} rewards.offset - Start rewards at block (n).
 * @property {number} rewards.distance - Distance between each milestone
 * @property {object} locks
 * @property {number[]} locks.height
 * @property {number} blockStatsInterval - Save cluster stats each x blocks
 * @property {number} locks.replication - The amount of locations the cluster will pin the data to
 * @property {number} locks.ratioFactor - Used to tune the shift-to-bytes ratio
 * @property {number} locks.buffer - Percentage for a safe buffer the network has available and the sum of all locks would ask
 * @property {number} maxRemovalMarks - The amount of offline states it takes before the peer is removed from the list
 * @property {number} lookupPerIterations - How many blocks it will take to lookup new storage peers
 * @property {number} clusterTolerance - Percentage the cluster size in a received block may differ from the memtable
 * @property {number} signatureLength
 * @property {number} totalAmount
 * @property {number} unconfirmedTransactionTimeOut - 1080 blocks
 */
module.exports = {
	currentVersion: '7.2.0t',
	minVersion: [
		{ height: 1,      ver: '^6.0.1t'},
		{ height: 370000, ver: '^6.3.0t'},
		{ height: 640000, ver: '^6.5.0t'},
		{ height: 1617500, ver: '^6.8.0t'},
		{ height: 2700000, ver: '>=6.8.0'},
		{ height: 2725930, ver: '>6.9.0'},
		{ height: 2924610, ver: '^7.0.0'},
		{ height: 2954429, ver: '^7.1.0'}
	],
	activeDelegates: 101,
	addressLength: 208,
	blockHeaderLength: 248,
	blockSlotWindow: 5,
	blockTime: 27000,
	blockReceiptTimeOut: 27 * 2, // 2 blocks
	blockVersion: [
		{ height: 1, ver: 0},
		{ height: 2924610, ver: 1}
	],
	confirmationLength: 77,
	epochTime: new Date(Date.UTC(2016, 4, 24, 17, 0, 0, 0)),
	fees: [
		{
			height: 1,
			fees: {
				send: 10000000,		// 0.1
				vote: 100000000,	// 1
				secondsignature: 500000000,	// 5
				delegate: 6000000000,	// 60
				multisignature: 500000000, // 5
				dapp: 2500000000	// 25
			}
		},
		{
			height: 640000,
			fees: {
				send: 1000000,		// 0.01
				vote: 100000000,	// 1
				secondsignature: 10000000,	// 0.1
				delegate: 6000000000,	// 60
				multisignature: 50000000, // 0.5
				dapp: 2500000000	//25
			}
		},
		{
			height: 2725930,
			fees: {
				send: 1000000,		// 0.01
				vote: 100000000,	// 1
				secondsignature: 10000000,	// 0.1
				delegate: 6000000000,	// 60
				multisignature: 50000000, // 0.5
				dapp: 2500000000,	// 25
				lock: 100000000,	// 1
				unlock: 100000000,	// 1
				pin: 1000000,		// 0.01
				unpin: 0		// 0
			}
		}
	],
	fixedPoint: Math.pow(10, 8),
	maxAddressesLength: 208 * 128,
	maxAmount: 100000000,
	maxConfirmations: 77 * 100,
	maxPayloadLength: 1024 * 1024,
	maxPeers: 50,
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
	teamAccounts: [
		// Mainnet
		'69844b687d92e831625e01e30c7b532a2d330a3727e0db2e59be3891cf0dc551',
		// Testnet
		'6d90dfdc4be3861b9fa3374a2d839bae6aa3aada3cc37de145cf29f44ab4cb99'
	],
	rewards: [
		{ height: 1,        reward: 0,         salary: 0 },
		{ height: 10,       reward: 100000000, salary: 0 },
		{ height: 11,       reward: 30000000,  salary: 0 },
		{ height: 12,       reward: 20000000,  salary: 0 },
		{ height: 13,       reward: 100000000, salary: 0 },
		{ height: 640000,   reward: 110000000, salary: 0 },
		{ height: 1617500,  reward: 100000000, salary: 10000000 },
		{ height: 3164000,  reward: 90000000,  salary: 10000000 },
		{ height: 4332000,  reward: 80000000,  salary: 9000000 }
	],
	locks: [
		{ height: 1, replication: 3, ratioFactor: 100, buffer: 10 }
	],
	blockStatsInterval: 10,
	maxRemovalMarks: 5,
	lookupPerIterations: 3,
	clusterTolerance: 5,
	signatureLength: 196,
	totalAmount: 1009000000000000,
	unconfirmedTransactionTimeOut: 10800 // 1080 blocks
};
