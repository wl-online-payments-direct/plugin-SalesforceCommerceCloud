const StringUtils = require('dw/util/StringUtils');
const OrderMgr = require('dw/order/OrderMgr');
const CustomObjectMgr = require('dw/object/CustomObjectMgr');
const Transaction = require('dw/system/Transaction');

const WorldlineDirectConstants = require('*/cartridge/scripts/worldline/direct/constants');
const worldlineDirectCommonHelper = require('*/cartridge/scripts/worldline/direct/commonHelper');
const logFilterHelper = require('*/cartridge/scripts/worldline/direct/logFilterHelper');

const Logger = require('dw/system/Logger');
const jobsLogger = Logger.getLogger('worldline-job-webhooks', 'worldline-jobs');

/**
 * Processes the webhook.
 * @param {Object} webhookBody The webhook's body
 */
function processWebhook(webhookBody) {
    let webhookJSON = JSON.parse(webhookBody);

    if (!webhookJSON) {
        jobsLogger.error(StringUtils.format('Ignoring a webhook due to invalid JSON. Body: {0}', webhookJSON));
        return;
    }

    let webhookType = webhookJSON.type;
    let orderNo = null;
    let orderToken = null;
    let status = null;
    let statusOutput = null;
    let merchantParameters = null;

    if (webhookJSON.payment) {
        orderNo = webhookJSON.payment.paymentOutput.references.merchantReference;
        merchantParameters = webhookJSON.payment.paymentOutput.references.merchantParameters;
        status = webhookJSON.payment.status;
        statusOutput = webhookJSON.payment.statusOutput;
    } else if (webhookJSON.refund) {
        orderNo = webhookJSON.refund.refundOutput.references.merchantReference;
        merchantParameters = webhookJSON.refund.refundOutput.references.merchantParameters;
        status = webhookJSON.refund.status;
        statusOutput = webhookJSON.refund.statusOutput;
    }

    try {
        var mp = JSON.parse(merchantParameters);
        orderToken = mp.ot;
    } catch (e) {
        jobsLogger.error(StringUtils.format('Ignoring a webhook whose merchant parameters cannot be parsed: {1}||{2}, hookType: {3}', webhookJSON.id, orderNo, orderToken, webhookType));
        return;
    }

    var order = OrderMgr.getOrder(orderNo, orderToken);
    if (!order) {
        jobsLogger.error(StringUtils.format('Ignoring a webhook with id {0} for an order that cannot be retrieved: {1}||{2}, hookType: {3}', webhookJSON.id, orderNo, orderToken, webhookType));
        return;
    }

    let filteredWebhookBody = logFilterHelper.filterJSONString(webhookBody);
    jobsLogger.debug(StringUtils.format('Processing a webhook with id {0} and body:\n{1}\norder.custom.worldlineDirectStatusCategory = {2}', webhookJSON.id, filteredWebhookBody, order.custom.worldlineDirectStatusCategory));

    if (order.custom.worldlineDirectStatusCategory.value === WorldlineDirectConstants.REJECTED_PAYMENT_STATUS_CATEGORY) {
        // ignore the webhook
    } else if (order.custom.worldlineDirectStatusCategory.value === WorldlineDirectConstants.COMPLETED_PAYMENT_STATUS_CATEGORY) {
        if (webhookType === 'payment.refunded') {
            Transaction.wrap(function () {
                order.custom.worldlineDirectHasRefunds = true;
            });
        } else if (webhookType === 'payment.chargebacked') {
            Transaction.wrap(function () {
                order.custom.worldlineDirectHasChargebacks = true;
            });
        }
    } else if (order.custom.worldlineDirectStatusCategory.value === WorldlineDirectConstants.AUTHORIZED_PAYMENT_STATUS_CATEGORY) {
        if (webhookType === 'payment.cancelled') {
            Transaction.wrap(function () {
                order.custom.worldlineDirectStatusCategory = WorldlineDirectConstants.CANCELLED_PAYMENT_STATUS_CATEGORY;
            });
        } else if (webhookType === 'payment.captured') {
            var worldlinePaymentInstrument = worldlineDirectCommonHelper.getWorldlinePaymentInstrument(order);
            worldlineDirectCommonHelper.handlePaymentCapture(order, worldlinePaymentInstrument, status, statusOutput);
        } else if (webhookType === 'payment.refunded') {
            Transaction.wrap(function () {
                order.custom.worldlineDirectHasRefunds = true;
            });
        } else if (webhookType === 'payment.chargebacked') {
            Transaction.wrap(function () {
                order.custom.worldlineDirectHasChargebacks = true;
            });
        }
    } else if (order.custom.worldlineDirectStatusCategory.value === WorldlineDirectConstants.UNKNOWN_PAYMENT_STATUS_CATEGORY) {
        jobsLogger.warn(StringUtils.format('Ignoring a webhook with id {0} for an order with status {1}', webhookJSON.id, order.custom.worldlineDirectStatusCategory));

        worldlineDirectCommonHelper.processUnconfirmedOrder(order);
    }
}

/**
 * A cronjob that takes the webhooks stored in the WorldlineDirectWebhooks custom object and processes them.
 * @param {Object} parameters passed by SFCC
 * @param {Object} stepExecution passed by SFCC
 */
function execute(parameters, stepExecution) {
    let customObjectsIterator = CustomObjectMgr.queryCustomObjects('WorldlineDirectWebhooks', null, 'creationDate ASC', null);

    while (customObjectsIterator.hasNext()) {
        let customObject = customObjectsIterator.next();

        processWebhook(customObject.custom.body);

        Transaction.wrap(function () {
            CustomObjectMgr.remove(customObject);
        });
    }

    customObjectsIterator.close();
}

exports.execute = execute;
