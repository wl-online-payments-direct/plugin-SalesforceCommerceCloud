'use strict';

const Site = require('dw/system/Site');
const URLUtils = require('dw/web/URLUtils');
const WorldlineDirectConstants = require('*/cartridge/scripts/worldline/direct/constants');

const currentSite = Site.getCurrent();

/**
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument Current Payment Instrument
 * @param {dw.order.Order} order Current Order
 * @class
 */
function WorldlineDirectCardPaymentMethodSpecificInput(paymentInstrument, order) {
    this.authorizationMode = currentSite.getCustomPreferenceValue('worldlineDirectOperationCode').getValue();
    this.tokenize = false;
    this.transactionChannel = "ECOMMERCE";
    this.paymentProductId = parseInt(paymentInstrument.custom.worldlineDirectPaymentProductID, 10);
    this.token = paymentInstrument.creditCardToken;
    this.returnUrl = URLUtils.https(WorldlineDirectConstants.HOSTED_TOKENIZATION_RETURN_CONTROLLER, 'o', order.getOrderNo(), 'ot', order.getOrderToken()).toString();
    this.threeDSecure = {
        skipAuthentication: false,
        redirectionData: {
            returnUrl: URLUtils.https(WorldlineDirectConstants.HOSTED_TOKENIZATION_RETURN_CONTROLLER, 'o', order.getOrderNo(), 'ot', order.getOrderToken()).toString()
        }
    };

    if (currentSite.getCustomPreferenceValue('worldlineDirect3DSEnforceSCA')) {
        this.threeDSecure.challengeIndicator = 'challenge-required';
    } else if(order.getCurrencyCode() === 'EUR' && order.getTotalGrossPrice().getValue() < 30 && 
        currentSite.getCustomPreferenceValue('worldlineDirect3DSExemption')
    ) {
        this.threeDSecure.exemptionRequest = 'low-value';
    }
}

module.exports = WorldlineDirectCardPaymentMethodSpecificInput;
