'use strict';

const WorldlineDirectAddress = require('*/cartridge/scripts/worldline/direct/dto/common/address');
const WorldlineDirectPersonalName = require('*/cartridge/scripts/worldline/direct/dto/common/personalname');

/**
 * Creates Worldline-Direct CustomerDevice Object
 * containing information on the device and browser of the customer
 * @returns {Object} CustomerDevice Object
 */
function getCustomerDevice() {
    let customerDevice = {
        acceptHeader: request.getHttpHeaders().get('accept'),
        ipAddress: request.httpRemoteAddress,
        locale: request.httpLocale,
        userAgent: request.httpUserAgent
    };

    let browserDataStr = session.privacy.browserData;

    if (browserDataStr) {
        try {
            let browserData = JSON.parse(browserDataStr);
            let timezoneOffset = browserData.timezoneOffset;

            delete browserData.timezoneOffset;
            delete browserData.canMakeApplePayPayments;     // we only use this field locally, will not send it to the Worldline API

            browserData.javaScriptEnabled = true;

            customerDevice.browserData = browserData;
            customerDevice.timezoneOffsetUtcMinutes = timezoneOffset;
        } catch (e) {} // eslint-disable-line
    }

    return customerDevice;
}


/**
 * Creates Worldline-Direct PersonalInformation Object
 * containing personal information like name, date of birth and gender
 * @param {dw.order.OrderAddress} address Billing Address
 * @returns {Object} PersonalInformation Object
 */
function getPersonalInformation(address) {
    return {
        name: new WorldlineDirectPersonalName(address)
    };
}

/**
 * Creates Worldline-Direct ContactDetails Object
 * containing contact details like email address and phone number
 * @param {dw.order.LineItemCtnr} order Current order
 * @param {dw.order.OrderAddress} address Billing Address
 * @returns {Object} ContactDetails Object
 */
function getContactDetails(order, address) {
    return {
        emailAddress: order.customerEmail,
        phoneNumber: address.phone.replace(/\s+/g,'').substring(0, 15)
    };
}

/**
 * @param {dw.order.LineItemCtnr} order Current order
 * @class
 */
function WorldlineDirectCustomer(order) {
    let customer = session.getCustomer();
    let billingAddress = order.getBillingAddress();

    if (!empty(billingAddress.companyName)) {
        this.companyInformation = { name: billingAddress.companyName };
    }

    this.merchantCustomerId = customer.authenticated ? customer.profile.customerNo : customer.ID;
    this.accountType = customer.authenticated ? 'existing' : 'none';
    this.locale = request.locale;

    this.device = getCustomerDevice();
    this.contactDetails = getContactDetails(order, billingAddress);
    this.personalInformation = getPersonalInformation(billingAddress);

    this.billingAddress = new WorldlineDirectAddress(billingAddress);
}

module.exports = WorldlineDirectCustomer;
