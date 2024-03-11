const server = require('server');

const worldlineDirectCommonHelper = require('*/cartridge/scripts/worldline/direct/commonHelper');
const worldlineApiFacade = require('*/cartridge/scripts/worldline/direct/api/facade');
const WorldlineDirectConstants = require('*/cartridge/scripts/worldline/direct/constants');

const SystemObjectMgr = require('dw/object/SystemObjectMgr');
const ArrayList = require('dw/util/ArrayList');
const Calendar = require('dw/util/Calendar');
const URLUtils = require('dw/web/URLUtils');
const StringUtils = require('dw/util/StringUtils');
const PagingModel = require('dw/web/PagingModel');
const Order = require('dw/order/Order');
const OrderMgr = require('dw/order/OrderMgr');
const PropertyComparator = require('dw/util/PropertyComparator');
const csrfProtection = require('*/cartridge/scripts/middleware/csrf');

/**
 * Middleware validating order in query params
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next call in the middleware chain
 * @returns {void}
 */
function getOrderFromQueryParams(req, res, next) {
    var orderNo = request.httpParameterMap.orderNo.value;
    var orderToken = request.httpParameterMap.ot.value;

    var order = orderNo && orderToken ? OrderMgr.getOrder(orderNo, orderToken) : null;
    if (empty(order)) {
        res.json({
            success: false
        });
        return;
    }

    var viewData = res.getViewData();
    viewData.order = order;
    res.setViewData(viewData);

    next();
}

/**
 * Combine orders and worldlineNewTransactions Custom Objects into one array for pagination
 *
 * @param {string} orderNo - Order number used in "Search by order number" feature
 * @param {string} orderUUID - Optional, in case a specific order needs to be returned
 * @returns {dw.util.ArrayList} Combined array with all orders
 */
function getOrders(orderNo, orderUUID) {
    var systemOrders = orderUUID != null
        ? SystemObjectMgr.querySystemObjects('Order', 'UUID = {0}', null, orderUUID)
        : SystemObjectMgr.querySystemObjects('Order', 'orderNo LIKE {0} AND custom.isWorldlineDirectOrder = {1} AND status != {2}', 'creationDate desc', orderNo, true, Order.ORDER_STATUS_FAILED);

    var orders = new ArrayList();
    var order;
    var paymentInstrument;
    var orderDate;
    var obj;

    var orderIndex = 0;
    var maxSystemOrdersCount = 9000;
    var maxworldlineOrdersCount = 9000;
    var worldlineOrdersCount = 0;
    if (worldlineOrdersCount < maxworldlineOrdersCount) {
        maxSystemOrdersCount = 18000 - worldlineOrdersCount;
    }

    while (systemOrders.hasNext()) {
        orderIndex++;
        if (orderIndex > maxSystemOrdersCount) {
            break;
        }
        order = systemOrders.next();
        paymentInstrument = worldlineDirectCommonHelper.getWorldlinePaymentInstrument(order);

        if (paymentInstrument === null) {
            continue; // eslint-disable-line no-continue
        }
        orderDate = new Date(order.creationDate);
        obj = {
            orderNo: order.orderNo,
            orderToken: order.orderToken,
            orderDate: StringUtils.formatCalendar(new Calendar(orderDate), 'M/dd/yy h:mm a'),
            createdBy: order.createdBy,
            isRegestered: order.customer.registered,
            customer: order.customerName,
            email: order.customerEmail,
            orderTotal: order.totalGrossPrice,
            currencyCode: order.getCurrencyCode(),
            worldlineAmount: paymentInstrument.getPaymentTransaction().getAmount(),
            worldlineDirectTransactionID: paymentInstrument.getPaymentTransaction().getTransactionID(),
            statusCategory: order.custom.worldlineDirectStatusCategory.value,
            dateCompare: orderDate.getTime(),
            isCustom: false
        };
        orders.push(obj);
    }
    systemOrders.close();

    orderIndex = 0;

    orders.sort(new PropertyComparator('dateCompare', false));

    return orders;
}

/**
 * Takes a PagingModel and returns an object with pagination parameters.
 * @param {dw.web.PagingModel} pagingModel The paging model
 * @param {string} pageURL The url of the page
 * @returns {Object} Pagination parameters
 */
