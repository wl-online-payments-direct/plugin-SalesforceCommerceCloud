'use strict';

var formatMoney = require('dw/util/StringUtils').formatMoney;

/**
 * Accepts a total object and formats the value
 * @param {dw.value.Money} total - Total price of the cart
 * @returns {string} the formatted money value
 */
function getTotals(total) {
    return !total.available ? '-' : formatMoney(total);
}

function getTotalPaymentSurcharge(lineItemContainer) {
    if(!empty(lineItemContainer.custom.worldlineDirectSurchargeAmount)) {
        return new dw.value.Money(lineItemContainer.custom.worldlineDirectSurchargeAmount, lineItemContainer.currencyCode);
    }

    return null;
}

/**
 * @constructor
 * @classdesc totals class that represents the order totals of the current line item container
 *
 * @param {dw.order.lineItemContainer} lineItemContainer - The current user's line item container
 */
function totals(lineItemContainer) {
    
    module.superModule.call(this, lineItemContainer);

    this.totalPaymentSurcharge = '-';

    if (lineItemContainer) {
        var totalPaymentSurcharge = getTotalPaymentSurcharge(lineItemContainer);

        if (totalPaymentSurcharge) {
            this.totalPaymentSurcharge = getTotals(totalPaymentSurcharge);
            this.grandTotal = getTotals(lineItemContainer.totalGrossPrice.add(totalPaymentSurcharge));
        }
    }
}

module.exports = totals;
