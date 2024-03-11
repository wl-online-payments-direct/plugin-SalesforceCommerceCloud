'use strict';

const URLUtils = require('dw/web/URLUtils');
const Customer = require('dw/customer/Customer');
const paymentProductOverridesHelper = require('*/cartridge/scripts/worldline/direct/paymentProductOverridesHelper');

/**
 * Creates a plain object that contains payment instrument information
 * @param {Array} userPaymentInstruments - current customer's paymentInstruments
 * @returns {Array} object that contains info about the current customer's payment instruments
 */
function getCustomerPaymentInstruments(userPaymentInstruments) {
    var paymentInstruments = [];

    for (var i = 0; i < userPaymentInstruments.length; i++) {
        var paymentInstrument = userPaymentInstruments[i];

        var pi = "raw" in paymentInstrument ? paymentInstrument.raw : paymentInstrument;
        var isWorldlinePaymentInstrument = pi.custom.worldlineDirectPaymentProductID;

        var paymentMethodIsAllowed = true;
        if (isWorldlinePaymentInstrument) {
            var paymentProductOverride = paymentProductOverridesHelper.getPaymentProduct(pi.custom.worldlineDirectPaymentProductID);

            if (paymentProductOverride && paymentProductOverride.isShown === false) {
                paymentMethodIsAllowed = false;
            }
        }

        if (paymentMethodIsAllowed) {
            var paymentInstrumentObj = {
                creditCardHolder: paymentInstrument.creditCardHolder,
                maskedCreditCardNumber: isWorldlinePaymentInstrument ? pi.custom.worldlineDirectCreditCardAlias : paymentInstrument.maskedCreditCardNumber,
                creditCardType: paymentInstrument.creditCardType,
                creditCardExpirationMonth: ("0" + paymentInstrument.creditCardExpirationMonth).substr(-2),
                creditCardExpirationYear: paymentInstrument.creditCardExpirationYear,
                UUID: paymentInstrument.UUID
            };

            if (paymentInstrument.creditCardType) {
                paymentInstrumentObj.cardTypeImage = {
                    src: URLUtils.staticURL('/images/' +
                        paymentInstrument.creditCardType.toLowerCase().replace(/\s/g, '') +
                        '-dark.svg'),
                    alt: paymentInstrument.creditCardType
                };
            }

            if (isWorldlinePaymentInstrument) {
                paymentInstrumentObj.worldline = {
                    paymentProductID: pi.custom.worldlineDirectPaymentProductID,
                    paymentProductName: pi.custom.worldlineDirectPaymentProductName,
                    paymentMethod: pi.custom.worldlineDirectPaymentMethod,
                    creditCardAlias: pi.custom.worldlineDirectCreditCardAlias,
                    htpt: pi.creditCardToken
                };
            }

            paymentInstruments.push(paymentInstrumentObj);
        }
    }

    return paymentInstruments;
}

/**
 * Account class that represents the current customer's profile dashboard
 * @param {Object} currentCustomer - Current customer
 * @param {Object} addressModel - The current customer's preferred address
 * @param {Object} orderModel - The current customer's order history
 * @constructor
 */
function account(currentCustomer, addressModel, orderModel) {
    module.superModule.call(this, currentCustomer, addressModel, orderModel);

    if (currentCustomer instanceof Customer) {
        this.customerPaymentInstruments = currentCustomer.profile && currentCustomer.profile.wallet
        && currentCustomer.profile.wallet.paymentInstruments
        ? getCustomerPaymentInstruments(currentCustomer.profile.wallet.paymentInstruments.toArray())
        : null;
    } else {
        this.customerPaymentInstruments = currentCustomer.wallet
        && currentCustomer.wallet.paymentInstruments
        ? getCustomerPaymentInstruments(currentCustomer.wallet.paymentInstruments)
        : null;
    }

    this.payment = this.customerPaymentInstruments ? this.customerPaymentInstruments[0] : null;
}

account.getCustomerPaymentInstruments = getCustomerPaymentInstruments;

module.exports = account;
