const OrderMgr = require('dw/order/OrderMgr');
const Order = require('dw/order/Order');
const SystemObjectMgr = require('dw/object/SystemObjectMgr');
const StringUtils = require('dw/util/StringUtils');
const Transaction = require('dw/system/Transaction');

const worldlineDirectCommonHelper = require('*/cartridge/scripts/worldline/direct/commonHelper');
const WorldlineDirectConstants = require('*/cartridge/scripts/worldline/direct/constants');
const worldlineDirectSubscriptionHelper = require('*/cartridge/scripts/worldline/direct/subscriptionHelper');
const OCAPIHelper = require('*/cartridge/scripts/worldline/direct/ocapiHelper');
const WordlineDirectBasketDTO = require('*/cartridge/scripts/ocapi/dto/basket');
const emailHelpers = require('*/cartridge/scripts/helpers/emailHelpers');
const COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');

const Logger = require('dw/system/Logger');
const jobsLogger = Logger.getLogger('worldline-rec-orders', 'worldline-jobs');
var WordlineOCAPIService = require('*/cartridge/scripts/service/worldlineOCAPIService');

var cntProcessedOrders = 0;
var ocapiCredentials = null;
var admiMail;
var adminEmail;
var retry = 0;

function processOrder(order) {

    jobsLogger.info("Processing order #{0}", order.orderNo); 
    jobsLogger.info("Customer #{0}", order.getCustomerNo()); 
    
	var wordlineDirectBasketDTO = new WordlineDirectBasketDTO(order);
	try {
		var wordlineOCAPIService = new WordlineOCAPIService();
    	var serviceCredentials = wordlineOCAPIService.getService().getConfiguration().getCredential();
    	ocapiCredentials.clientSecret = serviceCredentials.password,
    	ocapiCredentials.clientId = serviceCredentials.user
    	
		var oCAPIHelper = new OCAPIHelper(wordlineOCAPIService, ocapiCredentials);
		var basket = oCAPIHelper.createBasket(wordlineDirectBasketDTO.basket);
		
		var subscriptionOrder = oCAPIHelper.createOrder(basket.object.basket_id);
		var paymentInstrumentObject = wordlineDirectBasketDTO.getPaymentObject(subscriptionOrder.object.order_total, wordlineDirectBasketDTO.paymentInstrument);
		var subscriptionOrderUpdated = oCAPIHelper.addPaymentInstrument(subscriptionOrder.object.order_no, subscriptionOrder.object.payment_instruments[0].payment_instrument_id, paymentInstrumentObject);
	
		
		if (subscriptionOrderUpdated.object.status == 'created') {
			var errors = {
				"orderStatus": subscriptionOrderUpdated.object.status,
				"originalOrderNo": order.orderNo,
				"orderNo": subscriptionOrder.object.order_no,
				"error": JSON.stringify(subscriptionOrderUpdated.object),
				"shortError": subscriptionOrderUpdated.object._flash
			};
			
			Transaction.wrap(function() {
	    		if (order.custom.worldlineDirectSubscriptionRetryCount) {
	    			order.custom.worldlineDirectSubscriptionRetryCount = order.custom.worldlineDirectSubscriptionRetryCount + 1;
	    		} else {
	    			order.custom.worldlineDirectSubscriptionRetryCount = 1;
	    		}
	    		
	    		if (order.custom.worldlineDirectSubscriptionRetryCount > retry) { 
	    			order.custom.worldlineDirectSubscriptionStatus = WorldlineDirectConstants.RECURRING_ORDERS_SUBSCRIPTION_STATUS_BLOCKED;
	    			errors["recurringStatus"] = WorldlineDirectConstants.RECURRING_ORDERS_SUBSCRIPTION_STATUS_BLOCKED;
	    		}
	    	});
			
			emailObj = {
					to: adminEmail,
					from: mailFrom,
					subject: dw.web.Resource.msg('worldline.recurringorders.adminsubject', 'worldlineDirect', null)
			};
			
			emailHelpers.sendEmail(emailObj, 'worldline/direct/email/adminemail', errors); 
		} else {
		
			var today = new Date();
			var nextDate = worldlineDirectSubscriptionHelper.calculateNextChargeDate(order.custom.worldlineDirectSubscriptionPeriod.value, order.custom.worldlineDirectSubscriptionFrequency.value, today.toISOString(), order.custom.worldlineDirectSubscriptionEndDate);
	    	
			Transaction.wrap(function() {
				order.custom.worldlineDirectSubscriptionRetryCount = 0;
				
				if (nextDate == null) {
					order.custom.worldlineDirectSubscriptionStatus = null;
		    	} else {
		    		order.custom.worldlineDirectSubscriptionNextDate = nextDate;
		    	}
			});
			//sends an order confirmation email
			var currentSubscriptionOrder = OrderMgr.getOrder(subscriptionOrder.object.order_no);
			COHelpers.sendConfirmationEmail(currentSubscriptionOrder, currentSubscriptionOrder.customerLocaleID);
		}
		
			
	} catch (e) {
		var error = e;
		emailObj = {
				to: adminEmail,
				from: mailFrom,
				subject: dw.web.Resource.msg('worldline.recurringorders.adminsubject', 'worldlineDirect', null)
		};
		var context = {
				"error": error.message,
				"originalOrderNo": order.orderNo
		}
		emailHelpers.sendEmail(emailObj, 'worldline/direct/email/adminemail', context);
		var errorObject = {};
		try {
			//the error has the following structure: 
			// [ERROR: {......}] that can't be parsed by JSON.parse and we need to trim the [ERROR: and the closing ]
			var errorMessage = error.message.substring(8, error.message.length - 1);
			errorObject = JSON.parse(errorMessage);
		} catch (er) {
			errorObject.fault = {type: 'unknown'};
		}
		
		//if it is a product issue, we send an email to the customer as well
		if (errorObject.fault.type == 'ProductItemNotAvailableException') {
			sendCustomerEMail(order, null, errorObject.fault.message);
		} else if (errorObject.fault.type == 'InvalidPaymentMethodIdException') {
			sendCustomerEMail(order, subscriptionOrder.object.order_no, Resource.msg('error.payment.reccuringorderjob', 'worldlineDirect', null));
		}
	}
}

