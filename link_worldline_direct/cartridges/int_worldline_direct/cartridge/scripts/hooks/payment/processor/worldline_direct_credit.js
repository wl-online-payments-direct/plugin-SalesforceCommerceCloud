'use strict';

const Logger = require('dw/system/Logger');
const Transaction = require('dw/system/Transaction');
const Resource = require('dw/web/Resource');
const URLUtils = require('dw/web/URLUtils');
const Site = require('dw/system/Site');

const collections = require('*/cartridge/scripts/util/collections');
const worldlineDirectCommonHelper = require('*/cartridge/scripts/worldline/direct/commonHelper');
const worldlineDirectApiFacade = require('*/cartridge/scripts/worldline/direct/api/facade');
const WorldlineDirectConstants = require('*/cartridge/scripts/worldline/direct/constants');
const paymentProductOverridesHelper = require('*/cartridge/scripts/worldline/direct/paymentProductOverridesHelper');
const worldlineDirectSubscriptionHelper = require('*/cartridge/scripts/worldline/direct/subscriptionHelper');

const logger = Logger.getRootLogger();
const currentSite = Site.getCurrent();

/**
 * Private function which updates the order payment instrument
 * @param {dw.order.Order} order - The current order
 * @param {dw.order.PaymentTransaction} paymentTransaction - The current payment transaction
 * @param {Object} payment -  The PaymentResult Object
 */
function updatePaymentTransaction(order, paymentTransaction, payment) {
    let transactionAmount = worldlineDirectCommonHelper.convertWorldlineAmountToMoney(payment.paymentOutput.amountOfMoney.amount, payment.paymentOutput.amountOfMoney.currencyCode);
    let acquiredAmount = worldlineDirectCommonHelper.convertWorldlineAmountToMoney(payment.paymentOutput.acquiredAmount.amount, payment.paymentOutput.acquiredAmount.currencyCode);

    Transaction.wrap(function () {
        paymentTransaction.setTransactionID(payment.id);
        paymentTransaction.setAmount(transactionAmount);
        paymentTransaction.custom.worldlineDirectAcquiredAmount = acquiredAmount;
    });

    worldlineDirectCommonHelper.updatePaymentTransaction(order, payment.status, payment.statusOutput, null);
}


/**
 * Creates a Hosted Tokenization Session.
 * @returns {Object} a tokenization result
 */
function createHostedTokenizationSession() {
    var requestBody = {
        locale: request.locale,
        askConsumerConsent: session.customer.authenticated === true,
        variant: currentSite.getCustomPreferenceValue('worldlineDirectHTPTemplate')
    };

    var tokens = worldlineDirectCommonHelper.getWalletPaymentIntsrumentTokensByPaymentMethod(WorldlineDirectConstants.PAYMENT_METHOD_CARD, session.customer);

    if (tokens.length) {
        requestBody.tokens = tokens.join(',');
    }

    return worldlineDirectApiFacade.createHostedTokenizationSession({ requestBody: requestBody });
}

/**
 * Verifies that entered credit card information is a valid card. If the information is valid a
 * credit card payment instrument is created
 * @param {dw.order.Basket} basket Current users's basket
 * @param {Object} paymentInformation - the payment information
 * @param {string} paymentMethodID - paymentmethodID
 * @param {Object} req the request object
 * @return {Object} returns an error object
 */
