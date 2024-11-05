'use strict';

/**
 * Verifies the required information for billing form is provided.
 * @param {Object} req - The request object
 * @param {Object} paymentForm - the payment form
 * @param {Object} viewFormData - object contains billing form data
 * @returns {Object} an object that has error information or payment information
 */
function processForm(req, paymentForm, viewFormData) {
    const BasketMgr = require('dw/order/BasketMgr');
    const Resource = require('dw/web/Resource');

    let viewData = viewFormData;
    let currentBasket = BasketMgr.getCurrentBasket();
    let fieldErrors = {};

    if (!paymentForm.paymentMethod.value && currentBasket.totalGrossPrice.value > 0) {
        fieldErrors[paymentForm.paymentMethod.htmlName] = Resource.msg('error.no.selected.payment.method', 'worldlineDirect', null);

        return {
            error: true,
            fieldErrors: fieldErrors
        };
    }

    delete session.privacy.worldlineDirectError;

    viewData.paymentMethod = {
        value: paymentForm.paymentMethod.value,
        htmlName: paymentForm.paymentMethod.value
    };

    viewData.paymentInformation = {
        paymentProductID: {
            value: paymentForm.worldlineDirectFields.paymentProductID.value,
            htmlName: paymentForm.worldlineDirectFields.paymentProductID.htmlName
        },
        paymentProductName: {
            value: paymentForm.worldlineDirectFields.paymentProductName.value,
            htmlName: paymentForm.worldlineDirectFields.paymentProductName.htmlName
        },
        paymentMethod: {
            value: paymentForm.worldlineDirectFields.paymentMethod.value,
            htmlName: paymentForm.worldlineDirectFields.paymentMethod.htmlName
        },
        savedCardToken: {
            value: paymentForm.worldlineDirectFields.savedCardToken.value,
            htmlName: paymentForm.worldlineDirectFields.savedCardToken.htmlName
        }
    };

    if (!empty(paymentForm.worldlineDirectFields.hostedCheckoutId)) {
        viewData.paymentInformation.hostedCheckoutId = {
            value: paymentForm.worldlineDirectFields.hostedCheckoutId.value,
            htmlName: paymentForm.worldlineDirectFields.hostedCheckoutId.htmlName
        };
    }

    return {
        error: false,
        viewData: viewData
    };
}

/**
 * Save the credit card information to login account if save card option is selected
 * @param {Object} req - The request object
 * @param {dw.order.Basket} basket - The current basket
 * @param {Object} billingData - payment information
 */
function savePaymentInformation(req, basket, billingData) {}

exports.processForm = processForm;
exports.savePaymentInformation = savePaymentInformation;
