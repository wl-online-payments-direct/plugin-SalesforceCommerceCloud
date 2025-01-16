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

    if (this.paymentProductId === WorldlineDirectConstants.PAYMENT_PRODUCT_CARTES_BANCAIRES_ID) {
        let productQuantityTotal = order.getProductQuantityTotal();

        this.paymentProduct130SpecificInput = {
            threeDSecure: {
                usecase: ((this.authorizationMode === 'SALE') ? 'single-amount' : 'payment-upon-shipment'),
                numberOfItems: ((productQuantityTotal > 99) ? 99 : productQuantityTotal)
            }
        };
    }

    if (order.custom.worldlineDirectSubscriptionOrderType.value === 'MIT') {
        this.initialSchemeTransactionId = order.custom.worldlineDirectSubscriptionInitialTransactionID;
        this.schemeReferenceData = paymentInstrument.custom.worldlineDirectCardSchemeReferenceData;
        this.isRecurring = true;
        this.recurring = {
            recurringPaymentSequenceIndicator: 'recurring',
        }
        this.threeDSecure.skipAuthentication = true;

        if (this.paymentProductId === WorldlineDirectConstants.PAYMENT_PRODUCT_CARTES_BANCAIRES_ID) {
            this.paymentProduct130SpecificInput.threeDSecure.usecase = 'other-recurring-payments';
        }
        
        delete(this.threeDSecure.challengeIndicator);
    } else {
        let subscribtionData = worldlineDirectSubscriptionHelper.getSubscriptionData(order);

        if (subscribtionData.selected) {
            this.threeDSecure.challengeIndicator = 'challenge-required';
            this.isRecurring = true;
            this.recurring = {
                recurringPaymentSequenceIndicator: 'first',
            };

            if (this.paymentProductId === WorldlineDirectConstants.PAYMENT_PRODUCT_CARTES_BANCAIRES_ID) {
                this.paymentProduct130SpecificInput.threeDSecure.usecase = 'other-recurring-payments';
            }
        }
    }
}

module.exports = WorldlineDirectCardPaymentMethodSpecificInput;