function Handle(basket, paymentInformation, paymentMethodID, req) {
    var currentBasket = basket;
    var tokenizationResult = worldlineDirectApiFacade.getHostedTokenizationSession(paymentInformation.hostedCheckoutId.value);

    logger.debug(JSON.stringify(tokenizationResult));

    if (tokenizationResult.error || !('token' in tokenizationResult)) {
        return { fieldErrors: {}, serverErrors: [Resource.msg('error.payment.not.valid', 'worldlineDirect', null)], error: true };
    }

    var worldlineDirectPaymentProductID = tokenizationResult.token.paymentProductId;
    var paymentProductOverride = paymentProductOverridesHelper.getPaymentProduct(worldlineDirectPaymentProductID);

    var paymentMethodIsDisabled = paymentProductOverride && paymentProductOverride.isShown === false;
    if (paymentMethodIsDisabled) {
        if (tokenizationResult.token.isTemporary === false) {
            worldlineDirectApiFacade.deleteToken(tokenizationResult.token.id);
        }

        return { fieldErrors: {}, serverErrors: [Resource.msg('error.payment.not.supported', 'worldlineDirect', null)], error: true };
    }

    var token = tokenizationResult.token;
    var cardData = token.card.data.cardWithoutCvv;

    var countryCode = worldlineDirectCommonHelper.getCustomerCountryCode(currentBasket);

    var worldlinePaymentProductServiceResponse = worldlineDirectApiFacade.getPaymentProduct(token.paymentProductId, {
        countryCode: countryCode,
        currencyCode: currentBasket.currencyCode
    });

    if (currentSite.getCustomPreferenceValue('worldlineDirectApplySurcharge')) {
        var surchargeResult = worldlineDirectApiFacade.calculateSurcharge({
            cardSource: { 
                token: token.id
            },
            amountOfMoney: {
                amount: worldlineDirectCommonHelper.convertMoneyToWorldlineAmount(currentBasket.getTotalGrossPrice()),
                currencyCode: currentBasket.currencyCode
            }
        });

        if (surchargeResult.error) {
            return { fieldErrors: {}, serverErrors: [Resource.msg('error.payment.not.supported', 'worldlineDirect', null)], error: true };
        }

        var surchargeAmount = new dw.value.Money(0, currentBasket.currencyCode);

        surchargeResult.surcharges.forEach(function(surcharge){
            surchargeAmount = surchargeAmount.add(worldlineDirectCommonHelper.convertWorldlineAmountToMoney(surcharge.surchargeAmount.amount, surcharge.surchargeAmount.currencyCode));
        });

        Transaction.wrap(function () {
            basket.custom.worldlineDirectSurchargeAmount = surchargeAmount.value;
        });
    }

    var paymentProduct = worldlinePaymentProductServiceResponse.paymentProduct;

    var orderPaymentInstrument = Transaction.wrap(function () {
        var paymentInstruments = currentBasket.getPaymentInstruments();

        collections.forEach(paymentInstruments, function (item) {
            currentBasket.removePaymentInstrument(item);
        });

        var paymentInstrument = currentBasket.createPaymentInstrument(
            paymentMethodID, currentBasket.totalGrossPrice
        );

        paymentInstrument.setCreditCardHolder(cardData.cardholderName);
        paymentInstrument.setCreditCardType(paymentProduct.displayHints.label);
        paymentInstrument.setCreditCardExpirationMonth(parseInt(cardData.expiryDate.slice(0, 2), 10));
        paymentInstrument.setCreditCardExpirationYear(parseInt('20' + cardData.expiryDate.slice(2, 4), 10));
        paymentInstrument.setCreditCardToken(token.id);

        paymentInstrument.custom.worldlineDirectCardExpiry = cardData.expiryDate;
        paymentInstrument.custom.worldlineDirectPaymentProductID = paymentProduct.id;
        paymentInstrument.custom.worldlineDirectPaymentProductName = paymentProduct.displayHints.label;
        paymentInstrument.custom.worldlineDirectPaymentMethod = paymentProduct.paymentMethod;
        paymentInstrument.custom.worldlineDirectCreditCardAlias = token.card.alias;

        return paymentInstrument;
    });

    var subscribtionData = worldlineDirectSubscriptionHelper.getSubscriptionData(basket);

    if (!token.isTemporary && tokenizationResult.status === WorldlineDirectConstants.TOKEN_CREATED && !subscribtionData.selected) {
        var customer = session.getCustomer();

        if (customer.authenticated) {
            worldlineDirectCommonHelper.savePaymentInstrumentToWallet(token.id, orderPaymentInstrument, customer);
        }
    }

    if (subscribtionData.selected && token.isTemporary) {
        return { fieldErrors: {}, serverErrors: [Resource.msg('worldline.checkout.subscription.tokenize.error', 'worldlineDirect', null)], error: true };
    }

    return { fieldErrors: {}, serverErrors: [], error: false };
}

/**
 * Authorizes a payment using a credit card. Customizations may use other processors and custom
 *      logic to authorize credit card payment.
 * @param {dw.order.Order} order - The current order
 * @param {dw.order.PaymentInstrument} paymentInstrument -  The payment instrument to authorize
 * @param {dw.order.PaymentProcessor} paymentProcessor -  The payment processor of the current
 *      payment method
 * @return {Object} returns an error object
 */
