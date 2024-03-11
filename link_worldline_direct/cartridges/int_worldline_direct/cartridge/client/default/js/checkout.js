'use strict';

var processInclude = require('base/util');

$(document).ready(function () {
    processInclude(require('./checkout/checkout'));
    processInclude(require('./checkout/worldline-direct/browserdata'));
    processInclude(require('./checkout/worldline-direct/hostedtokenization'));
    processInclude(require('./checkout/worldline-direct/hostedcheckout'));

    // updates the list of payment methods once the shipping page is submitted
    // this is used to remove payment methods which may not be applicable for the current browser, such as Apple Pay
    $("body").on("checkout:updateCheckoutView", (e, data) => {
        const applicablePaymentMethodIds = [];

        for (const pm of data.order.billing.payment.applicablePaymentMethods) {
            applicablePaymentMethodIds.push(pm.ID);
        }

        const paymentMethodTabs = $(".payment-options").find(".nav-item");
        for (const tab of paymentMethodTabs) {
            const $tab = $(tab);
            const methodId = $tab.data("method-id");

            if (applicablePaymentMethodIds.indexOf(methodId) === -1) {
                $tab.remove();
            }
        }
    });
});
