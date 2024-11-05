'use strict';

const Resource = require('dw/web/Resource');
const Transaction = require('dw/system/Transaction');
const Logger = require('dw/system/Logger');

const collections = require('*/cartridge/scripts/util/collections');
const worldlineDirectCommonHelper = require('*/cartridge/scripts/worldline/direct/commonHelper');
const worldlineDirectSubscriptionHelper = require('*/cartridge/scripts/worldline/direct/subscriptionHelper');

const logger = Logger.getRootLogger();

/**
 * Creates a token. This should be replaced by utilizing a tokenization provider
 * @returns {string} a token
 */
function createToken() {
    return '';
}

/**
 * Creates a payment instrument for Worldline-Direct Hosted Checkout Payment
 * @param {dw.order.Basket} basket Current users's basket
 * @param {Object} paymentInformation - the payment information
 * @param {string} paymentMethodID - paymentmethodID
 * @param {Object} req the request object
 * @return {Object} returns an error object
 */
function Handle(basket, paymentInformation, paymentMethodID, req) {
    var currentBasket = basket;
    var cardErrors = {};
    var serverErrors = [];

    var AccountModel = require('*/cartridge/models/account');
    var customerPaymentInstruments = req.currentCustomer && req.currentCustomer.raw && req.currentCustomer.raw.profile && req.currentCustomer.raw.profile.wallet
        ? AccountModel.getCustomerPaymentInstruments(req.currentCustomer.raw.profile.wallet.paymentInstruments.toArray())
        : [];

    Transaction.wrap(function () {
        var paymentInstruments = currentBasket.getPaymentInstruments();

        collections.forEach(paymentInstruments, function (item) {
            currentBasket.removePaymentInstrument(item);
        });

        var paymentInstrument = currentBasket.createPaymentInstrument(
            paymentMethodID, currentBasket.totalGrossPrice
        );

        paymentInstrument.custom.worldlineDirectPaymentProductID = paymentInformation.paymentProductID.value;
        paymentInstrument.custom.worldlineDirectPaymentProductName = paymentInformation.paymentProductName.value;
        paymentInstrument.custom.worldlineDirectPaymentMethod = paymentInformation.paymentMethod.value;
        paymentInstrument.custom.worldlineDirectSavedCardToken = paymentInformation.savedCardToken.value;

        var savedPaymentInstrument = customerPaymentInstruments.find((pi) => !empty(pi.worldline) && !empty(pi.worldline.htpt) && pi.worldline.htpt === paymentInstrument.custom.worldlineDirectSavedCardToken);
        if (!empty(savedPaymentInstrument)) {
            paymentInstrument.custom.worldlineDirectCreditCardAlias = savedPaymentInstrument.worldline.creditCardAlias;
            paymentInstrument.creditCardExpirationYear = savedPaymentInstrument.creditCardExpirationYear;
            paymentInstrument.creditCardExpirationMonth = savedPaymentInstrument.creditCardExpirationMonth;
        }
    });

    return { fieldErrors: cardErrors, serverErrors: serverErrors, error: false };
}

/**
 * Creates a payment with Worldline-Direct with Hosted Checkout
 * @param {dw.order.Order} order - The current order
 * @param {dw.order.PaymentInstrument} paymentInstrument -  The payment instrument to authorize
 * @param {dw.order.PaymentProcessor} paymentProcessor -  The payment processor of the current
 *      payment method
 * @return {Object} returns an error object
 */
