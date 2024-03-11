'use strict';

const Logger = require('dw/system/Logger');
const PaymentMgr = require('dw/order/PaymentMgr');
const Resource = require('dw/web/Resource');
const Site = require('dw/system/Site');

const worldlineDirectCommonHelper = require('*/cartridge/scripts/worldline/direct/commonHelper');
const worldlineDirectApiFacade = require('*/cartridge/scripts/worldline/direct/api/facade');
const worldlineDirectConstants = require('*/cartridge/scripts/worldline/direct/constants');
const paymentProductOverridesHelper = require('*/cartridge/scripts/worldline/direct/paymentProductOverridesHelper');

var logger = Logger.getRootLogger();

/**
 * Creates an array of objects containing applicable payment methods
 * @param {dw.util.List<dw.order.PaymentMethod>} paymentMethods - A List of
 *      applicable payment methods that the user could use for the current basket.
 * @returns {Array} of object that contain information about the applicable payment methods for the
 *      current cart
 */
function applicableSFCCPaymentMethods(paymentMethods) {
    return paymentMethods.toArray().map(function (method) {
        return {
            ID: method.ID,
            name: method.name,
            description: method.description,
            custom: {}
        };
    });
}

/**
 * Adds Worldline's Payment Products to the Applicable Payment Methods in corresponding order
 * @param {Array} paymentMethods - An Array of applicable payment methods that the user could use for the current basket.
 * @param {string} paymentMethodID - SFCC Payment Method ID to be used for ordering of Payment Products.
 * @param {Array} paymentProducts - An Array of Worldline payment products that the user could use for the current basket.
 * @returns {Array} - An Array of applicable payment methods that the user could use for the current basket.
 */
function addPaymentProductsToApplicablePaymentMethods(paymentMethods, paymentMethodID, paymentProducts) {
    var newPaymentMethods = [];

    var browserDataStr = session.privacy.browserData;
    var canMakeApplePayPayments = true;

    if (browserDataStr && typeof browserDataStr === "string") {
        try {
            var browserData = JSON.parse(browserDataStr);
            canMakeApplePayPayments = browserData.canMakeApplePayPayments;
        } catch (e) {
            logger.error("Error parsing browserData JSON: " + JSON.stringify(e));
        }
    }

    var includeLineItemPrices = Site.getCurrent().getCustomPreferenceValue('worldlineDirectCheckoutSendLineItemPrices') === true;

    paymentMethods.forEach(function (paymentMethod) {
        if (paymentMethod.ID === paymentMethodID) {

            if (paymentMethodID === worldlineDirectConstants.PAYMENT_METHOD_CARD && worldlineDirectCommonHelper.isHCPGroupCardsEnabled()) {
                newPaymentMethods.push({
                    ID: worldlineDirectConstants.PAYMENT_METHOD_REDIRECT + '__CARDS',
                    paymentMethod: worldlineDirectConstants.PAYMENT_METHOD_REDIRECT,
                    name: paymentMethod.name,
                    description: '',
                    logo: null,
                    custom: {
                        redirect: true,
                        worldline: {
                            allowsRecurring: true,
                            allowsTokenization: true,
                            id: null,
                            paymentMethod: worldlineDirectConstants.PAYMENT_PRODUCT_GROUP_CARD,
                            usesRedirectionTo3rdParty: true
                        }
                    }
                });

                return;
            }

            paymentProducts.forEach(function (paymentProduct) {
                const paymentProductOverride = paymentProductOverridesHelper.getPaymentProduct(paymentProduct.id);

                if (
                    (!paymentProductOverride || paymentProductOverride.isShown !== false) &&
                    (canMakeApplePayPayments || paymentProduct.id !== worldlineDirectConstants.PAYMENT_PRODUCT_APPLE_PAY_ID) &&
                    (includeLineItemPrices || worldlineDirectConstants.PAYMENT_PRODUCTS_WITH_LINEITEM_PRICES.indexOf(paymentProduct.id) === -1)
                ) {
                    var paymentMethodName = worldlineDirectConstants.PAYMENT_METHOD_REDIRECT;
                    if (paymentProduct.id === worldlineDirectConstants.PAYMENT_PRODUCT_IDEAL_ID) {
                        paymentMethodName = worldlineDirectConstants.PAYMENT_METHOD_CREDIT_REDIRECT;
                    }

                    newPaymentMethods.push({
                        ID: paymentMethodName + '__' + paymentProduct.id,
                        paymentMethod: paymentMethodName,
                        name: paymentProduct.displayHints.label,
                        description: '',
                        logo: paymentProduct.displayHints.logo,
                        custom: {
                            redirect: true,
                            worldline: {
                                allowsRecurring: paymentProduct.allowsRecurring,
                                allowsTokenization: paymentProduct.allowsTokenization,
                                id: paymentProduct.id,
                                paymentMethod: paymentProduct.paymentMethod,
                                usesRedirectionTo3rdParty: paymentProduct.usesRedirectionTo3rdParty
                            }
                        }
                    });
                }
            });
        }

        newPaymentMethods.push(paymentMethod);
    });

    return newPaymentMethods;
}