function getPaginationParameters(pagingModel, pageURL) {
    var current = pagingModel.start;
    var totalCount = pagingModel.count;
    var pageSize = pagingModel.pageSize;
    var currentPage = pagingModel.currentPage;
    var maxPage = pagingModel.maxPage;

    var showingStart = current + 1;
    var showingEnd = current + pageSize;

    if (showingEnd > totalCount) {
        showingEnd = totalCount;
    }

    var lr = 2;
    var rangeBegin = 0;
    var rangeEnd = 0;

    if (maxPage <= 2 * lr) {
        rangeBegin = 1;
        rangeEnd = maxPage - 1;
    } else {
        rangeBegin = Math.max(Math.min(currentPage - lr, maxPage - (2 * lr)), 1);
        rangeEnd = Math.min(rangeBegin + (2 * lr), maxPage - 1);
    }

    var httpParameters = [];
    for (let i = 0; i < request.httpParameterMap.parameterCount; i++) {
        var parameterName = request.httpParameterMap.parameterNames[i];

        if (parameterName !== 'page') {
            httpParameters.push({
                key: parameterName,
                value: request.httpParameterMap[parameterName]
            });
        }
    }

    return {
        totalCount: totalCount,
        pageSize: pageSize,
        maxPage: maxPage,
        currentPage: currentPage,
        rangeBegin: rangeBegin,
        rangeEnd: rangeEnd,
        showingStart: showingStart,
        showingEnd: showingEnd,
        pageURL: pageURL,
        httpParameters: httpParameters
    };
}

/**
 * Get orders list. Can be filtered by order ID or transaction ID
 */
server.use('Orders',
    server.middleware.https,
    csrfProtection.validateRequest,
function (req, res, next) {
    var orderNo;
    var orderUUID = !empty(request.httpParameterMap.OrderID.stringValue) ? request.httpParameterMap.OrderID.stringValue : null;
    var alternativeFlow = false;
    var orders;

    if (request.httpParameterMap.transactionId.submitted && !empty(request.httpParameterMap.transactionId.stringValue)) {
        var transactionId = request.httpParameterMap.transactionId.stringValue;

        var systemOrder = SystemObjectMgr.querySystemObjects('Order', 'custom.isWorldlineDirectOrder = {0} AND custom.worldlineDirectTransactionID LIKE {1}', 'creationDate desc', true, transactionId);
        var firstOrder = (new ArrayList(systemOrder)).toArray()[0];
        if (firstOrder) {
            orderNo = firstOrder.orderNo;
        }

        systemOrder.close();
    }

    if (!orderNo) {
        alternativeFlow = true;
    }

    if (alternativeFlow) {
        orderNo = empty(request.httpParameterMap.orderNo.stringValue) ? '*' : request.httpParameterMap.orderNo.stringValue;
        orderNo = request.httpParameterMap.transactionId.submitted ? '0' : orderNo;
        orderNo = request.httpParameterMap.transactionId.stringValue === '' ? '*' : orderNo;
    }

    orders = getOrders(orderNo, orderUUID);

    var pageSize = !empty(request.httpParameterMap.pagesize.intValue) ? request.httpParameterMap.pagesize.intValue : 10;
    var currentPage = request.httpParameterMap.page.intValue ? request.httpParameterMap.page.intValue : 1;
    pageSize = pageSize === 0 ? orders.length : pageSize;
    var start = pageSize * (currentPage - 1);

    var orderPagingModel = new PagingModel(orders);

    orderPagingModel.setPageSize(pageSize);
    orderPagingModel.setStart(start);

    var isSearchByOrderNo = request.httpParameterMap.orderNo.submitted;
    var isSearchByTransaction = request.httpParameterMap.transactionId.submitted;

    if (!isSearchByOrderNo && !isSearchByTransaction) {
        isSearchByOrderNo = true;
    }

    res.render('worldlinebm/orderList', {
        orderUUID: orderUUID,
        PagingModel: orderPagingModel,
        paginationParameters: getPaginationParameters(orderPagingModel, URLUtils.https('WorldlineDirectAdmin-Orders').toString()),
        isSearchByOrderNo: isSearchByOrderNo,
        isSearchByTransaction: isSearchByTransaction
    });
    next();
});

