'use strict';

const Logger = require('dw/system/Logger');
const Transaction = require('dw/system/Transaction');
const Resource = require('dw/web/Resource');
const URLUtils = require('dw/web/URLUtils');

const collections = require('*/cartridge/scripts/util/collections');
const worldlineDirectCommonHelper = require('*/cartridge/scripts/worldline/direct/commonHelper');
const worldlineDirectApiFacade = require('*/cartridge/scripts/worldline/direct/api/facade');

const logger = Logger.getRootLogger();

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
        paymentTransaction.setAmount(amountPaid);
        paymentTransaction.custom.worldlineDirectAcquiredAmount = acquiredAmount;
    });

    worldlineDirectCommonHelper.updatePaymentTransaction(order, payment.status, payment.statusOutput, null);
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
    var cardErrors = {};
    var serverErrors = [];

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
    });

    return { fieldErrors: cardErrors, serverErrors: serverErrors, error: false };
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

    let authResponse = { fieldErrors: {}, serverErrors: [], error: false };

    try {
        let requestBody = {};

        requestBody.order = new WorldlineDirectOrderDTO(order, false);
        const WorldlineDirectRedirectPaymentMethodSpecificInputDTO = require('*/cartridge/scripts/worldline/direct/dto/input/redirectpayment');
        requestBody.redirectPaymentMethodSpecificInput = new WorldlineDirectRedirectPaymentMethodSpecificInputDTO(paymentInstrument, paymentProcessor, order);

        let paymentResponse = worldlineDirectApiFacade.createPayment({ requestBody: requestBody });

        if (paymentResponse.error) {
            throw new Error(paymentResponse.errorMessage);
        }

        updatePaymentTransaction(order, paymentInstrument.paymentTransaction, paymentResponse.payment);

        worldlineDirectCommonHelper.handlePaymentStatus(order, paymentResponse.payment);

        Transaction.wrap(function () {
            paymentInstrument.paymentTransaction.setPaymentProcessor(paymentProcessor);
            order.custom.isWorldlineDirectOrder = true;
            order.custom.worldlineDirectTransactionID = worldlineDirectCommonHelper.standartiseTransactionId(paymentResponse.payment.id);
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
        var paymentStatusCategory = paymentResult.statusOutput.statusCategory;

        let transactionAmount = worldlineDirectCommonHelper.convertWorldlineAmountToMoney(paymentResult.paymentOutput.amountOfMoney.amount, paymentResult.paymentOutput.amountOfMoney.currencyCode);
        let acquiredAmount = worldlineDirectCommonHelper.convertWorldlineAmountToMoney(paymentResult.paymentOutput.acquiredAmount.amount, paymentResult.paymentOutput.acquiredAmount.currencyCode);

        Transaction.wrap(function () {
            var paymentTransaction = paymentInstrument.paymentTransaction;

            paymentTransaction.setTransactionID(paymentResult.id);
            paymentTransaction.setAmount(transactionAmount);
            paymentTransaction.custom.worldlineDirectAcquiredAmount = acquiredAmount;
        });

        worldlineDirectCommonHelper.updatePaymentTransaction(order, paymentResult.status, paymentResult.statusOutput, paymentStatusCategory);

        if (paymentResult.paymentOutput.paymentMethod === 'redirect') {
            var redirectPayment = paymentResult.paymentOutput.redirectPaymentMethodSpecificOutput;
            paymentResponse.fraudResults = redirectPayment.fraudResults;

            if ('token' in redirectPayment) {
                paymentResponse.token = redirectPayment.token;
            }
        }

        worldlineDirectCommonHelper.handlePaymentStatus(order, paymentResult.paymentOutput);
        worldlineDirectCommonHelper.validateAmountPaid(order, paymentResult.paymentOutput);

        if ('token' in paymentResponse) {
            var customer = session.getCustomer();

            if (customer.authenticated) {
                worldlineDirectCommonHelper.savePaymentInstrumentToWallet(paymentResponse.token, paymentInstrument, customer);
            }
        }
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