function Authorize(order, paymentInstrument, paymentProcessor) {
    const WorldlineDirectOrderDTO = require('*/cartridge/scripts/worldline/direct/dto/order');
    const WorldlineDirectTokenizedCardPaymentMethodSpecificInputDTO = require('*/cartridge/scripts/worldline/direct/dto/input/tokenizedcardpayment');

    let authResponse = { fieldErrors: {}, serverErrors: [], error: false };

    try {
        var requestBody = {};

        requestBody.order = new WorldlineDirectOrderDTO(order, true);
        requestBody.cardPaymentMethodSpecificInput = new WorldlineDirectTokenizedCardPaymentMethodSpecificInputDTO(paymentInstrument, order);

        var paymentResponse = worldlineDirectApiFacade.createPayment({ requestBody: requestBody });

        if (paymentResponse.error) {
            throw new Error(paymentResponse.errorMessage);
        }

        updatePaymentTransaction(order, paymentInstrument.paymentTransaction, paymentResponse.payment);

        worldlineDirectCommonHelper.handlePaymentStatus(order, paymentResponse.payment);

        Transaction.wrap(function () {
            order.custom.isWorldlineDirectOrder = true;
            order.custom.worldlineDirectTransactionID = worldlineDirectCommonHelper.standartiseTransactionId(paymentResponse.payment.id);
            paymentInstrument.paymentTransaction.setPaymentProcessor(paymentProcessor);

            if ('authorisationCode' in paymentResponse.payment.paymentOutput.cardPaymentMethodSpecificOutput) {
                paymentInstrument.custom.worldlineDirectAuthorisationCode = paymentResponse.payment.paymentOutput.cardPaymentMethodSpecificOutput.authorisationCode;
            }
            
            if ('schemeReferenceData' in paymentResponse.payment.paymentOutput.cardPaymentMethodSpecificOutput) {
                paymentInstrument.custom.worldlineDirectCardSchemeReferenceData = paymentResponse.payment.paymentOutput.cardPaymentMethodSpecificOutput.schemeReferenceData;
            }

            if ('surchargeSpecificOutput' in paymentResponse.payment.paymentOutput && 'surchargeAmount' in paymentResponse.payment.paymentOutput.surchargeSpecificOutput) {
                var surchargeAmount = worldlineDirectCommonHelper.convertWorldlineAmountToMoney(paymentResponse.payment.paymentOutput.surchargeSpecificOutput.surchargeAmount.amount, paymentResponse.payment.paymentOutput.surchargeSpecificOutput.surchargeAmount.currencyCode);
                order.custom.worldlineDirectSurchargeAmount = surchargeAmount.value;
            }
        });

        if ('merchantAction' in paymentResponse && 'actionType' in paymentResponse.merchantAction && paymentResponse.merchantAction.actionType === 'REDIRECT') {
            authResponse.redirect = true;
            authResponse.redirectUrl = paymentResponse.merchantAction.redirectData.redirectURL;
            authResponse.redirectOrderNo = order.orderNo;
            authResponse.redirectOrderToken = order.orderToken;
        }
    } catch (e) {
        logger.error(e);

        authResponse.error = true;
        authResponse.serverErrors.push(
            Resource.msg('error.payment.not.valid', 'checkout', null)
        );
    }

    return authResponse;
}

/**
 * Validates a payment using Worldline-Direct after successful redirect to the site
 * @param {dw.order.Order} order - The current order
 * @param {dw.order.PaymentInstrument} paymentInstrument -  The payment instrument to validate
 * @param {Object} paymentResult -  The PaymentResult Object
 * @return {Object} returns an error object
 */
function validatePayment(order, paymentInstrument, paymentResult) {
    var error = false;
    var redirectUrl;
    var paymentResponse = {};

    try {
        updatePaymentTransaction(order, paymentInstrument.paymentTransaction, paymentResult);

        var cardPaymentData = paymentResult.paymentOutput.cardPaymentMethodSpecificOutput;

        if ('authorisationCode' in cardPaymentData) {
            try {
                Transaction.wrap(function () {
                    paymentInstrument.custom.worldlineDirectAuthorisationCode = cardPaymentData.authorisationCode;
                });
            } catch (e) {
                logger.error(e);
            }
        }

        if ('schemeReferenceData' in cardPaymentData) {
            try {
                Transaction.wrap(function () {
                    paymentInstrument.custom.worldlineDirectCardSchemeReferenceData = cardPaymentData.schemeReferenceData;
                });
            } catch (e) {
                logger.error(e);
            }
        }

        paymentResponse.fraudResults = cardPaymentData.fraudResults;
        paymentResponse.threeDSecureResults = cardPaymentData.threeDSecureResults;

        worldlineDirectCommonHelper.handlePaymentStatus(order, paymentResult);
    } catch (e) {
        logger.error(e);

        error = true;
        redirectUrl = URLUtils.https('Checkout-Begin', 'stage', 'payment', 'showError', 'true').toString();
    }

    return { error: error, redirectUrl: redirectUrl, payment: paymentResponse };
}

exports.Handle = Handle;
exports.Authorize = Authorize;
exports.validatePayment = validatePayment;
exports.createHostedTokenizationSession = createHostedTokenizationSession;
