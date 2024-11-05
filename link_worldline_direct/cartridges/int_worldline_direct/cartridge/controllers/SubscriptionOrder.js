var orderController = module.superModule;
var server = require('server');

var Resource = require('dw/web/Resource');
var URLUtils = require('dw/web/URLUtils');
var Logger = require('dw/system/Logger');

var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var userLoggedIn = require('*/cartridge/scripts/middleware/userLoggedIn');
var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');
var WorldlineDirectConstants = require('*/cartridge/scripts/worldline/direct/constants');
var worldlineDirectCommonHelper = require('*/cartridge/scripts/worldline/direct/commonHelper');
var worldlineApiFacade = require('*/cartridge/scripts/worldline/direct/api/facade');

var logger = Logger.getRootLogger();

/**
 * SubscriptionOrder-History : This endpoint is invoked to get Order History for the logged in shopper
 * @name Base/Order-History
 * @function
 * @memberof Order
 * @param {middleware} - consentTracking.consent
 * @param {middleware} - server.middleware.https
 * @param {middleware} - userLoggedIn.validateLoggedIn
 * @param {category} - sensitive
 * @param {serverfunction} - get
 */
server.get(
    'History',
    consentTracking.consent,
    server.middleware.https,
    userLoggedIn.validateLoggedIn,
    function (req, res, next) {
    	
		var subscriptionOrderHelper = require('*/cartridge/scripts/worldline/direct/subscriptionOrderHelper');
		
		var ordersResult = subscriptionOrderHelper.getCustomersSubscriptionOrders(
            req.querystring,
            req.locale.id
        );
    		
    	var orders = ordersResult.orders;
    	
        var breadcrumbs = [
            {
                htmlValue: Resource.msg('global.home', 'common', null),
                url: URLUtils.home().toString()
            },
            {
                htmlValue: Resource.msg('page.title.myaccount', 'account', null),
                url: URLUtils.url('Account-Show').toString()
            }
        ];

        res.render('account/order/subscriptionhistory', {
            orders: orders,
            accountlanding: false,
            breadcrumbs: breadcrumbs
        });
        next();
    }
);

/**
 * SubscriptionOrder-Details : This endpoint is called to get Order Details
 * @name Base/Order-Details
 * @function
 * @memberof Order
 * @param {middleware} - consentTracking.consent
 * @param {middleware} - server.middleware.https
 * @param {middleware} - userLoggedIn.validateLoggedIn
 * @param {querystringparameter} - orderID - Order ID
 * @param {category} - sensitive
 * @param {serverfunction} - get
 */
server.get(
    'Details',
    consentTracking.consent,
    server.middleware.https,
    userLoggedIn.validateLoggedIn,
    function (req, res, next) {
        var OrderMgr = require('dw/order/OrderMgr');
        var orderHelpers = require('*/cartridge/scripts/order/orderHelpers');

        var order = OrderMgr.getOrder(req.querystring.orderID);
        var orderCustomerNo = req.currentCustomer.profile.customerNo;
        var currentCustomerNo = order.customer.profile.customerNo;
        var httpParameterMap = request.getHttpParameterMap();
        
        var breadcrumbs = [
            {
                htmlValue: Resource.msg('global.home', 'common', null),
                url: URLUtils.home().toString()
            },
            {
                htmlValue: Resource.msg('page.title.myaccount', 'account', null),
                url: URLUtils.url('Account-Show').toString()
            },
            {
                htmlValue: ((order.custom.worldlineDirectSubscriptionStartDate) ? Resource.msg('label.subscriptions', 'worldlineDirect', null) : Resource.msg('label.orderhistory', 'account', null)),
                url: ((order.custom.worldlineDirectSubscriptionStartDate) ? URLUtils.url('SubscriptionOrder-History').toString() : URLUtils.url('Order-History').toString())
            }
        ];

        if (order && orderCustomerNo === currentCustomerNo) {
            var orderModel = orderHelpers.getOrderDetails(req);
        	var exitLinkText = Resource.msg('label.backsubscriptions', 'worldlineDirect', null);
        	var exitLinkUrl = URLUtils.https('SubscriptionOrder-History');
            var mandateObj = null;

            var wordlineDirectPaymentInstrument = worldlineDirectCommonHelper.getWorldlinePaymentInstrument(order);

            if (wordlineDirectPaymentInstrument && wordlineDirectPaymentInstrument.custom.worldlineDirectPaymentMethod === WorldlineDirectConstants.PAYMENT_PRODUCT_DIRECT_DEBIT)
            {
                var mandateInfo = worldlineApiFacade.getMandate(wordlineDirectPaymentInstrument.custom.worldlineDirectMandateReference);

                if (mandateInfo.success) {
                    mandateObj = {
                        name: [mandateInfo.mandate.customer.personalInformation.title, mandateInfo.mandate.customer.personalInformation.name.firstName, mandateInfo.mandate.customer.personalInformation.name.surname].join(' '),
                        companyName: mandateInfo.mandate.customer.companyName,
                        iban: mandateInfo.mandate.customer.bankAccountIban.iban,
                        address: mandateInfo.mandate.customer.mandateAddress.street + '<br/>' + mandateInfo.mandate.customer.mandateAddress.city + ', ' + mandateInfo.mandate.customer.mandateAddress.countryCode + ' ' + mandateInfo.mandate.customer.mandateAddress.zip,
                        status: mandateInfo.mandate.status,
                    };
                }
            }

            res.render('account/orderDetails', {
                order: orderModel,
                mandate: mandateObj,
                exitLinkText: exitLinkText,
                exitLinkUrl: exitLinkUrl,
                breadcrumbs: breadcrumbs
            });
        } else {
            res.redirect(URLUtils.url('Account-Show'));
        }
        next();
    }
);

