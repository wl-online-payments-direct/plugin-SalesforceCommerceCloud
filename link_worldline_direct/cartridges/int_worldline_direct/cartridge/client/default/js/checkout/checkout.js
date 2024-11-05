'use strict';

var billingHelpers = require('./billing');
var summaryHelpers = require('./summary');
var base = require('base/checkout/checkout');

[billingHelpers, summaryHelpers].forEach(function (library) {
    Object.keys(library).forEach(function (item) {
        if (typeof library[item] === 'object') {
            exports[item] = $.extend({}, exports[item], library[item]);
        } else {
            exports[item] = library[item];
        }
    });
});

base.enableButton = function() {
    var checkoutStage = $("#checkout-main").attr('data-checkout-stage');
    var checkbox = $("#wlSubscriptionReplenishOrderConsent");
    if ((checkoutStage == 'placeOrder') && checkbox.length) {
        if(!checkbox.is(':checked')) {
            $('body').trigger('checkout:disableButton', '.next-step-button button.place-order');
        }
    }
    
    $('body').on('checkout:enableButton', (e, button) => {
        checkoutStage = $("#checkout-main").attr('data-checkout-stage');
        if (((checkoutStage == 'placeOrder') || (checkoutStage == 'payment')) && checkbox.length) {
            if(!checkbox.is(':checked')) {
            	$('.next-step-button button.submit-payment').prop('disabled', false);
            	$('.next-step-button button.place-order').prop('disabled', true);
                return;
            }
            $(button).prop('disabled', false);
        }
            
        $(button).prop('disabled', false);
    });
}

module.exports = base;
