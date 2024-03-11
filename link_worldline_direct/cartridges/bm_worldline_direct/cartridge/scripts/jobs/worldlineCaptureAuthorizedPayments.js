const SystemObjectMgr = require('dw/object/SystemObjectMgr');
const StringUtils = require('dw/util/StringUtils');
const worldlineDirectCommonHelper = require('*/cartridge/scripts/worldline/direct/commonHelper');
const WorldlineDirectConstants = require('*/cartridge/scripts/worldline/direct/constants');

const Logger = require('dw/system/Logger');
const jobsLogger = Logger.getLogger('worldline-job-capture', 'worldline-jobs');

var worldlineApiFacade;
var cntProcessedOrders = 0;
var cntCapturedOrders = 0;

/**
 * Performs a capture on the order using Worldline's API
 * @param {dw.order.Order} order The order whose payment is to be captured
 */
function processOrder(order) {
    var worldlinePaymentInstrument = worldlineDirectCommonHelper.getWorldlinePaymentInstrument(order);
    if (empty(worldlinePaymentInstrument)) {
        jobsLogger.error(StringUtils.format("Order {0} doesn't have an Worldline payment instrument.", order.orderNo));
        return;
    }

    cntProcessedOrders++;
    jobsLogger.debug(StringUtils.format('Processing order {0}', order.orderNo));

    let transactionId = worldlinePaymentInstrument.getPaymentTransaction().getTransactionID();

    // calculate the remaining capturable amount
    let originalTransactionAmount = worldlineDirectCommonHelper.convertMoneyToWorldlineAmount(worldlinePaymentInstrument.getPaymentTransaction().getAmount());
    let paymentCaptures = worldlineApiFacade.getPaymentCaptures(transactionId);
    if (paymentCaptures.success === true) {
        let capturedAmount = worldlineDirectCommonHelper.getCapturedAmount(order, paymentCaptures.captures, originalTransactionAmount);
        let capturableAmount = originalTransactionAmount - capturedAmount;

        if (capturableAmount > 0) {
            let result = worldlineApiFacade.capturePayment(transactionId, capturableAmount, true);
            if (result.success !== true) {
                jobsLogger.error(StringUtils.format('Got an error while capturing payment on order {0} with amount: {1}: {2}', order.orderNo, capturableAmount, result.errorMessage));
                return;
            }

            worldlineDirectCommonHelper.handlePaymentCapture(order, worldlinePaymentInstrument, result.status, result.statusOutput);
            cntCapturedOrders++;
        } else {
            jobsLogger.warn(StringUtils.format('Skipping order {0} because of an invalid capturable amount: {1}', order.orderNo, capturableAmount));
        }
    } else {
        jobsLogger.warn(StringUtils.format('Skipping order {0} because of an API error.', order.orderNo));
    }
}

/**
 * A job that captures the payments that haven't been captured yet.
 * @param {Object} parameters the argument passed to the execute() function by SFCC
 * @param {Object} stepExecution the argument passed to the execute() function by SFCC
 */
function execute(parameters, stepExecution) {
    let worldlineDirectCaptureProcedureDelay = parseInt(stepExecution.getParameterValue('worldlineDirectCaptureProcedureDelay'), 10);

    worldlineApiFacade = require('*/cartridge/scripts/worldline/direct/api/facade');
    var systemOrdersIterator;

    if (worldlineDirectCaptureProcedureDelay === 0) {
        // in this case the job will run at a specific hour and will capture all orders that are awaiting capture
        systemOrdersIterator = SystemObjectMgr.querySystemObjects('Order', 'custom.worldlineDirectIsAuthorized = {0} AND custom.worldlineDirectStatusCategory != {1} AND custom.worldlineDirectStatusCategory != {2}', null, true, WorldlineDirectConstants.COMPLETED_PAYMENT_STATUS_CATEGORY, WorldlineDirectConstants.CANCELLED_PAYMENT_STATUS_CATEGORY);

        jobsLogger.debug(StringUtils.format('Found {0} Worldline orders that match the criteria custom.worldlineDirectIsAuthorized = true AND custom.worldlineDirectStatusCategory != COMPLETED AND custom.worldlineDirectStatusCategory != CANCELLED', systemOrdersIterator.count));
    } else {
        var dateXDaysAgo = new Date((new Date()).getTime() - (worldlineDirectCaptureProcedureDelay * 24 * 60 * 60 * 1000));
        systemOrdersIterator = SystemObjectMgr.querySystemObjects('Order', 'custom.worldlineDirectIsAuthorized = {0} AND creationDate < {1} AND custom.worldlineDirectStatusCategory != {2} AND custom.worldlineDirectStatusCategory != {2}', null, true, dateXDaysAgo, WorldlineDirectConstants.COMPLETED_PAYMENT_STATUS_CATEGORY, WorldlineDirectConstants.CANCELLED_PAYMENT_STATUS_CATEGORY);

        jobsLogger.debug(StringUtils.format('Found {0} Worldline orders that match the criteria custom.worldlineDirectIsAuthorized = true AND creationDate < "{1}" AND custom.worldlineDirectStatusCategory != COMPLETED AND custom.worldlineDirectStatusCategory != CANCELLED. worldlineDirectCaptureProcedureDelay: {2}',
            systemOrdersIterator.count, dateXDaysAgo.toUTCString(), worldlineDirectCaptureProcedureDelay)
        );
    }

    while (systemOrdersIterator.hasNext()) {
        var order = systemOrdersIterator.next();
        processOrder(order);
    }
    systemOrdersIterator.close();

    jobsLogger.info(StringUtils.format('Job finished, processed {0} orders, captured {1}.', cntProcessedOrders, cntCapturedOrders));
}

exports.execute = execute;
