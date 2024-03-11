'use strict';

/**
 * @param {dw.order.OrderAddress} address Order Address
 * @class
 */
function WorldlineDirectPersonalName(address) {
    this.firstName = address.firstName;
    this.surname = address.lastName;

    if (!empty(address.title)) {
        this.title = address.title;
    }
}

module.exports = WorldlineDirectPersonalName;
