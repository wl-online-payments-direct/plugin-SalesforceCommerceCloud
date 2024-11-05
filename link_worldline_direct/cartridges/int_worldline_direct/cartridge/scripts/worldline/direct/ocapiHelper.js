'use strict';

const Site = require('dw/system/Site');
const StringUtils = require('dw/util/StringUtils');

OcapiHelper.prototype.getAccessToken = function () {
	let now = new Date();
	let dwAccessToken = this.token || null;
	let dwAccessTokenExpiry = this.accessTokenExpiry || now;
	let tokenExpired = (dwAccessTokenExpiry - now) < 0;
	let credentialsArray = [this.username, this.agentKey, this.clientSecret];
	let credentials = credentialsArray.join(':');
	
	if (!dwAccessToken || tokenExpired ) {
		let requestHeaders = {
	        "Authorization": "Basic " + StringUtils.encodeBase64(credentials),
	        "Accept": "*/*",
	        "Content-Type": "application/x-www-form-urlencoded"
	    };
		
		var endPoint = "/dw/oauth2/access_token?client_id=" + this.clientId;
		
		var params = [{name: "grant_type", value: "urn:demandware:params:oauth:grant-type:client-id:dwsid:dwsecuretoken"}];
		
		var result = this.executeRequest(endPoint, 'POST', requestHeaders, null, params);
		
		if ((result.error == 0) && (result.ok == true)) {
			now = new Date();
			this.token = result.object.access_token;
			this.accessTokenExpiry = (now.getTime()) + result.object.expires_in;
			return this.token;
		}
		
		return null;
	}
	
	return this.token;
}

OcapiHelper.prototype.executeRequest = function(endPoint, method, headers, body, params) {
	var service = this.service.getService();
	
	if (this.serviceURL == null) {
		this.serviceURL = service.getURL();
	}
	service.setURL(this.serviceURL + endPoint);
	service.setRequestMethod(method);
	
	var headerKeys = Object.keys(headers);
	var headersLength = headerKeys.length;
	for (var i = 0; i < headersLength; i++) {
		service.addHeader(headerKeys[i], headers[headerKeys[i]]);
	}
	
	if (params) {
		var len = params.length;
		for (var i = 0; i < len; i++) {
			service.addParam(params[i].name, params[i].value);
		}
	}
	
	if (body) {
		var result = service.call(body);
	} else {
		var result = service.call({});
	}
	
	if ((result.error == 0) && (result.status == 'OK')) {
		return result;
	}
	
	throw new Error(result);
}

OcapiHelper.prototype.createBasket = function (basketObject) {
	var token = this.getAccessToken();
	if (token != null) {
		if (this.siteID == null) {
			this.siteID = Site.getCurrent().ID;
		}
		var endPoint = '/s/' + this.siteID + '/dw/shop/v24_1/baskets';
		let requestHeaders = {
	        'Authorization': 'Bearer ' + token,
	        'Accept': '*/*',
	        'Content-Type': 'application/json',
	    };
		
		return this.executeRequest(endPoint, "POST", requestHeaders, basketObject);
	}
	return null;
}

OcapiHelper.prototype.createOrder = function (basketID) {
	var token = this.getAccessToken();
	if (token != null) {
		if (this.siteID == null) {
			this.siteID = Site.getCurrent().ID;
		}
		var endPoint = '/s/' + this.siteID + '/dw/shop/v24_1/orders';
		let requestHeaders = {
	        'Authorization': 'Bearer ' + token,
	        'Accept': '*/*',
	        'Content-Type': 'application/json',
	    };
		
		return this.executeRequest(endPoint, "POST", requestHeaders, {"basket_id": basketID});
	}
	return null;
}

OcapiHelper.prototype.addPaymentInstrument = function (orderNo, paymentInstrumentID, paymentInstrumentObject) {
	var token = this.getAccessToken();
	if (token != null) {
		if (this.siteID == null) {
			this.siteID = Site.getCurrent().ID;
		}
		var endPoint = '/s/' + this.siteID + '/dw/shop/v24_1/orders/' + orderNo + '/payment_instruments/' + paymentInstrumentID;
		let requestHeaders = {
	        'Authorization': 'Bearer ' + token,
	        'Accept': '*/*',
	        'Content-Type': 'application/json',
	    };
		
		return this.executeRequest(endPoint, "PATCH", requestHeaders, paymentInstrumentObject);
	}
	return null;
}

function OcapiHelper(service, credentials) {
	this.username = credentials.username;
	this.agentKey = credentials.agentKey;
	this.clientSecret = credentials.clientSecret;
	this.clientId = credentials.clientId;
	this.service = service;
	
	this.serviceURL;
	this.accessTokenExpiry;
	this.token;
	this.siteID;
}

module.exports = OcapiHelper;