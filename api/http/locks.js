'use strict';

var Router = require('../../helpers/router');
var httpApi = require('../../helpers/httpApi');

/**
 * Binds api with modules and creates common url.
 * - End point: `/api/locks`
 * - Public API:
 * 	- get	/fee
 * 	- get	/calcLock
 * 	- get	/calcUnlock
 * 	- get	/balance
 * 	- get	/bytes
 * 	- get	/totalBytes
 * 	- get	/stats
 * @memberof module:locks
 * @requires helpers/Router
 * @requires helpers/httpApi
 * @constructor
 * @param {Object} locksModule - Module locks instance.
 * @param {scope} app - Network app.
 */
// Constructor
function LocksHttpApi (locksModule, app, logger, cache) {

	var router = new Router();

	// attach a middleware to endpoints
	router.attachMiddlewareForUrls(httpApi.middleware.useCache.bind(null, logger, cache), []);

	router.map(locksModule.shared, {
		'get /fee': 'getFee',
		'get /calcLock': 'calcLockBytes',
		'get /calcUnlock': 'calcUnlockBytes',
		'get /balance': 'getLockedBalance',
		'get /bytes': 'getLockedBytes',
		'get /totalBytes': 'getTotalLockedBytes',
		'get /stats': 'getClusterStats'
	});

	httpApi.registerEndpoint('/api/locks', app, router, locksModule.isLoaded);
}

module.exports = LocksHttpApi;