/**
 * Removes payment method by ID from the array of applicable payment methods that the user could use for the current basket.
 * @param {Array} paymentMethods - An Array of applicable payment methods that the user could use for the current basket.
 * @param {string} paymentMethodID - Payment Method ID to be removed.
 * @returns {Array} - An Array of applicable payment methods that the user could use for the current basket.
 */
function removeApplicablePaymentMethod(paymentMethods, paymentMethodID) {
    return paymentMethods.filter(function (paymentMethod) {
        return (paymentMethod.ID !== paymentMethodID);
    });
}

/**
 * Creates an array of objects containing applicable payment methods
 * @param {Array} sfccPaymentMethods - An array of applicable payment methods that the user could use for the current basket.
 * @param {Object} worldlineDirectApiResponse The API response from the get-payment-products call
 * @param {string} basketCurrencyCode The currency code
 * @returns {Array} of object that contain information about the applicable payment methods for the current cart
 */
function applicableWorldlineDirectPaymentMethods(sfccPaymentMethods, worldlineDirectApiResponse, basketCurrencyCode) {
    var paymentMethods = sfccPaymentMethods;

    var hostedTokenizationEnabled = worldlineDirectCommonHelper.isHostedTokenizationEnabled();

    if (!worldlineDirectApiResponse.error) {
        var worldlineDirectPaymentProducts = worldlineDirectApiResponse.paymentProducts;

        var worldlineDirectCardPaymentProducts = worldlineDirectPaymentProducts.filter(function (paymentProduct) {
            return (
                paymentProduct.paymentMethod === worldlineDirectConstants.PAYMENT_PRODUCT_GROUP_CARD &&
                paymentProduct.id !== worldlineDirectConstants.PAYMENT_PRODUCT_BANCONTACT_ID &&
                paymentProduct.id !== worldlineDirectConstants.PAYMENT_PRODUCT_INTERSOLVE_ID
            );
        });

        var worldlineDirectRedirectPaymentProducts = worldlineDirectPaymentProducts.filter(function (paymentProduct) {
            return (
                paymentProduct.paymentMethod === worldlineDirectConstants.PAYMENT_PRODUCT_DIRECT_DEBIT ||
                paymentProduct.paymentMethod === worldlineDirectConstants.PAYMENT_PRODUCT_GROUP_REDIRECT ||
                paymentProduct.paymentMethod === worldlineDirectConstants.PAYMENT_PRODUCT_GROUP_MOBILE ||
                (paymentProduct.paymentMethod === worldlineDirectConstants.PAYMENT_PRODUCT_GROUP_CARD &&
                    (
                        paymentProduct.id === worldlineDirectConstants.PAYMENT_PRODUCT_BANCONTACT_ID ||
                        paymentProduct.id === worldlineDirectConstants.PAYMENT_PRODUCT_INTERSOLVE_ID
                    )
                )
            );
        });

        // check if hosted tokanization is enabled for card
        if (!hostedTokenizationEnabled && !empty(worldlineDirectCardPaymentProducts)) {
            paymentMethods = addPaymentProductsToApplicablePaymentMethods(paymentMethods, worldlineDirectConstants.PAYMENT_METHOD_CARD, worldlineDirectCardPaymentProducts);
        }

        if (!empty(worldlineDirectRedirectPaymentProducts)) {
            paymentMethods = addPaymentProductsToApplicablePaymentMethods(paymentMethods, worldlineDirectConstants.PAYMENT_METHOD_REDIRECT, worldlineDirectRedirectPaymentProducts);
        }
    }

    paymentMethods = removeApplicablePaymentMethod(paymentMethods, worldlineDirectConstants.PAYMENT_METHOD_REDIRECT);
    paymentMethods = removeApplicablePaymentMethod(paymentMethods, worldlineDirectConstants.PAYMENT_METHOD_CREDIT_REDIRECT);

    if (!hostedTokenizationEnabled) {
        paymentMethods = removeApplicablePaymentMethod(paymentMethods, worldlineDirectConstants.PAYMENT_METHOD_CARD);
    }

    paymentMethods.forEach(function (paymentMethod) {
        if (paymentMethod && paymentMethod.custom.worldline && paymentMethod.custom.worldline.id === worldlineDirectConstants.PAYMENT_PRODUCT_IDEAL_ID) {
            try {
                var serviceResponse = worldlineDirectApiFacade.getPaymentProductDirectory(paymentMethod.custom.worldline.id, {
                    countryCode: "NL", // Hardcoded NL as per discussion with Worldline
                    currencyCode: basketCurrencyCode
                });

                if (serviceResponse.error || empty(serviceResponse.entries)) {
                    throw new Error('error.worldline.getpaymentproductdirectory');
                }

                paymentMethod.custom.worldline.issuers = serviceResponse.entries;
            } catch (e) {
                logger.error(e);
                paymentMethods = removeApplicablePaymentMethod(paymentMethods, paymentMethod.ID);
            }
        }
    });

    return paymentMethods;
}

