'use strict';

const URLUtils = require('dw/web/URLUtils');
const Site = require('dw/system/Site');
const WorldlineDirectConstants = require('*/cartridge/scripts/worldline/direct/constants');
const worldlineDirectCommonHelper = require('*/cartridge/scripts/worldline/direct/commonHelper');

const currentSite = Site.getCurrent();

/**
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument Current Payment Instrument
 * @param {dw.order.Order} order Current Order
 * @class
 */
function WorldlineDirectHostedCheckoutSpecificInput(paymentInstrument, order) {
    this.isRecurring = false;
    this.locale = request.locale;
    this.showResultPage = false;
    this.returnUrl = URLUtils.https(WorldlineDirectConstants.HOSTED_CHECKOUT_RETURN_CONTROLLER, 'o', order.getOrderNo(), 'ot', order.getOrderToken()).toString();
    this.paymentProductFilters = {
        restrictTo: {
            products: [parseInt(paymentInstrument.custom.worldlineDirectPaymentProductID, 10)]
        }
    };

    let sessionTimeout = currentSite.getCustomPreferenceValue('worldlineDirectHCPSessionTimeout');

    this.sessionTimeout = !empty(sessionTimeout) ? parseInt(sessionTimeout) : 180;

    if ((empty(paymentInstrument.custom.worldlineDirectPaymentProductID) || paymentInstrument.custom.worldlineDirectPaymentProductID === 'null') 
        && worldlineDirectCommonHelper.isHCPGroupCardsEnabled()
    ) {
        this.paymentProductFilters = {
            restrictTo: {
                products: null,
                groups: ['cards']
            }
        };

        this.cardPaymentMethodSpecificInput = {
            groupCards : true
        };
    }

    if (!empty(currentSite.getCustomPreferenceValue('worldlineDirectHCPTemplate'))) {
        this.variant = currentSite.getCustomPreferenceValue('worldlineDirectHCPTemplate');
    }

    let tokens = worldlineDirectCommonHelper.getWalletPaymentIntsrumentTokensByPaymentProductId(paymentInstrument.custom.worldlineDirectPaymentProductID, session.customer);

    if (tokens.length) {
        this.tokens = tokens.join(',');
    }
}

module.exports = WorldlineDirectHostedCheckoutSpecificInput;
