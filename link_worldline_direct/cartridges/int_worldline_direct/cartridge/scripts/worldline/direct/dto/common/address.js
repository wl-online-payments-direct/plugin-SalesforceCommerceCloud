'use strict';

const WeakMessageDigest = require('dw/crypto/WeakMessageDigest');
const Bytes = require('dw/util/Bytes');

/**
 * @param {dw.order.OrderAddress} address OrderAddress
 * @param {boolean} includePersonalName Include PersonalName Object
 * @class
 */
function WorldlineDirectAddress(address, includePersonalName) {
    this.additionalInfo = address.address2;
    this.city = address.city;
    this.countryCode = address.countryCode.value;
    this.street = address.address1;
    this.zip = address.postalCode;

    if (!empty(address.stateCode)) {
        this.state = address.stateCode;
    }

    if (!empty(address.suite)) {
        this.houseNumber = address.suite;
    }

    // implements the hash function before the personal name as it is not used on the billing address
    var msgDigest = new WeakMessageDigest(WeakMessageDigest.DIGEST_MD5);
    this.hash = msgDigest.digest(new Bytes(JSON.stringify(this))).toString();

    if (includePersonalName) {
        const WorldlineDirectPersonalName = require('*/cartridge/scripts/worldline/direct/dto/common/personalname');
        this.name = new WorldlineDirectPersonalName(address);
    }
}

module.exports = WorldlineDirectAddress;