/**
 * Creates an array of objects containing selected payment information
 * @param {Array} selectedPaymentInstruments - Array of payment instruments that the user is using to pay for the current basket
 * @returns {Array} Array of objects that contain information about the selected payment instruments
 */
function getSelectedPaymentInstruments(selectedPaymentInstruments) {
    return selectedPaymentInstruments.map(function (paymentInstrument) {
        var results = {
            paymentMethod: paymentInstrument.paymentMethod,
            amount: paymentInstrument.paymentTransaction.amount.value
        };

        if (paymentInstrument.paymentMethod === 'CREDIT_CARD') {
            results.lastFour = paymentInstrument.creditCardNumberLastDigits;
            results.owner = paymentInstrument.creditCardHolder;
            results.expirationYear = paymentInstrument.creditCardExpirationYear;
            results.type = paymentInstrument.creditCardType;
            results.maskedCreditCardNumber = paymentInstrument.maskedCreditCardNumber;
            results.expirationMonth = ("0" + paymentInstrument.creditCardExpirationMonth).substr(-2);
        } else if (paymentInstrument.paymentMethod === 'GIFT_CERTIFICATE') {
            results.giftCertificateCode = paymentInstrument.giftCertificateCode;
            results.maskedGiftCertificateCode = paymentInstrument.maskedGiftCertificateCode;
        } else if (paymentInstrument.paymentMethod === worldlineDirectConstants.PAYMENT_METHOD_REDIRECT || paymentInstrument.paymentMethod === worldlineDirectConstants.PAYMENT_METHOD_CREDIT_REDIRECT) {
            results.name = paymentInstrument.custom.worldlineDirectPaymentProductName;
            results.paymentProductID = paymentInstrument.custom.worldlineDirectPaymentProductID;
            results.savedCardToken = paymentInstrument.custom.worldlineDirectSavedCardToken;

            if (!empty(paymentInstrument.custom.worldlineDirectCreditCardAlias)) {
                results.card = {
                    expirationYear: paymentInstrument.creditCardExpirationYear,
                    expirationMonth: ("0" + paymentInstrument.creditCardExpirationMonth).substr(-2),
                    alias: paymentInstrument.custom.worldlineDirectCreditCardAlias
                };
                results.maskedCreditCardNumber = paymentInstrument.custom.worldlineDirectCreditCardAlias;
            }
        } else if (paymentInstrument.paymentMethod === worldlineDirectConstants.PAYMENT_METHOD_CARD) {
            results.name = paymentInstrument.custom.worldlineDirectPaymentProductName;
            results.owner = paymentInstrument.creditCardHolder;
            results.expirationYear = paymentInstrument.creditCardExpirationYear;
            results.expirationMonth = ("0" + paymentInstrument.creditCardExpirationMonth).substr(-2);
            results.maskedCreditCardNumber = paymentInstrument.custom.worldlineDirectCreditCardAlias;
        }

        return results;
    });
}

