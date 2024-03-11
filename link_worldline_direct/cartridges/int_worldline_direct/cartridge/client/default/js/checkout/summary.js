'use strict';

var base = require('base/checkout/summary');

/**
 * Validate and update payment instrument form fields
 * @param {Object} order - the order model
 */
base.updateTotals = function (totals) {
    $('.shipping-total-cost').text(totals.totalShippingCost);
    $('.tax-total').text(totals.totalTax);
    $('.sub-total').text(totals.subTotal);
    $('.grand-total-sum').text(totals.grandTotal);

    if (totals.orderLevelDiscountTotal.value > 0) {
        $('.order-discount').removeClass('hide-order-discount');
        $('.order-discount-total').text('- ' + totals.orderLevelDiscountTotal.formatted);
    } else {
        $('.order-discount').addClass('hide-order-discount');
    }

    if (totals.totalPaymentSurcharge != '-') {
        $('.surcharge-item').removeClass('hide-surcharge');
        $('.surcharge-total').text(totals.totalPaymentSurcharge);

    } else {
        $('.surcharge-item').addClass('hide-surcharge');
    }

    if (totals.shippingLevelDiscountTotal.value > 0) {
        $('.shipping-discount').removeClass('hide-shipping-discount');
        $('.shipping-discount-total').text('- ' +
            totals.shippingLevelDiscountTotal.formatted);
    } else {
        $('.shipping-discount').addClass('hide-shipping-discount');
    }
};

module.exports = base;