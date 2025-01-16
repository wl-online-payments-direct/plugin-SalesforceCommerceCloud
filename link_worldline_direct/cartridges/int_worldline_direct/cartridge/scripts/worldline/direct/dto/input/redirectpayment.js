'use strict';

const Site = require('dw/system/Site');
const URLUtils = require('dw/web/URLUtils');

const WorldlineDirectConstants = require('*/cartridge/scripts/worldline/direct/constants');
const currentSite = Site.getCurrent();

/**
 * Transforms an order details into an API request object.
 * @param {dw.order.PaymentInstrument} paymentInstrument The current payment instrument
 * @param {dw.order.PaymentProcessor} paymentProcessor The current payment processor
 * @param {dw.order.Order} order The current order
 */
function WorldlineDirectRedirectPaymentMethodSpecificInput(paymentInstrument, paymentProcessor, order) {
    var returnURL = URLUtils.https(WorldlineDirectConstants.HOSTED_CHECKOUT_RETURN_CONTROLLER, 'o', order.getOrderNo(), 'ot', order.getOrderToken()).toString();
    if (paymentProcessor.ID === WorldlineDirectConstants.PAYMENT_METHOD_CREDIT_REDIRECT) {
        returnURL = URLUtils.https(WorldlineDirectConstants.HOSTED_TOKENIZATION_RETURN_CONTROLLER, 'o', order.getOrderNo(), 'ot', order.getOrderToken()).toString();
    }

    this.requiresApproval = !(currentSite.getCustomPreferenceValue('worldlineDirectOperationCode').getValue() === WorldlineDirectConstants.OPERATION_CODE_SALE);
    this.tokenize = false;
    this.paymentProductId = parseInt(paymentInstrument.custom.worldlineDirectPaymentProductID, 10);
    this.redirectionData = {
        returnUrl: returnURL
    };

    if (this.paymentProductId === WorldlineDirectConstants.PAYMENT_PRODUCT_BANK_TRANSFER_A2A) {
        this.paymentProduct5408SpecificInput = {
            instantPaymentOnly : !!currentSite.getCustomPreferenceValue('worldlineDirectA2AInstantPaymentOnly')
        };
    }
}

module.exports = WorldlineDirectRedirectPaymentMethodSpecificInput;
