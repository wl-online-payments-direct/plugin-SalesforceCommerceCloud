'use strict';

var base = require('base/checkout/billing');
var cleave = require('base/components/cleave');

/**
 * Validate and update payment instrument form fields
 * @param {Object} order - the order model
 */
base.methods.validateAndUpdateBillingPaymentInstrument = function (order) {
    var billing = order.billing;
    if (!billing.payment || !billing.payment.selectedPaymentInstruments
        || billing.payment.selectedPaymentInstruments.length <= 0) return;

    var form = $('form[name=dwfrm_billing]');
    if (!form) return;

    var instrument = billing.payment.selectedPaymentInstruments[0];

    if (instrument.paymentMethod === 'CREDIT_CARD') {
        $('select[name$=expirationMonth]', form).val(instrument.expirationMonth);
        $('select[name$=expirationYear]', form).val(instrument.expirationYear);
        // Force security code and card number clear
        $('input[name$=securityCode]', form).val('');
        $('input[name$=cardNumber]').data('cleave').setRawValue('');
    }
};

/**
 * Updates the payment information in checkout, based on the supplied order model
 * @param {Object} order - checkout model to use as basis of new truth
 */
base.methods.updatePaymentInformation = function (order) {
    // update payment details
    var $paymentSummary = $('.payment-details');
    var htmlToAppend = '';

    if (order.billing.payment && order.billing.payment.selectedPaymentInstruments
        && order.billing.payment.selectedPaymentInstruments.length > 0) {
        if (order.billing.payment.selectedPaymentInstruments[0].paymentMethod === 'CREDIT_CARD') {
            htmlToAppend += '<span>' + order.resources.cardType + ' '
                + order.billing.payment.selectedPaymentInstruments[0].type
                + '</span><div>'
                + order.billing.payment.selectedPaymentInstruments[0].maskedCreditCardNumber
                + '</div><div><span>'
                + order.resources.cardEnding + ' '
                + order.billing.payment.selectedPaymentInstruments[0].expirationMonth
                + '/' + order.billing.payment.selectedPaymentInstruments[0].expirationYear
                + '</span></div>';
        } else if (order.billing.payment.selectedPaymentInstruments[0].paymentMethod === 'WORLDLINE_DIRECT_REDIRECT' || order.billing.payment.selectedPaymentInstruments[0].paymentMethod === 'WORLDLINE_DIRECT_CREDIT_REDIRECT') {
            htmlToAppend += '<div><span>'
                + order.billing.payment.selectedPaymentInstruments[0].name
                + '</span><div>';
        } else if (order.billing.payment.selectedPaymentInstruments[0].paymentMethod === 'WORLDLINE_DIRECT_CARD') {
            htmlToAppend += '<div><span>' + order.billing.payment.selectedPaymentInstruments[0].name + ' '
                + order.billing.payment.selectedPaymentInstruments[0].maskedCreditCardNumber
                + '<span></div><div><span>'
                + order.billing.payment.selectedPaymentInstruments[0].expirationMonth
                + '/' + order.billing.payment.selectedPaymentInstruments[0].expirationYear
                + '</span></div>';
        }
    }

    $paymentSummary.empty().append(htmlToAppend);
};

base.handleCreditCardNumber = function () {
    var cardField = $('.cardNumber');

    if (cardField.length) {
        cleave.handleCreditCardNumber('.cardNumber', '#cardType');
    }
};

module.exports = base;
