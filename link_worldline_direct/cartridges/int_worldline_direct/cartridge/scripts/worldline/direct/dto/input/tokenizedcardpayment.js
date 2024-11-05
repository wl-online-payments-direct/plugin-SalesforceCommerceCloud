'use strict';

const Site = require('dw/system/Site');
const URLUtils = require('dw/web/URLUtils');
const WorldlineDirectConstants = require('*/cartridge/scripts/worldline/direct/constants');
const worldlineDirectSubscriptionHelper = require('*/cartridge/scripts/worldline/direct/subscriptionHelper');

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
    this.isRecurring = false;

    if (currentSite.getCustomPreferenceValue('worldlineDirect3DSEnforceSCA')) {
        this.threeDSecure.challengeIndicator = 'challenge-required';
    } else if(order.getCurrencyCode() === 'EUR' && order.getTotalGrossPrice().getValue() < 30 && currentSite.getCustomPreferenceValue('worldlineDirect3DSExemption')) {
        this.threeDSecure.exemptionRequest = 'low-value';
    }

    if (order.custom.worldlineDirectSubscriptionOrderType.value === 'CIT') {
        let subscribtionData = worldlineDirectSubscriptionHelper.getSubscriptionData(order);

        if (subscribtionData.selected) {
            this.threeDSecure.challengeIndicator = 'challenge-required';
            this.isRecurring = true;
            this.recurring = {
                recurringPaymentSequenceIndicator: 'first',
            };
        }
    } else if (order.custom.worldlineDirectSubscriptionOrderType.value === 'MIT') {
        this.initialSchemeTransactionId = order.custom.worldlineDirectSubscriptionInitialTransactionID;
        this.schemeReferenceData = paymentInstrument.custom.worldlineDirectCardSchemeReferenceData;
        this.isRecurring = true;
        this.recurring = {
            recurringPaymentSequenceIndicator: 'recurring',
        }
        this.threeDSecure.skipAuthentication = true;
        
        delete(this.threeDSecure.challengeIndicator);
    }
}

module.exports = WorldlineDirectCardPaymentMethodSpecificInput;
