'use strict';

const StringUtils = require('dw/util/StringUtils');
const LinkedHashMap = require('dw/util/LinkedHashMap');
const Mac = require('dw/crypto/Mac');

const WorldlineService = require('*/cartridge/scripts/service/worldlineService');
const WorldlineDirectConstants = require('*/cartridge/scripts/worldline/direct/constants');

const currentSite = require('dw/system/Site').getCurrent();
var worldlineService = null;

const Logger = require('dw/system/Logger');
const logger = Logger.getRootLogger();

/**
 *  Returns Worldline-Direct Service
 *  @returns {dw.svc.LocalServiceRegistry} worldlineService Worldline-Direct Service
 */
function getService() {
    if (worldlineService == null) {
        worldlineService = new WorldlineService(currentSite.ID);
    }

    return worldlineService;
}

/**
 *  Returns Worldline-Direct Service Credentials
 *  @returns {Object} worldlineService Worldline-Direct Service Credentials
 */
function getWorldlineServiceCredentials() {
    var service = getService();

    return {
        apiHost: service.configuration.credential.URL,
        apiKey: service.configuration.credential.user,
        apiSecret: service.configuration.credential.password,
        merchantID: currentSite.getCustomPreferenceValue('worldlineDirectMerchantID')
    };
}

/**
 *  Returns sorted context headers
 *  @param {dw.util.LinkedHashMap} gcsHeaders Worldline-Direct context headers
 *  @returns {string} headers Sorted context headers
 */
function getSortedHeadersForContext(gcsHeaders) {
    var headers = '';
    if (gcsHeaders) {
        var sortedXGCSHeaders = [];
        var gcsHeadersKeys = gcsHeaders.keySet().iterator();
        while (gcsHeadersKeys.hasNext()) {
            var key = gcsHeadersKeys.next();
            if (key.toUpperCase().indexOf('X-GCS') === 0) {
                sortedXGCSHeaders.push({ key: key, value: gcsHeaders.get(key) });
            }
        }

        sortedXGCSHeaders = sortedXGCSHeaders.sort(function (a, b) {
            a.key = a.key.toUpperCase();
            b.key = b.key.toUpperCase();
            if (a.key < b.key) {
                return -1;
            }
            if (a.key > b.key) {
                return 1;
            }
            return 0;
        });
        sortedXGCSHeaders.forEach(function (header) {
            headers += header.key.toLowerCase() + ':' + header.value + "\n";
        });
    }
    return headers;
}

/**
 *  Signs data using HMAC256 algorithm
 *  @param {string} dataToSign Data to sign
 *  @param {string} secretKey Secret key
 *  @returns {string} signature Encrypted Request Signature
 */
function signedDataUsingHMAC256(dataToSign, secretKey) {
    var mac = new Mac(Mac.HMAC_SHA_256);
    var signature;

    if (!empty(dataToSign) && !empty(secretKey)) {
        signature = dw.crypto.Encoding.toBase64(mac.digest(new dw.util.Bytes(dataToSign, "UTF-8"), new dw.util.Bytes(secretKey, "UTF-8")));
    }

    return signature;
}

/**
 *  Returns Encrypted Request Signature
 *  @param {string} method HTTP Method
 *  @param {string} path HTTP Request past
 *  @param {dw.util.LinkedHashMap} headers HTTP Request headers
 *  @param {string} secretApiKey Worldline-Direct Service Secret Key
 *  @returns {string} signedDataUsingHMAC256 Encrypted Request Signature
 */
function getRequestSignature(method, path, headers, secretApiKey) {
    const date = headers.get('Date');
    const sortedGCSHeaders = getSortedHeadersForContext(headers);
    var contentType = '';
    if (method === 'POST' || method === 'PUT') {
        contentType = headers.get('Content-Type');
    }

    var dataToSign = method + "\n" + contentType + "\n" + date + "\n" + sortedGCSHeaders + path + "\n";

    logger.debug(dataToSign);

    return signedDataUsingHMAC256(dataToSign, secretApiKey);
}

/**
 *  Prepares Worldline-Direct ServerMetaInfo Header
 *  @returns {Object} info ServerMetaInfo Header Object
 */
