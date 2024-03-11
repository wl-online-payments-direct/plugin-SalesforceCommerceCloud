'use strict';

/**
 * Constant-time comparison algorithm to prevent timing attacks.
 * Taken from Worldline's NodeJS SDK:
 * https://github.com/Worldline/direct-sdk-nodejs/blob/master/src/webhooks/index.js
 * https://github.com/vadimdemedes/secure-compare/blob/master/index.js
 *
 * @param {string} a First string
 * @param {string} b Second string
 * @returns {boolean} Whether the two strings match
 */
function compare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;

    var mismatch = a.length === b.length ? 0 : 1;
    if (mismatch) {
        b = a;
    }

    for (var i = 0, il = a.length; i < il; ++i) {
        mismatch |= (a.charCodeAt(i) ^ b.charCodeAt(i));
    }

    return mismatch === 0;
}

/**
 * Checks whether the provided signature is valid.
 *
 * @param {string} body The request body as string
 * @param {string} keyId the webhooks key id
 * @param {string} keySecret the webhooks secret key
 * @param {string} providedKeyId the key id that is passed to the request
 * @param {string} providedSignature the signature that is passed to the request
 * @returns {boolean} Whether the signature is valid
 */
function validateSignature(body, keyId, keySecret, providedKeyId, providedSignature) {
    if (!compare(keyId, providedKeyId)) {
        return false;
    }

    var mac = new dw.crypto.Mac(dw.crypto.Mac.HMAC_SHA_256);
    const expectedSignature = dw.crypto.Encoding.toBase64(mac.digest(new dw.util.Bytes(body, "UTF-8"), new dw.util.Bytes(keySecret, "UTF-8")));

    if (compare(expectedSignature, providedSignature)) {
        return true;
    }

    return false;
}

exports.validateSignature = validateSignature;
