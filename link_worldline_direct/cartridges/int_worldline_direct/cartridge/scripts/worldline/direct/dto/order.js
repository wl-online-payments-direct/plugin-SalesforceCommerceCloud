'use strict';
const worldlineDirectCommonHelper = require('*/cartridge/scripts/worldline/direct/commonHelper');

/**
 * Creates Worldline-Direct specific references object
 * @param {dw.order.Order} order Current order
 * @returns {Object} References object
 */
function getReferences(order) {
    return {
        merchantReference: order.getOrderNo(),
        merchantParameters: JSON.stringify({
            ot: order.getOrderToken()
        })
    };
}

/**
 * Round a floating point number to a specified precision
 * @param {number} number number to round
 * @param {number} precision precision
 * @returns {number} rounded number
 */
function precisionRound(number, precision) {
    var factor = Math.pow(10, precision);
    var n = precision < 0 ? number : (0.01 / factor) + number;
    return Math.round(n * factor) / factor;
}

/**
 * Formats a line item into an object that can be sent to the API.
 * @param {dw.order.ProductLineItem} lineItem The line item
 * @param {number} singlePriceRounded The price for a single line item
 * @param {number} singleTaxRounded The tax for a single line item
 * @param {number} quantity The line item quantity
 * @param {string} currencyCode The currency code
 * @returns {Object} An object that can be sent to the API
 */
function getLineItemAPIObj(lineItem, singlePriceRounded, singleTaxRounded, quantity, currencyCode) {
    var lineItemObj = {
        amountOfMoney: {
            amount: precisionRound((singlePriceRounded * quantity) + (singleTaxRounded * quantity), 0),
            currencyCode: currencyCode
        },
        invoiceData: {
            description: lineItem.getLineItemText()
        },
        orderLineDetails: {
            productPrice: singlePriceRounded,
            taxAmount: singleTaxRounded,
            quantity: quantity,
            productCode: lineItem.productID,
            productName: lineItem.productName
        }
    };

    return lineItemObj;
}

/**
 * Creates an object with product prices and order/shipping totals that can be sent to the Worldline API.
 * @param {dw.order.Order} order The order
 * @returns {Object} The calculated prices
 */