function serverMetaInfo() {
    const System = require('dw/system/System');
    const Resource = require('dw/web/Resource');

    var isRequestFromBusinessManager = Resource.msg('global.version.number', 'version', null) === "global.version.number";

    var serverMetaInfoObj = {
        sdkCreator: 'Greenlight Commerce',
        sdkIdentifier: 'SFCC-B2C-SFRA/v' + Resource.msg('worldline.direct.sdk.version.number', 'version', null),
        platformIdentifier: 'Salesforce B2C Commerce Cloud v' + System.getCompatibilityMode(),
        shoppingCartExtension: {
            extensionId: currentSite.ID,
            name: currentSite.name,
            version: isRequestFromBusinessManager
                ? "BM/" + System.compatibilityMode
                : "SFRA/v" + Resource.msg('global.version.number', 'version', null)
        }
    };

    var systemIntegator = Resource.msg('worldline.direct.sdk.integrator', 'version', null);

    if (systemIntegator !== 'YOUR_COMPANY_NAME') {
        serverMetaInfoObj.integrator = systemIntegator;
    }

    return {
        key: 'X-GCS-ServerMetaInfo',
        value: StringUtils.encodeBase64(JSON.stringify(serverMetaInfoObj))
    };
}

/**
 *  Prepares request headers
 *  @param {Array} gcsHeaders Worldline-Direct context headers array
 *  @returns {dw.util.LinkedHashMap} headers HTTP Request Headers
 */
function prepareRequestHeaders(gcsHeaders) {
    if (typeof (gcsHeaders) == 'undefined') {
        gcsHeaders = [];
    }

    const serverMetaInfoStr = serverMetaInfo();
    gcsHeaders.push(serverMetaInfoStr);

    var headers = new LinkedHashMap();
    headers.put("Date", (new Date()).toUTCString());
    headers.put("Content-Type", "application/json");
    gcsHeaders.forEach(function (gcsHeader) {
        headers.put(gcsHeader.key, gcsHeader.value);
    });

    return headers;
}

/**
 *  Creates Authorization Header using Secret key and Signature
 *  @param {string} method HTTP Method
 *  @param {string} path HTTP Request past
 *  @param {dw.util.LinkedHashMap} headers HTTP Request headers
 *  @param {Object} credentials Worldline-Direct service credentials
 *  @returns {string} authHeader Authorization Header
 */
function prepareAuthorizationHeader(method, path, headers, credentials) {
    return "GCS v1HMAC:" + credentials.apiKey + ':' + getRequestSignature(method, path, headers, credentials.apiSecret);
}

/**
 *  Prepares the Request Object which is used in Worldline-Direct Service
 *  @param {string} method HTTP Method
 *  @param {string} path HTTP Request past
 *  @param {Array} gcsHeaders HTTP Request headers
 *  @param {Object} qsObject QueryString object
 *  @returns {Object} serviceRequest Service Request Object
 */
function prepareRequestObject(method, path, gcsHeaders, qsObject) {
    const credentials = getWorldlineServiceCredentials();
    var headers = prepareRequestHeaders(gcsHeaders);
    var qsArray = [];

    path = path.replace('{{merchantId}}', credentials.merchantID);

    if (!empty(qsObject)) {
        Object.keys(qsObject).forEach(function (key) {
            qsArray.push(encodeURIComponent(key) + '=' + encodeURIComponent(qsObject[key]));
        });

        if (!empty(qsArray)) {
            path = path + '?' + qsArray.join('&');
        }
    }

    headers.put("Authorization", prepareAuthorizationHeader(method, path, headers, credentials));
    // body preparation goes here
    return {
        method: method,
        url: credentials.apiHost + path,
        headers: headers,
        body: {}
    };
}

/**
 *  Returns prefixed URL
 *  @param {string} responseUrl URL to be prefixed
 *  @returns {string} url Prefixed URL
 */
function prefixResponseUrl(responseUrl) {
    return WorldlineDirectConstants.PAYMENT_URL_PREFIX + responseUrl;
}

module.exports = {
    prepareRequestObject: prepareRequestObject,
    getService: getService,
    prefixResponseUrl: prefixResponseUrl
};