/**
 * Returns an object that specifies whether a transaction can be captured or cancelled.
 *
 * @param {dw.order.Order} order the referenced order
 * @param {Object} paymentDetailsResponse the response from the get-payment API
 * @returns {Object} an object that specifies whether a transaction can be captured or cancelled
 */
function getAllowedTransactionOperations(order, paymentDetailsResponse) {
    var res = {};
    if (paymentDetailsResponse) {
        res.transactionIsCancellable = order.custom.worldlineDirectStatusCategory.value !== WorldlineDirectConstants.COMPLETED_PAYMENT_STATUS_CATEGORY && paymentDetailsResponse.paymentOutput.amountOfMoney.amount > 0;
    }

    res.transactionIsCapturable = order.custom.worldlineDirectStatusCategory.value !== WorldlineDirectConstants.COMPLETED_PAYMENT_STATUS_CATEGORY;

    return res;
}

/**
 * Helper function to format the JSON error
 * @param {Object} apiResponse the API response object
 * @returns {Object} formatted JSON error
 */
function getErrorJSON(apiResponse) {
    var jsonError = null;

    if (apiResponse.errorMessage) {
        try {
            jsonError = JSON.parse(apiResponse.errorMessage);
        } catch (e) {}  // eslint-disable-line no-empty
    }

    return {
        success: false,
        errorMessage: jsonError
    };
}

server.get('PaymentDialog',
    server.middleware.https,
    csrfProtection.validateRequest,
    getOrderFromQueryParams,
function (req, res, next) {
    var viewData = res.getViewData();
    var order = viewData.order;
    var worldlinePaymentId = request.httpParameterMap.worldlinePaymentId.value;
    var paymentDetails = worldlineApiFacade.getPayment(worldlinePaymentId);
    var paymentCaptures = worldlineApiFacade.getPaymentCaptures(worldlinePaymentId);
    var paymentRefunds = worldlineApiFacade.getPaymentRefunds(worldlinePaymentId);

    var capturedAmount = paymentCaptures.success == true ? worldlineDirectCommonHelper.getCapturedAmount(order, paymentCaptures.captures, paymentDetails.paymentOutput.acquiredAmount.amount) : 0;
    var refundedAmount = paymentRefunds.success == true ? worldlineDirectCommonHelper.getRefundedAmount(paymentRefunds.refunds) : 0;

    if (paymentDetails.success !== true) {
        res.json(getErrorJSON(paymentDetails));
        next();
        return;
    }

    var transactionOperations = getAllowedTransactionOperations(order, paymentDetails);

    res.render('worldlinebm/paymentDialog', {
        order: order,
        paymentDetailsResponse: paymentDetails,
        capturedAmount: capturedAmount,
        refundedAmount: refundedAmount,

        transactionIsCancellable: transactionOperations.transactionIsCancellable,
        transactionIsCapturable: transactionOperations.transactionIsCapturable
    });
    next();
});

server.get('RefreshPaymentDetails',
    server.middleware.https,
    csrfProtection.validateRequest,
    getOrderFromQueryParams,
function (req, res, next) {
    var viewData = res.getViewData();
    var order = viewData.order;
    var worldlinePaymentId = request.httpParameterMap.worldlinePaymentId.value;
    var paymentDetails = worldlineApiFacade.getPayment(worldlinePaymentId);
    var paymentCaptures = worldlineApiFacade.getPaymentCaptures(worldlinePaymentId);
    var paymentRefunds = worldlineApiFacade.getPaymentRefunds(worldlinePaymentId);

    var capturedAmount = paymentCaptures.success == true ? worldlineDirectCommonHelper.getCapturedAmount(order, paymentCaptures.captures, paymentDetails.paymentOutput.amountOfMoney.amount) : 0;
    var refundedAmount = paymentRefunds.success == true ? worldlineDirectCommonHelper.getRefundedAmount(paymentRefunds.refunds) : 0;

    if (paymentDetails.success !== true) {
        res.render('worldlinebm/components/worldlineServerError', paymentDetails);

        next();
        return;
    }

    var transactionOperations = getAllowedTransactionOperations(order, paymentDetails);

    res.render('worldlinebm/paymentDetails', {
        order: order,
        paymentDetailsResponse: paymentDetails,
        capturedAmount: capturedAmount,
        refundedAmount: refundedAmount,

        transactionIsCancellable: transactionOperations.transactionIsCancellable,
        transactionIsCapturable: transactionOperations.transactionIsCapturable
    });
    next();
});