function sendCustomerEMail(order, subscriptionOrderNum, error) {
	emailCustomerObj = {
			to: order.customer.profile.email,
			from: mailFrom,
			subject: dw.web.Resource.msg('worldline.recurringorders.customersubject', 'worldlineDirect', null)
	};
	var customerContext = {
			"error": error,
			"originalOrderNo": order.orderNo,
			"orderNo": subscriptionOrderNum
	}
	emailHelpers.sendEmail(emailCustomerObj, 'worldline/direct/email/customeremail', customerContext);
}


/**
 * A job that captures the payments that haven't been captured yet.
 * @param {Object} parameters the argument passed to the execute() function by SFCC
 * @param {Object} stepExecution the argument passed to the execute() function by SFCC
 */
function execute(parameters, stepExecution) {

    jobsLogger.info(JSON.stringify(parameters));
    jobsLogger.info(parseInt(stepExecution.getParameterValue('worldlineDirectCaptureProcedureDelay'), 10)); 
    
    let today = new Date();
    let status = WorldlineDirectConstants.RECURRING_ORDERS_SUBSCRIPTION_STATUS_ACTIVE;
    let intiatedBy = WorldlineDirectConstants.RECURRING_ORDERS_CREATED_BY_CUSTOMER;
    retry = parameters.worldlineDirectRetry;
    mailFrom = parameters.mailFrom;
    adminEmail = parameters.adminEmail;

    let orders = OrderMgr.queryOrders("custom.worldlineDirectSubscriptionNextDate <= {0} AND custom.worldlineDirectSubscriptionStatus = {1} AND custom.worldlineDirectSubscriptionOrderType = {2} AND status != {3} AND status != {4} AND status != {5}", "orderNo asc", today, status, intiatedBy, Order.ORDER_STATUS_CREATED, Order.ORDER_STATUS_FAILED, Order.ORDER_STATUS_CANCELLED);

    if (orders.count) {
    	ocapiCredentials = {
	    	username: parameters.worldlineDirectOCAPIUsername,
	    	agentKey: parameters.worldlineDirectOCAPIAgentKey,
	    	clientSecret: null,
	    	clientId: null
	    }
    	
    	while (orders.hasNext()) {
    		processOrder(orders.next());
    	}
    }
    
    jobsLogger.info(StringUtils.format('Job finished, processed {0} orders, captured {1}.', cntProcessedOrders));
}

module.exports.execute = execute;