const Order = require('dw/order/Order');
const OrderMgr = require('dw/order/OrderMgr');
const SystemObjectMgr = require('dw/object/SystemObjectMgr');
const StringUtils = require('dw/util/StringUtils');
const worldlineDirectCommonHelper = require('*/cartridge/scripts/worldline/direct/commonHelper');
const WorldlineDirectConstants = require('*/cartridge/scripts/worldline/direct/constants');
const Logger = require('dw/system/Logger');
const jobsLogger = Logger.getLogger('worldline-job-statuscheck', 'worldline-jobs');

var worldlineApiFacade;
var hooksHelper;

/**
 * Processes the orders in status "CREATED"
 * @param {Object} parameters the argument passed to the execute() function by SFCC
 * @param {Object} stepExecution the argument passed to the execute() function by SFCC
 */
function processCreatedOrders(parameters, stepExecution) {
    var date1HourAgo = new Date((new Date()).getTime() - (60 * 60 * 1000));
    var systemOrdersIterator = SystemObjectMgr.querySystemObjects('Order', 'status = {0} AND creationDate < {1}', null, Order.ORDER_STATUS_CREATED, date1HourAgo);
    jobsLogger.debug(StringUtils.format('Found {0} orders with status = Order.ORDER_STATUS_CREATED AND creationDate < "{1}"', systemOrdersIterator.count, date1HourAgo));

    while (systemOrdersIterator.hasNext()) {
        var order = systemOrdersIterator.next();
        var paymentInstrument = worldlineDirectCommonHelper.getWorldlinePaymentInstrument(order);

        if (!paymentInstrument) {
            jobsLogger.error(StringUtils.format('Skipping order {0} that does not have a payment instrument.', order.orderNo));
            continue;
        }

        var paymentTransaction = paymentInstrument.getPaymentTransaction();

        if (!paymentTransaction) {
            jobsLogger.error(StringUtils.format('Skipping order {0} that does not have a payment transaction.', order.orderNo));
            continue;
        }

        var paymentProcessor = paymentTransaction.getPaymentProcessor();

        if (paymentProcessor) {
            jobsLogger.debug(StringUtils.format('Processing order {0}', order.orderNo));

            var paymentAPIResponse = null;
            var validatePaymentFN = null;
            var transactionID = null;

            if (paymentProcessor.ID === WorldlineDirectConstants.PAYMENT_PROCESSOR_CREDIT) {
                transactionID = paymentTransaction.getTransactionID();
                paymentAPIResponse = worldlineApiFacade.getPayment(transactionID);
                validatePaymentFN = require('*/cartridge/scripts/hooks/payment/processor/worldline_direct_credit').validatePayment;
            } else if (paymentProcessor.ID === WorldlineDirectConstants.PAYMENT_PROCESSOR_REDIRECT) {
                transactionID = order.custom.worldlineDirectTransactionID;
                paymentAPIResponse = worldlineApiFacade.getHostedCheckout(transactionID);
                validatePaymentFN = require('*/cartridge/scripts/hooks/payment/processor/worldline_direct_redirect').validatePayment;
            } else if (paymentProcessor.ID === WorldlineDirectConstants.PAYMENT_PROCESSOR_CREDIT_REDIRECT) {
                transactionID = paymentTransaction.getTransactionID();
                paymentAPIResponse = worldlineApiFacade.getPayment(transactionID);
                validatePaymentFN = require('*/cartridge/scripts/hooks/payment/processor/worldline_direct_credit_redirect').validatePayment;
            }

            if (paymentAPIResponse.success === true) {
                if (WorldlineDirectConstants.ABANDONED_PAYMENT_STATUSES.indexOf(order.custom.worldlineDirectStatus) == -1) {
                    // Handles payment authorization
                    var handlePaymentResult = hooksHelper('app.payment.processor.' + paymentProcessor.ID.toLowerCase(), 'validatePayment', order, paymentInstrument, paymentAPIResponse, validatePaymentFN);

                    if (handlePaymentResult.error) {
                        jobsLogger.error(StringUtils.format('Skipping order {0} because of an error: {1}', order.orderNo, JSON.stringify(handlePaymentResult)));
                    } else {
                        var orderPlacementResult = worldlineDirectCommonHelper.handleOrderPlacement(order, handlePaymentResult, null, null);

                        if (orderPlacementResult.error) {
                            jobsLogger.error(StringUtils.format('Skipping order {0} because of an error: {1}', order.orderNo, orderPlacementResult.errorMsg));
                        } else {
                            jobsLogger.debug(StringUtils.format('Successfully processed order {0}.', order.orderNo));
                        }
                    }
                }
            } else {
                jobsLogger.error(StringUtils.format('Skipping order {0} because of an API error: {1} / {2}', order.orderNo, transactionID, paymentAPIResponse.errorMessage));
            }
        } else {
            jobsLogger.error(StringUtils.format('Skipping order {0} that does not have a payment processor', order.orderNo));
        }
    }

    systemOrdersIterator.close();
}