function calculateOrderLinePrices(order) {
    const TaxMgr = require('dw/order/TaxMgr');
    const Resource = require('dw/web/Resource');
    const ArrayList = require('dw/util/ArrayList');
    const Currency = require('dw/util/Currency');

    var lineItems = [];
    var orderTotal = 0;

    var productAndGCLineItems = new ArrayList();
    productAndGCLineItems.addAll(order.allProductLineItems);
    productAndGCLineItems.addAll(order.giftCertificateLineItems);

    for (let i = 0; i < productAndGCLineItems.length; i++) {
        var lineItem = productAndGCLineItems[i];
        var lineItemProratedPrice = lineItem.getAdjustedPrice(true);

        var lineItemProratedTaxAmount = 0;
        if (TaxMgr.getTaxationPolicy() === TaxMgr.TAX_POLICY_NET) {
            lineItemProratedTaxAmount = lineItemProratedPrice.value * lineItem.taxRate;
        }

        var lineItemSinglePrice = worldlineDirectCommonHelper.convertMoneyToWorldlineAmount(lineItemProratedPrice) / lineItem.quantityValue;
        var lineItemSingleTax = worldlineDirectCommonHelper.convertMoneyAmountToWorldlineAmount(lineItemProratedTaxAmount, order.getCurrencyCode()) / lineItem.quantityValue;

        var lineItemSinglePriceRounded = precisionRound(lineItemSinglePrice, 0);
        var lineItemSingleTaxRounded = precisionRound(lineItemSingleTax, 0);

        var lineItemSinglePriceRoundingError = precisionRound((lineItemSinglePrice - lineItemSinglePriceRounded) * lineItem.quantityValue, 0);
        var lineItemSingleTaxRoundingError = precisionRound((lineItemSingleTax - lineItemSingleTaxRounded) * lineItem.quantityValue, 0);

        if (lineItemSinglePriceRoundingError === 0 && lineItemSingleTaxRoundingError === 0) {
            // no rounding errors, we will send all line items in a single group
            var lineItemObj = getLineItemAPIObj(lineItem, lineItemSinglePriceRounded, lineItemSingleTaxRounded, lineItem.quantityValue, order.getCurrencyCode());
            lineItems.push(lineItemObj);
            orderTotal += lineItemObj.amountOfMoney.amount;
        } else {
            // we have a rounding error, so we will split the group into two - the rounding error will be added to the price of the second group which will hold just 1 quantity
            var lineItemObj1 = getLineItemAPIObj(lineItem, lineItemSinglePriceRounded, lineItemSingleTaxRounded, lineItem.quantityValue - 1, order.getCurrencyCode());
            lineItems.push(lineItemObj1);
            orderTotal += lineItemObj1.amountOfMoney.amount;

            // add a second group with the same item, but with quantity 1 and add the rounding error into its price
            var lineItemObj2 = getLineItemAPIObj(lineItem, lineItemSinglePriceRounded + lineItemSinglePriceRoundingError, lineItemSingleTaxRounded + lineItemSingleTaxRoundingError, 1, order.getCurrencyCode());
            lineItems.push(lineItemObj2);
            orderTotal += lineItemObj2.amountOfMoney.amount;
        }
    }

    var shippingCost = precisionRound(worldlineDirectCommonHelper.convertMoneyToWorldlineAmount(order.getDefaultShipment().adjustedShippingTotalPrice), 0);
    var shippingCostTax = 0;
    if (TaxMgr.getTaxationPolicy() === TaxMgr.TAX_POLICY_NET) {
        shippingCostTax = precisionRound(worldlineDirectCommonHelper.convertMoneyToWorldlineAmount(order.getDefaultShipment().adjustedShippingTotalTax), 0);
    }

    // the shipping cost will be sent as a separate line item
    lineItems.push({
        amountOfMoney: {
            amount: shippingCost + shippingCostTax,
            currencyCode: order.getCurrencyCode()
        },
        invoiceData: {
            description: Resource.msg('label.shipping.cost', 'cart', null)
        },
        orderLineDetails: {
            productPrice: shippingCost,
            taxAmount: shippingCostTax,
            quantity: 1,
            productCode: "SHIPPING",
            productName: Resource.msg('label.shipping.cost', 'cart', null)
        }
    });

    orderTotal += shippingCost + shippingCostTax;

    return {
        lineItems: lineItems,
        // shippingCost: shippingCost,
        // shippingCostTax: shippingCostTax,
        orderTotal: orderTotal
    };
}

/**
 * @param {dw.order.Order} order Current order
 * @param {boolean} paymentIsCreditCardHostedTokenization Whether the payment is a credit card with hosted tokenization
 * @class
 */
function WorldlineDirectOrder(order, paymentIsCreditCardHostedTokenization) {
    const Site = require('dw/system/Site');
    const WorldlineDirectCustomer = require('*/cartridge/scripts/worldline/direct/dto/order/customer');
    const WorldlineDirectAddress = require('*/cartridge/scripts/worldline/direct/dto/common/address');
    const site = Site.getCurrent();

    this.references = getReferences(order);
    this.customer = new WorldlineDirectCustomer(order);

    var shipment = order.getDefaultShipment();
    this.shipping = {
        address: new WorldlineDirectAddress(shipment.getShippingAddress(), true),
        addressIndicator: 'different-than-billing',
        emailAddress: order.customerEmail
    };

    if (this.shipping.address.hash === this.customer.billingAddress.hash) {
        this.shipping.addressIndicator = 'same-as-billing';
    }

    this.amountOfMoney = {
        currencyCode: order.getCurrencyCode()
    };

    var includeLineItemPrices = paymentIsCreditCardHostedTokenization === false && site.getCustomPreferenceValue('worldlineDirectCheckoutSendLineItemPrices') === true;
    if (includeLineItemPrices) {
        var orderLinePrices = calculateOrderLinePrices(order);

        this.amountOfMoney.amount = orderLinePrices.orderTotal;
        // this.shipping.shippingCost = orderLinePrices.shippingCost;
        // this.shipping.shippingCostTax = orderLinePrices.shippingCostTax;

        this.shoppingCart = {
            items: orderLinePrices.lineItems
        };
    } else {
        this.amountOfMoney.amount = precisionRound(worldlineDirectCommonHelper.convertMoneyToWorldlineAmount(order.getTotalGrossPrice()), 0);
    }

    if(site.getCustomPreferenceValue('worldlineDirectApplySurcharge')) {
        this.surchargeSpecificInput = {
            mode: "on-behalf-of"
        };
    }
}

module.exports = WorldlineDirectOrder;