/**
 * Payment class that represents payment information for the current basket
 * @param {dw.order.Basket} currentBasket - the target Basket object
 * @param {dw.customer.Customer} currentCustomer - the associated Customer object
 * @param {string} countryCode - the associated Site countryCode
 * @constructor
 */
function Payment(currentBasket, currentCustomer, countryCode) {
    const Basket = require('dw/order/Basket');
    module.superModule.call(this, currentBasket, currentCustomer, countryCode);

    var paymentMethods = PaymentMgr.getApplicablePaymentMethods(
        currentCustomer,
        countryCode,
        currentBasket.totalGrossPrice.value
    );


    /*
    * Actually {currentBasket} param can be Basket or Order instance!
    * If it's an order, there is no point to calculate applicable methods
    */
    if (currentBasket instanceof Basket) {
        var applicablePaymentMethods = paymentMethods ? applicableSFCCPaymentMethods(paymentMethods) : null;

        var isWorldlineDirectApplicable = applicablePaymentMethods !== null && applicablePaymentMethods.filter(function (item) {
            return (item.ID.indexOf(worldlineDirectConstants.PAYMENT_METHOD_PREFIX) !== -1);
        });

        if (isWorldlineDirectApplicable && applicablePaymentMethods !== null) {
            var basketCurrencyCode = currentBasket.currencyCode;
            var basketCountryCode = worldlineDirectCommonHelper.getCustomerCountryCode(currentBasket);
            var worldlineDirectApiResponse = worldlineDirectApiFacade.getPaymentProducts({
                countryCode: basketCountryCode,
                currencyCode: basketCurrencyCode
            });

            var worldlinePaymentProductLogos = {};
            if (worldlineDirectApiResponse.error) {
                session.privacy.worldlineDirectError = Resource.msg('error.payment.methods.get', 'worldlineDirect', null);
            } else {
                worldlineDirectApiResponse.paymentProducts.forEach(function (paymentProduct) {
                    var id = paymentProduct.id;
                    var logo = paymentProduct.displayHints.logo;

                    worldlinePaymentProductLogos[id] = {
                        logo: logo
                    };
                });
            }

            this.worldlinePaymentProductLogos = worldlinePaymentProductLogos;

            var worldlinePaymentMethods = applicableWorldlineDirectPaymentMethods(applicablePaymentMethods, worldlineDirectApiResponse, basketCurrencyCode);
            this.applicablePaymentMethods = worldlinePaymentMethods;
        }
    }


    var paymentInstruments = currentBasket.paymentInstruments;
    this.selectedPaymentInstruments = paymentInstruments ?
        getSelectedPaymentInstruments(paymentInstruments.toArray()) : null;

    this.hostedTokenizationEnabled = worldlineDirectCommonHelper.isHostedTokenizationEnabled();
}

module.exports = Payment;