function Authorize(order, paymentInstrument, paymentProcessor) {
    const worldlineDirectFacade = require('*/cartridge/scripts/worldline/direct/api/facade');

    const WorldlineDirectOrderDTO = require('*/cartridge/scripts/worldline/direct/dto/order');
    const WorldlineDirectHostedCheckoutSpecificInputDTO = require('*/cartridge/scripts/worldline/direct/dto/input/hostedcheckout');

    var serverErrors = [];
    var fieldErrors = {};
    var authResponse = { error: false };

    try {
        var requestBody = {};

        requestBody.order = new WorldlineDirectOrderDTO(order, false);
        requestBody.hostedCheckoutSpecificInput = new WorldlineDirectHostedCheckoutSpecificInputDTO(paymentInstrument, order);

        if (paymentInstrument.custom.worldlineDirectPaymentMethod === 'card') {
            const WorldlineDirectCardPaymentMethodSpecificInputDTO = require('*/cartridge/scripts/worldline/direct/dto/input/cardpayment');
            requestBody.cardPaymentMethodSpecificInput = new WorldlineDirectCardPaymentMethodSpecificInputDTO(paymentInstrument, order);
        } else if (paymentInstrument.custom.worldlineDirectPaymentMethod === 'redirect') {
            const WorldlineDirectRedirectPaymentMethodSpecificInputDTO = require('*/cartridge/scripts/worldline/direct/dto/input/redirectpayment');
            requestBody.redirectPaymentMethodSpecificInput = new WorldlineDirectRedirectPaymentMethodSpecificInputDTO(paymentInstrument, paymentProcessor, order);
        } else if (paymentInstrument.custom.worldlineDirectPaymentMethod === 'mobile') {
            const WorldlineDirectMobilePaymentMethodSpecificInputDTO = require('*/cartridge/scripts/worldline/direct/dto/input/mobilepayment');
            requestBody.mobilePaymentMethodSpecificInput = new WorldlineDirectMobilePaymentMethodSpecificInputDTO(paymentInstrument);
        } else if (paymentInstrument.custom.worldlineDirectPaymentMethod === 'directDebit') {
            const WorldlineDirectSepaDirectPaymentMethodSpecificInputDTO = require('*/cartridge/scripts/worldline/direct/dto/input/sepadirectpayment');
            requestBody.sepaDirectDebitPaymentMethodSpecificInput = new WorldlineDirectSepaDirectPaymentMethodSpecificInputDTO(order);
        } else {
            throw new Error('worldline.direct.unsupported.payment.method');
        }

        var serviceResponse = worldlineDirectFacade.createHostedCheckout({ requestBody: requestBody });

        if (serviceResponse.error) {
            throw new Error(serviceResponse.errorMessage);
        }

        Transaction.wrap(function () {
            paymentInstrument.paymentTransaction.setTransactionID(serviceResponse.hostedCheckoutId);
            paymentInstrument.paymentTransaction.setPaymentProcessor(paymentProcessor);

            order.custom.isWorldlineDirectOrder = true;
            order.custom.worldlineDirectTransactionID = serviceResponse.hostedCheckoutId;
        });

        authResponse.redirect = true;
        authResponse.redirectUrl = serviceResponse.redirectUrl;
        authResponse.redirectOrderNo = order.orderNo;
        authResponse.redirectOrderToken = order.orderToken;
    } catch (e) {
        logger.error(e);

        authResponse.error = true;
        serverErrors.push(
            Resource.msg('error.technical', 'checkout', null)
        );
    }

    authResponse.fieldErrors = fieldErrors;
    authResponse.serverErrors = serverErrors;

    return authResponse;
}

/**
 * Validates a payment using Worldline-Direct  after successful redirect to the site
 * @param {dw.order.Order} order - The current order
 * @param {dw.order.PaymentInstrument} paymentInstrument -  The payment instrument to validate
 * @param {Object} hostedCheckoutResult -  The HostedCheckoutResult Object
 * @return {Object} returns an error object
 */