/**
 * Processes the orders that have a payment status category: PENDING
 * @param {Object} parameters the argument passed to the execute() function by SFCC
 * @param {Object} stepExecution the argument passed to the execute() function by SFCC
 */
function processUnconfirmedOrders(parameters, stepExecution) {
    var systemOrdersIterator = SystemObjectMgr.querySystemObjects('Order',
        'custom.worldlineDirectStatusCategory = {0} AND status != {1} AND status != {2}', null, WorldlineDirectConstants.UNKNOWN_PAYMENT_STATUS_CATEGORY, Order.ORDER_STATUS_CREATED, Order.ORDER_STATUS_FAILED
    );
    jobsLogger.debug(StringUtils.format('Found {0} orders with worldlineDirectStatusCategory = "{1}"', systemOrdersIterator.count, WorldlineDirectConstants.UNKNOWN_PAYMENT_STATUS_CATEGORY));

    var cancelUncofirmedOrderAfterHours = parseInt(stepExecution.getParameterValue('cancelUncofirmedOrderAfterHours'), 10);
    var dateXHoursAgo = new Date((new Date()).getTime() - (cancelUncofirmedOrderAfterHours * 60 * 60 * 1000));

    while (systemOrdersIterator.hasNext()) {
        var order = systemOrdersIterator.next();
        worldlineDirectCommonHelper.processUnconfirmedOrder(order);

        if (order.custom.worldlineDirectStatusCategory.value === WorldlineDirectConstants.UNKNOWN_PAYMENT_STATUS_CATEGORY && order.getCreationDate().getTime() < dateXHoursAgo.getTime()) {
            var paymentInstrument = worldlineDirectCommonHelper.getWorldlinePaymentInstrument(order);

            if (!paymentInstrument) {
                jobsLogger.error(StringUtils.format('Skipping order {0} that does not have a payment instrument.', order.orderNo));
                continue;
            }

            var paymentTransaction = paymentInstrument.getPaymentTransaction();

            if (!paymentTransaction) {
                jobsLogger.error(StringUtils.format('Skipping order {0} that does not have a payment transaction.', order.orderNo));
                continue;
            }

            var result = worldlineApiFacade.cancelPayment(paymentTransaction.getTransactionID());
            if (result.success) {
                OrderMgr.cancelOrder(order);
            }
        }
    }

    systemOrdersIterator.close();
}

/**
 * A job that runs through orders in status CREATED or have a pending payment and updates their status using Worldline's API
 * @param {Object} parameters passed by SFCC
 * @param {Object} stepExecution passed by SFCC
 */
function execute(parameters, stepExecution) {
    worldlineApiFacade = require('*/cartridge/scripts/worldline/direct/api/facade');
    hooksHelper = require('*/cartridge/scripts/helpers/hooks');

    processCreatedOrders(parameters, stepExecution);
    processUnconfirmedOrders(parameters, stepExecution);
}

exports.execute = execute;
