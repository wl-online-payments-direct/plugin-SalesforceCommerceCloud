'use strict';

const Resource = require('dw/web/Resource');
const Transaction = require('dw/system/Transaction');
const Logger = require('dw/system/Logger');

const collections = require('*/cartridge/scripts/util/collections');
const worldlineDirectCommonHelper = require('*/cartridge/scripts/worldline/direct/commonHelper');
const worldlineDirectSubscriptionHelper = require('*/cartridge/scripts/worldline/direct/subscriptionHelper');

const logger = Logger.getRootLogger();

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
 * Creates a payment with Worldline-Direct with Server-to-Server integration
 * @param {dw.order.Order} order - The current order
 * @param {dw.order.PaymentInstrument} paymentInstrument -  The payment instrument to authorize
 * @param {dw.order.PaymentProcessor} paymentProcessor -  The payment processor of the current
 *      payment method
 * @return {Object} returns an error object
 */
function AuthorizeOCAPI(order, paymentInstrument, paymentProcessor) {
    const worldlineDirectApiFacade = require('*/cartridge/scripts/worldline/direct/api/facade');
    const WorldlineDirectOrderDTO = require('*/cartridge/scripts/worldline/direct/dto/order');
    const WorldlineDirectSepaDirectPaymentMethodSpecificInputDTO = require('*/cartridge/scripts/worldline/direct/dto/input/sepadirectpayment');

    let authResponse = { fieldErrors: {}, serverErrors: [], error: false };

    try {
        var requestBody = {};

        requestBody.order = new WorldlineDirectOrderDTO(order);
        requestBody.sepaDirectDebitPaymentMethodSpecificInput = new WorldlineDirectSepaDirectPaymentMethodSpecificInputDTO(paymentInstrument, order);

        var paymentResponse = worldlineDirectApiFacade.createPayment({ requestBody: requestBody });

        if (paymentResponse.error) {
            throw new Error(paymentResponse.errorMessage);
        }

        let payment = paymentResponse.payment;

        let transactionAmount = worldlineDirectCommonHelper.convertWorldlineAmountToMoney(payment.paymentOutput.amountOfMoney.amount, payment.paymentOutput.amountOfMoney.currencyCode);
        let acquiredAmount = worldlineDirectCommonHelper.convertWorldlineAmountToMoney(payment.paymentOutput.acquiredAmount.amount, payment.paymentOutput.acquiredAmount.currencyCode);
    
        Transaction.wrap(function () {
            paymentInstrument.paymentTransaction.setTransactionID(payment.id);
            paymentInstrument.paymentTransaction.setAmount(transactionAmount);
            paymentInstrument.paymentTransaction.custom.worldlineDirectAcquiredAmount = acquiredAmount;
        });
    
        worldlineDirectCommonHelper.updatePaymentTransaction(order, payment.status, payment.statusOutput, null);
        worldlineDirectCommonHelper.handlePaymentStatus(order, payment);

        Transaction.wrap(function () {
            order.custom.isWorldlineDirectOrder = true;
            order.custom.worldlineDirectTransactionID = worldlineDirectCommonHelper.standartiseTransactionId(paymentResponse.payment.id);
            paymentInstrument.paymentTransaction.setPaymentProcessor(paymentProcessor);
        });
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
    const WorldlineDirectSepaDirectPaymentMethodSpecificInputDTO = require('*/cartridge/scripts/worldline/direct/dto/input/sepadirectpayment');

    var serverErrors = [];
    var fieldErrors = {};
    var authResponse = { error: false };

    try {
        var requestBody = {};

        requestBody.order = new WorldlineDirectOrderDTO(order, false);
        requestBody.hostedCheckoutSpecificInput = new WorldlineDirectHostedCheckoutSpecificInputDTO(paymentInstrument, order);
        requestBody.sepaDirectDebitPaymentMethodSpecificInput = new WorldlineDirectSepaDirectPaymentMethodSpecificInputDTO(paymentInstrument, order);

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

                if ('sepaDirectDebitPaymentMethodSpecificOutput' in payment.paymentOutput) {
                    paymentInstrument.custom.worldlineDirectMandateReference = payment.paymentOutput.sepaDirectDebitPaymentMethodSpecificOutput.paymentProduct771SpecificOutput.mandateReference;
                }
            });
        } catch (e) {
            logger.error("[worldline_direct_directdebit.js#148] " + e);
        }

        worldlineDirectCommonHelper.updatePaymentTransaction(order, payment.status, payment.statusOutput, paymentStatusCategory);
        worldlineDirectCommonHelper.handlePaymentStatus(order, payment);
        worldlineDirectCommonHelper.validateAmountPaid(order, payment.paymentOutput);
    } catch (e) {
        logger.error("[worldline_direct_directdebit.js#156] " + e);

        error = true;
        redirectUrl = URLUtils.https('Checkout-Begin', 'stage', 'payment', 'showError', 'true').toString();
    }

    return { error: error, redirectUrl: redirectUrl, payment: paymentResponse };
}

exports.Handle = Handle;
exports.Authorize = Authorize;
exports.AuthorizeOCAPI = AuthorizeOCAPI;
exports.validatePayment = validatePayment;