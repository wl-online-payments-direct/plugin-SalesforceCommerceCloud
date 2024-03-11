'use strict';

/**
 * @param {dw.order.Order} order The current order
 * @class
 */
function WorldlineDirectSepaDirectPaymentMethodSpecificInput(order) {
    var customer = session.getCustomer();
    var customerID = customer.authenticated && customer.profile ? customer.profile.customerNo : customer.ID;

    var language = request.locale.split("_")[0];

    this.paymentProduct771SpecificInput = {
        mandate: {
            customerReference: customerID,
            recurrenceType: "UNIQUE",
            signatureType: "SMS",
            language: language.toUpperCase()
        }
    };
}

module.exports = WorldlineDirectSepaDirectPaymentMethodSpecificInput;
