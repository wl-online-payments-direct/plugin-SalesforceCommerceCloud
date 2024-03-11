'use strict';

const server = require('server');

const Site = require('dw/system/Site');
const OrderMgr = require('dw/order/OrderMgr');
const PaymentMgr = require('dw/order/PaymentMgr');
const Resource = require('dw/web/Resource');
const Transaction = require('dw/system/Transaction');
const URLUtils = require('dw/web/URLUtils');
const StringUtils = require('dw/util/StringUtils');
const Logger = require('dw/system/Logger');
const CustomObjectMgr = require('dw/object/CustomObjectMgr');

const hooksHelper = require('*/cartridge/scripts/helpers/hooks');
const collections = require('*/cartridge/scripts/util/collections');

const worldlineApiFacade = require('*/cartridge/scripts/worldline/direct/api/facade');
const worldlineDirectCommonHelper = require('*/cartridge/scripts/worldline/direct/commonHelper');
const logFilterHelper = require('*/cartridge/scripts/worldline/direct/logFilterHelper');

server.get('BackBtnReturn', server.middleware.https, function (req, res, next) {
    // the user clicked the Back browser button while being on an external payment site - we'll recreate their basket
    let orderNo = req.session.privacyCache.get("redirectOrderNo");
    let orderToken = req.session.privacyCache.get("redirectOrderToken");

    req.session.privacyCache.set("redirectOrderNo", null);
    req.session.privacyCache.set("redirectOrderToken", null);

    let order = OrderMgr.getOrder(orderNo, orderToken);
    if (!order) {
        throw new Error('error.order.notfound');
    }

    Transaction.wrap(function () {
        OrderMgr.failOrder(order, true);
    });
    res.redirect(URLUtils.https('Checkout-Begin', 'stage', 'payment'));

    return next();
});

server.get('HCPReturn', server.middleware.https, function (req, res, next) {
    var qs = request.getHttpParameterMap();
    var orderNo = qs.o.stringValue;
    var orderToken = qs.ot.stringValue;
    var hostedCheckoutId = qs.hostedCheckoutId.stringValue;
    var hostedCheckoutResult = worldlineApiFacade.getHostedCheckout(hostedCheckoutId);

    req.session.privacyCache.set("redirectOrderNo", null);
    req.session.privacyCache.set("redirectOrderToken", null);

    if (hostedCheckoutResult.error) {
        throw new Error('error.hostedcheckout.get');
    }

    if (hostedCheckoutResult.status === 'IN_PROGRESS') {
        throw new Error('error.payment.incomplete');
    }

    var order = OrderMgr.getOrder(orderNo, orderToken);

    if (!order) {
        throw new Error('error.order.notfound');
    }

    if (hostedCheckoutResult.status === 'CANCELLED_BY_CONSUMER') {
        Transaction.wrap(function () {
            OrderMgr.failOrder(order, true);
        });
        res.redirect(URLUtils.https('Checkout-Begin', 'stage', 'payment'));

        return next();
    }

    if (hostedCheckoutResult.status === 'CLIENT_NOT_ELIGIBLE_FOR_SELECTED_PAYMENT_PRODUCT' ||
            (hostedCheckoutResult.status === 'PAYMENT_CREATED' && !('payment' in hostedCheckoutResult.createdPaymentOutput))) {
        Transaction.wrap(function () { OrderMgr.failOrder(order, true); });

        session.privacy.worldlineDirectError = Resource.msg('error.payment.not.valid', 'worldlineDirect', null);
        res.redirect(URLUtils.https('Checkout-Begin', 'stage', 'payment', 'showError', 'true'));

        return next();
    }

    if (hostedCheckoutResult.createdPaymentOutput.payment.paymentOutput.references.merchantReference !== order.getOrderNo()) {
        throw new Error('error.order.mismatch');
    }

    let paymentInstrument = collections.find(order.getPaymentInstruments(), function (pi) {
        return pi.paymentTransaction.transactionID == hostedCheckoutResult.createdPaymentOutput.payment.hostedCheckoutSpecificOutput.hostedCheckoutId;
    });

    let paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstrument.paymentMethod).getPaymentProcessor();

    // Handles payment authorization
    let handlePaymentResult = hooksHelper('app.payment.processor.' + paymentProcessor.ID.toLowerCase(), 'validatePayment', order, paymentInstrument, hostedCheckoutResult, require('*/cartridge/scripts/hooks/payment/processor/worldline_direct_redirect').validatePayment);

    if (handlePaymentResult.error) {
        res.redirect(handlePaymentResult.redirectUrl);
        return next();
    }

    let orderPlacementResult = worldlineDirectCommonHelper.handleOrderPlacement(order, handlePaymentResult, req, res);

    if (orderPlacementResult.error && orderPlacementResult.errorMsg) {
        session.privacy.worldlineDirectError = orderPlacementResult.errorMsg;
    }

    res.redirect(orderPlacementResult.redirectUrl);

    return next();
});

