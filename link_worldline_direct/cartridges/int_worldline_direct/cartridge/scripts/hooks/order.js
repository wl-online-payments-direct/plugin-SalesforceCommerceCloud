'use strict';


function beforePOST(basket) {
    const Basket = require('dw/order/Basket');

    if (basket.custom.worldlineDirectSubscriptionOrderType.value === 'MIT') {
        basket.setChannelType(Basket.CHANNEL_TYPE_SUBSCRIPTIONS);
    }
}

function authorizeCreditCard(order, paymentInstrument, cvn) {
    const HookMgr = require('dw/system/HookMgr');
    const PaymentMgr = require('dw/order/PaymentMgr');
    const Status = require('dw/system/Status');

    const paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstrument.paymentMethod).getPaymentProcessor();

    const authResponse = HookMgr.callHook('app.payment.processor.worldline_direct_credit', 'Authorize', order, paymentInstrument, paymentProcessor);

    if (authResponse.error) {
        return new Status(Status.ERROR);
    }

    return new Status(Status.OK);
}

function authorize(order, paymentInstrument) {
    const HookMgr = require('dw/system/HookMgr');
    const PaymentMgr = require('dw/order/PaymentMgr');
    const Status = require('dw/system/Status');

    const paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstrument.paymentMethod).getPaymentProcessor();

    var id = paymentProcessor.ID;
    var lid = paymentProcessor.ID.toLowerCase();

    const authResponse = HookMgr.callHook('app.payment.processor.' + paymentProcessor.ID.toLowerCase(), 'AuthorizeOCAPI', order, paymentInstrument, paymentProcessor);

    if (authResponse.error) {
        return new Status(Status.ERROR);
    }

    return new Status(Status.OK);
}

exports.beforePOST = beforePOST;
exports.authorizeCreditCard = authorizeCreditCard;
exports.authorize = authorize;