server.get('ListPaymentCaptures',
    server.middleware.https,
    csrfProtection.validateRequest,
    getOrderFromQueryParams,
function (req, res, next) {
    var viewData = res.getViewData();
    var order = viewData.order;
    var paymentId = request.httpParameterMap.worldlinePaymentId.value;
    var paymentCaptures = worldlineApiFacade.getPaymentCaptures(paymentId);
    var paymentDetails = worldlineApiFacade.getPayment(paymentId);

    if (paymentCaptures.success !== true || paymentDetails.success !== true) {
        res.render('worldlinebm/components/worldlineServerError', paymentCaptures);

        next();
        return;
    }

    var capturedAmount = worldlineDirectCommonHelper.getCapturedAmount(order, paymentCaptures.captures, paymentDetails.paymentOutput.acquiredAmount.amount);
    var capturableAmount = worldlineDirectCommonHelper.getCapturableAmount(order, paymentCaptures.captures, paymentDetails.paymentOutput.amountOfMoney.amount);

    var transactionOperations = getAllowedTransactionOperations(order, paymentDetails);

    res.render('worldlinebm/listPaymentCaptures', {
        paymentCaptures: paymentCaptures.captures,
        paymentDetailsResponse: paymentDetails,
        capturableAmount: capturableAmount,
        capturedAmount: capturedAmount,

        transactionIsCancellable: transactionOperations.transactionIsCancellable,
        transactionIsCapturable: transactionOperations.transactionIsCapturable
    });
    next();
});

server.get('ListPaymentRefunds',
    server.middleware.https,
    csrfProtection.validateRequest,
    getOrderFromQueryParams,
function (req, res, next) {
    var viewData = res.getViewData();
    var order = viewData.order;
    var paymentId = request.httpParameterMap.worldlinePaymentId.value;
    var paymentCaptures = worldlineApiFacade.getPaymentCaptures(paymentId);
    var paymentRefunds = worldlineApiFacade.getPaymentRefunds(paymentId);
    var paymentDetails = worldlineApiFacade.getPayment(paymentId);

    if (paymentRefunds.success !== true || paymentDetails.success !== true) {
        res.render('worldlinebm/components/worldlineServerError', paymentRefunds);

        next();
        return;
    }

    var refundableAmount = 0;
    if (paymentCaptures.success === true) {
        var capturedAmount = worldlineDirectCommonHelper.getCapturedAmount(order, paymentCaptures.captures, paymentDetails.paymentOutput.acquiredAmount.amount);

        refundableAmount = capturedAmount - worldlineDirectCommonHelper.getRefundedAmount(paymentRefunds.refunds);
        if (refundableAmount < 0) {
            refundableAmount = 0;
        }
    }

    res.render('worldlinebm/listPaymentRefunds', {
        paymentRefunds: paymentRefunds.refunds,
        paymentDetailsResponse: paymentDetails,
        refundableAmount: refundableAmount
    });
    next();
});

server.post('CapturePayment',
    server.middleware.https,
    csrfProtection.validateRequest,
    getOrderFromQueryParams,
function (req, res, next) {
    var viewData = res.getViewData();
    var order = viewData.order;
    var paymentId = request.httpParameterMap.worldlinePaymentId.value;
    var amount = worldlineDirectCommonHelper.convertMoneyAmountToWorldlineAmount(parseFloat(request.httpParameterMap.amount.value), order.getCurrencyCode());
    var isFinal = false;
    var result = worldlineApiFacade.capturePayment(paymentId, amount, isFinal);
    if (!result.success) {
        res.json(getErrorJSON(result));
        next();
        return;
    }

    var worldlinePaymentInstrument = worldlineDirectCommonHelper.getWorldlinePaymentInstrument(order);

    if (!empty(worldlinePaymentInstrument)) {
        worldlineDirectCommonHelper.handlePaymentCapture(order, worldlinePaymentInstrument, result.status, result.statusOutput);
    }

    res.json(result);
    next();
});

