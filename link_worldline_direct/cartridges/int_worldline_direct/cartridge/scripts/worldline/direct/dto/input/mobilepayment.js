'use strict';

const Site = require('dw/system/Site');
const currentSite = Site.getCurrent();

/**
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument Current Payment Instrument
 * @class
 */
function WorldlineDirectMobilePaymentMethodSpecificInput(paymentInstrument) {
    this.authorizationMode = currentSite.getCustomPreferenceValue('worldlineDirectOperationCode').getValue();
    this.paymentProductId = parseInt(paymentInstrument.custom.worldlineDirectPaymentProductID, 10);
}

module.exports = WorldlineDirectMobilePaymentMethodSpecificInput;
