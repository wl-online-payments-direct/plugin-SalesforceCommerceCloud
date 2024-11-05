'use strict';

const worldlineDirectSubscriptionHelper = require('*/cartridge/scripts/worldline/direct/subscriptionHelper');
const worldlineDirectConstants          = require('*/cartridge/scripts/worldline/direct/constants');

/**
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument Current Payment Instrument
 * @param {dw.order.Order} order Current Order
 * @class
 */
function WorldlineDirectSepaDirectPaymentMethodSpecificInput(paymentInstrument, order) {
    this.paymentProductId = parseInt(paymentInstrument.custom.worldlineDirectPaymentProductID, 10);

    if (parseInt(paymentInstrument.custom.worldlineDirectPaymentProductID) === worldlineDirectConstants.PAYMENT_PRODUCT_SEPA_DIRECT_DEBIT_ID) {
        this.paymentProduct771SpecificInput = {};

        if (order.custom.worldlineDirectSubscriptionOrderType.value === 'MIT') {
            this.paymentProduct771SpecificInput.existingUniqueMandateReference = paymentInstrument.custom.worldlineDirectMandateReference;
        } else { 
            let customer = session.getCustomer();
            let customerID = customer.authenticated && customer.profile ? customer.profile.customerNo : customer.ID;
        
            let language = request.locale.split("_")[0];
        
            let subscribtionData = worldlineDirectSubscriptionHelper.getSubscriptionData(order);
    
            this.paymentProduct771SpecificInput.mandate = {
                customerReference: customerID,
                recurrenceType: (subscribtionData.selected) ? "RECURRING" : "UNIQUE",
                signatureType: "SMS",
                language: language.toUpperCase()
            };
        }
    }
}

module.exports = WorldlineDirectSepaDirectPaymentMethodSpecificInput;