server.post('RefundPayment',
    server.middleware.https,
    csrfProtection.validateRequest,
function (req, res, next) {
    var paymentId = request.httpParameterMap.worldlinePaymentId.value;
    var currencyCode = request.httpParameterMap.currencyCode.value;
    var amount = worldlineDirectCommonHelper.convertMoneyAmountToWorldlineAmount(parseFloat(request.httpParameterMap.amount.value), currencyCode);
    var result = worldlineApiFacade.refundPayment(paymentId, amount, currencyCode);

    if (!result.success) {
        res.json(getErrorJSON(result));
        next();
        return;
    }

    res.json(result);
    next();
});

server.post('CancelPayment',
    server.middleware.https,
    csrfProtection.validateRequest,
function (req, res, next) {
    var paymentId = request.httpParameterMap.worldlinePaymentId.value;
    var result = worldlineApiFacade.cancelPayment(paymentId);

    if (!result.success) {
        res.json(getErrorJSON(result));
        next();
        return;
    }

    res.json(result);
    next();
});

server.get('TestConnection',
    server.middleware.https,
    csrfProtection.validateRequest,
function (req, res, next) {
    var result = worldlineApiFacade.testConnection();

    if (!result.success) {
        res.json(getErrorJSON(result));
    } else {
        res.json(result);
    }

    next();
});


server.get('PaymentProductList',
    server.middleware.https,
    csrfProtection.validateRequest,
function (req, res, next) {
    const paymentProductOverridesHelper = require('*/cartridge/scripts/worldline/direct/paymentProductOverridesHelper');
    const worldlineDirectPaymentProducts = paymentProductOverridesHelper.getAllPaymentProducts();

    res.render('worldlinebm/paymentProducts/paymentProducts', {
        worldlineDirectPaymentProducts: worldlineDirectPaymentProducts
    });
    next();
});

server.get('PaymentProductView',
    server.middleware.https,
    csrfProtection.validateRequest,
function (req, res, next) {
    const paymentProductOverridesHelper = require('*/cartridge/scripts/worldline/direct/paymentProductOverridesHelper');

    const id = request.httpParameterMap.id.stringValue;
    const paymentProduct = id ? paymentProductOverridesHelper.getPaymentProduct(id) : null;

    res.render('worldlinebm/paymentProducts/viewPaymentProduct', {
        paymentProduct: paymentProduct
    });
    next();
});

server.post('PaymentProductSave',
    server.middleware.https,
    csrfProtection.validateRequest,
function (req, res, next) {
    const paymentProductOverridesHelper = require('*/cartridge/scripts/worldline/direct/paymentProductOverridesHelper');

    const id = request.httpParameterMap.id.stringValue;
    const name = request.httpParameterMap.name.stringValue;
    const isShown = !!request.httpParameterMap.isShown.booleanValue;
    const addNew = !!request.httpParameterMap.addNew.booleanValue;

    var paymentProduct = paymentProductOverridesHelper.getPaymentProduct(id);

    if (!id || (addNew && paymentProduct)) {
        // a payment product with that id already exists, return an error to prevent accidental overwrite
        res.json({
            success: false
        });
        return next();
    }

    if (addNew) {
        paymentProduct = {
            id: parseInt(id, 10)
        };
    }
    paymentProduct.name = name;
    paymentProduct.isShown = isShown;

    paymentProductOverridesHelper.savePaymentProduct(paymentProduct);

    res.json({
        success: true
    });
    return next();
});

server.post('PaymentProductDelete',
    server.middleware.https,
    csrfProtection.validateRequest,
function (req, res, next) {
    const paymentProductOverridesHelper = require('*/cartridge/scripts/worldline/direct/paymentProductOverridesHelper');

    const id = request.httpParameterMap.id.stringValue;
    const success = id ? paymentProductOverridesHelper.deletePaymentProduct(id) : false;

    res.json({
        success: success
    });
    return next();
});

module.exports = server.exports();

