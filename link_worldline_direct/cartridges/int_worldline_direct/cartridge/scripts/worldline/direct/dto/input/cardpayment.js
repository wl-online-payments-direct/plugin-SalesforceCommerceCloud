'use strict';

const Site = require('dw/system/Site');
const currentSite = Site.getCurrent();
const WorldlineDirectConstants = require('*/cartridge/scripts/worldline/direct/constants');
const worldlineDirectSubscriptionHelper = require('*/cartridge/scripts/worldline/direct/subscriptionHelper');

/**
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument Current Payment Instrument
 * @param {dw.customer.Customer} customer Current Customer
 * @class
 */
function WorldlineDirectCardPaymentMethodSpecificInput(paymentInstrument, order) {
    this.authorizationMode = currentSite.getCustomPreferenceValue('worldlineDirectOperationCode').getValue();
    this.tokenize = !session.getCustomer().authenticated;
    this.transactionChannel = "ECOMMERCE";
    this.paymentProductId = parseInt(paymentInstrument.custom.worldlineDirectPaymentProductID, 10);

    if (this.paymentProductId === WorldlineDirectConstants.PAYMENT_PRODUCT_INTERSOLVE_ID) {
        this.authorizationMode = 'SALE';
    }

    if (!empty(paymentInstrument.custom.worldlineDirectSavedCardToken) && paymentInstrument.custom.worldlineDirectSavedCardToken !== "null") {
        this.token = paymentInstrument.custom.worldlineDirectSavedCardToken;
    }

    this.threeDSecure = {
        skipAuthentication: false
    };

    if (currentSite.getCustomPreferenceValue('worldlineDirect3DSEnforceSCA')) {
        this.threeDSecure.challengeIndicator = 'challenge-required';
    } else if(order.getCurrencyCode() === 'EUR' && order.getTotalGrossPrice().getValue() < 30 && 
        currentSite.getCustomPreferenceValue('worldlineDirect3DSExemption')
    ) {
        this.threeDSecure.exemptionRequest = 'low-value';
    }

    let subscribtionData = worldlineDirectSubscriptionHelper.getSubscriptionData(order);

    if (subscribtionData.selected) {
        this.threeDSecure.challengeIndicator = 'challenge-required';
        this.recurring = {
            recurringPaymentSequenceIndicator: 'first',
        };
        this.tokenize = true;
    }
}

module.exports = WorldlineDirectCardPaymentMethodSpecificInput;
