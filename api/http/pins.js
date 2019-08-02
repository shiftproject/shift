'use strict';

var Router = require('../../helpers/router');
var httpApi = require('../../helpers/httpApi');

/**
 * Binds api with modules and creates common url.
 * - End point: `/api/pins`
 * - Public API:
 * 	- get	/fee
 * 	- get	/bytes
 * 	- get	/totalBytes
 * 	- get	/verify
 * 	- get	/parent
 * @memberof module:pins
 * @requires helpers/Router
 * @requires helpers/httpApi
 * @constructor
 * @param {Object} pinsModule - Module pins instance.
 * @param {scope} app - Network app.
 */
// Constructor
function PinsHttpApi (pinsModule, app, logger, cache) {

	var router = new Router();

	// attach a middleware to endpoints
	router.attachMiddlewareForUrls(httpApi.middleware.useCache.bind(null, logger, cache), []);

	router.map(pinsModule.shared, {
		'get /fee': 'getFee',
		'get /bytes': 'getPinnedBytes',
		'get /totalBytes': 'getTotalPinnedBytes',
		'get /verify': 'verifyPin',
		'get /parent': 'getPinsByParent'
	});

	httpApi.registerEndpoint('/api/pins', app, router, pinsModule.isLoaded);
}

module.exports = PinsHttpApi;
