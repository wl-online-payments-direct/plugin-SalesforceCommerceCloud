'use strict';

var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');

function WorldlineOCAPIService() {

	this.worldlineHttpFormOCAPI = LocalServiceRegistry.createService("worldline.httpform.ocapi", {
	    createRequest: function(svc: HTTPService, args) {
	                
	        return JSON.stringify(args);
	    },
	    
	    parseResponse: function(svc: HTTPService, client: HTTPClient) {
	        var result = client.text;
	        try {
	            result = JSON.parse(result);
	        } catch ( е ) {
	        }
	        return result;
	    }
	});
}

WorldlineOCAPIService.prototype.getService = function() {
	return this.worldlineHttpFormOCAPI;
}

module.exports = WorldlineOCAPIService;