server.get('GetSubscriptionList',
	server.middleware.https,
    consentTracking.consent,
    userLoggedIn.validateLoggedInAjax,
    function (req, res, next) {
		
		var subscriptionOrderHelper = require('*/cartridge/scripts/worldline/direct/subscriptionOrderHelper');
		var httpParameterMap = request.getHttpParameterMap();
		
		var order = subscriptionOrderHelper.getCustomerOrder(req.currentCustomer, httpParameterMap.orderNo.stringValue);
		
		var ordersResult = subscriptionOrderHelper.getCustomersSubscriptionOrders(
	        req.querystring,
	        req.locale.id,
	        httpParameterMap.orderNo.stringValue
	    );
		
		var orders = ordersResult.orders;
		
		res.render('account/order/worldline/direct/subscriptionOrderList', {
	        orders: orders,
	        order: order,
	        accountlanding: false
	    });
		return next();
	}
);

server.post('CancelSubscription',
	server.middleware.https,
    consentTracking.consent,
    userLoggedIn.validateLoggedInAjax,
    function (req, res, next) {
		const Transaction = require('dw/system/Transaction');

		var subscriptionOrderHelper = require('*/cartridge/scripts/worldline/direct/subscriptionOrderHelper');
		var httpParameterMap = request.getHttpParameterMap();

		try {
			var order = subscriptionOrderHelper.getCustomerOrder(req.currentCustomer, httpParameterMap.orderNo.stringValue);
            var wordlineDirectPaymentInstrument = worldlineDirectCommonHelper.getWorldlinePaymentInstrument(order);

            if (!wordlineDirectPaymentInstrument) {
                throw new Error('WORLDLINE_PAYMENT_INSTRUMENT_NOT_FOUND');
            }

            if (wordlineDirectPaymentInstrument.custom.worldlineDirectPaymentMethod === WorldlineDirectConstants.PAYMENT_PRODUCT_GROUP_CARD) {
                worldlineApiFacade.deleteToken(wordlineDirectPaymentInstrument.getCreditCardToken());
            }
            else if (wordlineDirectPaymentInstrument.custom.worldlineDirectPaymentMethod === WorldlineDirectConstants.PAYMENT_PRODUCT_DIRECT_DEBIT) {
                worldlineApiFacade.revokeMandate(wordlineDirectPaymentInstrument.custom.worldlineDirectMandateReference);
            }
			
			Transaction.wrap(function() {
				order.custom.worldlineDirectSubscriptionStatus = WorldlineDirectConstants.RECURRING_ORDERS_SUBSCRIPTION_STATUS_CANCELLED;
				order.custom.worldlineDirectSubscriptionEndDate = new Date();
                order.custom.worldlineDirectSubscriptionNextDate = null;
			});

			res.json({"success": true});
		} catch (e) {
            logger.error("[SubscriptionOrder-CancelSubscription] error during execution. [" + e + "]");
			res.json({"success": false});
		}
		return next();
	}
);

module.exports = server.exports();