server.get('HTPReturn', server.middleware.https, function (req, res, next) {
    let qs = request.getHttpParameterMap();
    let orderNo = qs.o.stringValue;
    let orderToken = qs.ot.stringValue;
    let paymentId = qs.paymentId.stringValue;

    req.session.privacyCache.set("redirectOrderNo", null);
    req.session.privacyCache.set("redirectOrderToken", null);

    let paymentResult = worldlineApiFacade.getPayment(paymentId);

    if (paymentResult.error) {
        throw new Error('error.worldline.payment.get');
    }

    let order = OrderMgr.getOrder(orderNo, orderToken);

    if (!order) {
        throw new Error('error.order.notfound');
    }

    if (paymentResult.paymentOutput.references.merchantReference !== order.getOrderNo()) {
        throw new Error('error.order.mismatch');
    }

    let paymentInstrument = collections.find(order.getPaymentInstruments(), function (pi) {
        return pi.paymentTransaction.transactionID == paymentResult.id;
    });

    let processor = PaymentMgr.getPaymentMethod(paymentInstrument.paymentMethod).getPaymentProcessor();

    // Handles payment authorization
    let handlePaymentResult = hooksHelper('app.payment.processor.' + processor.ID.toLowerCase(), 'validatePayment', order, paymentInstrument, paymentResult, require('*/cartridge/scripts/hooks/payment/processor/' + processor.ID.toLowerCase()).validatePayment);

    if (handlePaymentResult.error) {
        res.redirect(handlePaymentResult.redirectUrl);

        return next();
    }

    let orderPlacementResult = worldlineDirectCommonHelper.handleOrderPlacement(order, handlePaymentResult, req, res);

    if (orderPlacementResult.error && orderPlacementResult.errorMsg) {
        session.privacy.worldlineDirectError = orderPlacementResult.errorMsg;
    }

    res.redirect(orderPlacementResult.redirectUrl);

    return next();
});

server.get('HTPSession', server.middleware.https, function (req, res, next) {
    let worldlineDirectCardProcessor = require('*/cartridge/scripts/hooks/payment/processor/worldline_direct_credit');
    let tokenizationResult = worldlineDirectCardProcessor.createHostedTokenizationSession();

    res.json({
        error: !!tokenizationResult.error,
        redirectUrl: (tokenizationResult.redirectUrl || null)
    });

    return next();
});

server.get('OrderReturn', server.middleware.https, function (req, res, next) {
    let qs = request.getHttpParameterMap();

    req.session.privacyCache.set("redirectOrderNo", null);
    req.session.privacyCache.set("redirectOrderToken", null);

    res.render('checkout/orderReturnForm', {
        orderID: qs.ID.stringValue,
        orderToken: qs.token.stringValue
    });
    next();
});

/**
 * This is the controller that receives the webhooks and its URL should be specified in Worldline's backoffice.
 * As recommended in the documentation (https://support.direct.ingenico.com/documentation/api/webhooks), this controller should be kept as fast as possible:
 *
 * "Decouple your business logic from the actual handling of the webhook message.
 * We strongly recommend answering right away with a 2xx status code before you perform any follow-up actions later on.
 * This will prevent that we wrongfully assume that the webhook message was not delivered."
 */
server.post('Webhooks', server.middleware.https, function (req, res, next) {
    const currentSite = Site.getCurrent();
    const hooksLogger = Logger.getLogger('worldline-webhooks', 'worldline-webhooks');
    const worldlineDirectWebhooksHelper = require('*/cartridge/scripts/worldline/direct/webhooksHelper');

    var providedKeyId = request.httpHeaders.get("x-gcs-keyid");
    var providedSignature = request.httpHeaders.get("x-gcs-signature");
    var requestBody = request.httpParameterMap.requestBodyAsString || "";

    var jsonBody = JSON.parse(requestBody);

    // ignore webhooks that have no type
    if (!jsonBody || jsonBody.type === undefined) {
        let filteredRequestBody = logFilterHelper.filterJSONString(requestBody);
        hooksLogger.warn(StringUtils.format('Ignoring a webhook that has no type field: {0}', filteredRequestBody));

        res.setStatusCode(400);
        res.json({
            success: false
        });
        next();
        return;
    }

    // verify the webhook signature
    let webhooksKeyID = currentSite.getCustomPreferenceValue('worldlineDirectWebhooksKeyID');
    let webhooksKeySecret = currentSite.getCustomPreferenceValue('worldlineDirectWebhooksKeySecret');

    var signatureValid = worldlineDirectWebhooksHelper.validateSignature(requestBody, webhooksKeyID, webhooksKeySecret, providedKeyId, providedSignature);
    if (!signatureValid) {
        let filteredRequestBody = logFilterHelper.filterJSONString(requestBody);
        hooksLogger.warn("Received a webhook with an invalid signature: " + filteredRequestBody);
        res.setStatusCode(400);
        res.json({
            success: false
        });

        next();
        return;
    }


    let filteredRequestBody = logFilterHelper.filterJSONString(requestBody);
    hooksLogger.debug(StringUtils.format('Received a webhook:\nsignatureValid: {0},\nrequestBody:\n{1}', signatureValid, filteredRequestBody));

    try {
        Transaction.wrap(function () {
            let co = CustomObjectMgr.createCustomObject('WorldlineDirectWebhooks', jsonBody.id);
            co.custom.body = requestBody;
        });
    } catch (e) {
        hooksLogger.error(StringUtils.format('Exception occurred while creating a webhook custom object: {0}', e));

        res.setStatusCode(400);
        res.json({
            success: false
        });
        next();
        return;
    }

    res.setStatusCode(201);
    res.json({
        success: true
    });
    next();
});

module.exports = server.exports();