function validatePayment(order, paymentInstrument, hostedCheckoutResult) {
    const URLUtils = require('dw/web/URLUtils');

    var error = false;
    var redirectUrl;
    var paymentResponse = {};

    var subscriptionData = worldlineDirectSubscriptionHelper.getSubscriptionData(order);

    try {
        var payment = hostedCheckoutResult.createdPaymentOutput.payment;
        var paymentStatusCategory = hostedCheckoutResult.createdPaymentOutput.paymentStatusCategory;

        let transactionAmount = worldlineDirectCommonHelper.convertWorldlineAmountToMoney(payment.paymentOutput.amountOfMoney.amount, payment.paymentOutput.amountOfMoney.currencyCode);
        let acquiredAmount = worldlineDirectCommonHelper.convertWorldlineAmountToMoney(payment.paymentOutput.acquiredAmount.amount, payment.paymentOutput.acquiredAmount.currencyCode);
    
        Transaction.wrap(function () {
            var paymentTransaction = paymentInstrument.paymentTransaction;

            paymentTransaction.setTransactionID(payment.id);
            paymentTransaction.setAmount(transactionAmount);
            paymentTransaction.custom.worldlineDirectAcquiredAmount = acquiredAmount;
        });

        try {
            Transaction.wrap(function () {
                paymentInstrument.custom.worldlineDirectHostedCheckoutID = payment.hostedCheckoutSpecificOutput.hostedCheckoutId;
                paymentInstrument.setCreditCardHolder(order.billingAddress.getFullName());
            });
        } catch (e) {
            logger.error("[worldline_direct_redirect.js#176] " + e);
        }

        worldlineDirectCommonHelper.updatePaymentTransaction(order, payment.status, payment.statusOutput, paymentStatusCategory);

        if (payment.paymentOutput.paymentMethod === 'card') {
            var cardPayment = payment.paymentOutput.cardPaymentMethodSpecificOutput;

            try {
                Transaction.wrap(function () {
                    if (empty(paymentInstrument.custom.worldlineDirectPaymentProductID) || 
                            paymentInstrument.custom.worldlineDirectPaymentProductID === 'null') {
                        paymentInstrument.custom.worldlineDirectPaymentProductID = cardPayment.paymentProductId;
                    } 

                    paymentInstrument.setCreditCardNumber(cardPayment.bin + cardPayment.card.cardNumber.slice(6,cardPayment.card.cardNumber.length));

                    paymentInstrument.setCreditCardType(paymentInstrument.custom.worldlineDirectPaymentProductName);

                    if ('expiryDate' in cardPayment.card) {
                        paymentInstrument.setCreditCardExpirationMonth(parseInt(cardPayment.card.expiryDate.slice(0, 2), 10));
                        paymentInstrument.setCreditCardExpirationYear(parseInt('20' + cardPayment.card.expiryDate.slice(2, 4), 10));
                        paymentInstrument.custom.worldlineDirectCardExpiry = cardPayment.card.expiryDate;
                    }

                    if ('authorisationCode' in cardPayment) {
                        paymentInstrument.custom.worldlineDirectAuthorisationCode = cardPayment.authorisationCode;
                    }

                    if ('schemeReferenceData' in cardPayment) {
                        paymentInstrument.custom.worldlineDirectCardSchemeReferenceData = cardPayment.schemeReferenceData;
                    }

                    if ('token' in cardPayment) {
                        paymentInstrument.setCreditCardToken(cardPayment.token);

                        if (!subscriptionData.selected) {
                            paymentResponse.token = cardPayment.token;
                        }
                    }
                });
            } catch (e) {
                logger.error("[worldline_direct_redirect.js#211] " + e);
            }

            paymentResponse.fraudResults = cardPayment.fraudResults;
            paymentResponse.threeDSecureResults = cardPayment.threeDSecureResults;
        } else if (payment.paymentOutput.paymentMethod === 'redirect') {
            var redirectPayment = payment.paymentOutput.redirectPaymentMethodSpecificOutput;
            paymentResponse.fraudResults = redirectPayment.fraudResults;

            if ('token' in redirectPayment) {
                paymentResponse.token = redirectPayment.token;
            }
        } else if (payment.paymentOutput.paymentMethod === 'mobile') {
            var mobilePayment = payment.paymentOutput.mobilePaymentMethodSpecificOutput;

            try {
                Transaction.wrap(function () {
                    if ('expiryDate' in mobilePayment.paymentData) {
                        paymentInstrument.setCreditCardExpirationMonth(parseInt(mobilePayment.paymentData.expiryDate.slice(0, 2), 10));
                        paymentInstrument.setCreditCardExpirationYear(parseInt('20' + mobilePayment.paymentData.expiryDate.slice(2, 4), 10));
                        paymentInstrument.custom.worldlineDirectCardExpiry = mobilePayment.card.expiryDate;
                    }

                    if ('authorisationCode' in mobilePayment) {
                        paymentInstrument.custom.worldlineDirectAuthorisationCode = mobilePayment.authorisationCode;
                    }

                    if ('schemeReferenceData' in mobilePayment) {
                        paymentInstrument.custom.worldlineDirectCardSchemeReferenceData = mobilePayment.schemeReferenceData;
                    }
                });
            } catch (e) {
                logger.error("[worldline_direct_redirect.js#239] " + e);
            }

            paymentResponse.fraudResults = mobilePayment.fraudResults;
            paymentResponse.threeDSecureResults = mobilePayment.threeDSecureResults;
        } else if (payment.paymentOutput.paymentMethod === 'directDebit' && 'sepaDirectDebitPaymentMethodSpecificOutput' in payment.paymentOutput) {
            Transaction.wrap(function () {
                order.custom.worldlineDirectMandateReference = payment.paymentOutput.sepaDirectDebitPaymentMethodSpecificOutput.paymentProduct771SpecificOutput.mandateReference;
            });
        }

        worldlineDirectCommonHelper.handlePaymentStatus(order, payment);
        worldlineDirectCommonHelper.validateAmountPaid(order, payment.paymentOutput);

        if ('token' in paymentResponse) {
            var customer = session.getCustomer();

            if (customer.authenticated) {
                worldlineDirectCommonHelper.savePaymentInstrumentToWallet(paymentResponse.token, paymentInstrument, customer);
            }
        }
    } catch (e) {
        logger.error("[worldline_direct_redirect.js#260] " + e);

        error = true;
        redirectUrl = URLUtils.https('Checkout-Begin', 'stage', 'payment', 'showError', 'true').toString();
    }

    return { error: error, redirectUrl: redirectUrl, payment: paymentResponse };
}

exports.Handle = Handle;
exports.Authorize = Authorize;
exports.validatePayment = validatePayment;
exports.createToken = createToken;
