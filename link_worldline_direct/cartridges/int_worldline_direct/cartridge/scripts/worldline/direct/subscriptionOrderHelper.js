'use strict';

var OrderMgr = require('dw/order/OrderMgr');
var Order = require('dw/order/Order');
var Locale = require('dw/util/Locale');
var Resource = require('dw/web/Resource');
var URLUtils = require('dw/web/URLUtils');
const WorldlineDirectConstants = require('*/cartridge/scripts/worldline/direct/constants');
var OrderModel = require('*/cartridge/models/order');
/**
 * Creates an order model for the current customer
 * @returns {Object} an object of the customer's last order
 */
function getLastSubscriptionOrder() {
    var orderModel = null;
    
    var customerOrders = OrderMgr.searchOrders("custom.worldlineDirectSubscriptionStartDate != {0} AND customerNo = {1} AND custom.worldlineDirectSubscriptionOrderType = {2}", "creationDate desc", null, customer.profile.customerNo, WorldlineDirectConstants.RECURRING_ORDERS_CREATED_BY_CUSTOMER)

    if (customerOrders.count) {
    	var config = {
            numberOfLineItems: 'single'
        };
    	
    	var order = customerOrders.first();
    	return new OrderModel(order, { config: config}); 
    }
    
    return null;
}

function getCustomersSubscriptionOrders (querystring, locale, originalOrderNo) {
	
	if (originalOrderNo) {
		var customerOrders = OrderMgr.searchOrders("customerNo = {0} AND custom.worldlineDirectSubscriptionOriginalOrderID = {1}", "creationDate desc", customer.profile.customerNo, originalOrderNo)
	} else {
		var customerOrders = OrderMgr.searchOrders("custom.worldlineDirectSubscriptionStartDate != {0} AND customerNo = {1}", "creationDate desc", null, customer.profile.customerNo)
	}
	var orders = [];

    var filterValues = [
        {
            displayValue: Resource.msg('orderhistory.sixmonths.option', 'order', null),
            optionValue: URLUtils.url('Order-Filtered', 'orderFilter', '6', 'subscriptions', 1).abs().toString()
        },
        {
            displayValue: Resource.msg('orderhistory.twelvemonths.option', 'order', null),
            optionValue: URLUtils.url('Order-Filtered', 'orderFilter', '12', 'subscriptions', 1).abs().toString()
        }
    ];
    var orderYear;
    var years = [];
    var customerOrder;
    var SIX_MONTHS_AGO = Date.now() - 15778476000;
    var YEAR_AGO = Date.now() - 31556952000;
    var orderModel;

    var currentLocale = Locale.getLocale(locale);
    
    while (customerOrders.hasNext()) {
        customerOrder = customerOrders.next();
        var config = {
            numberOfLineItems: 'single'
        };

        orderYear = customerOrder.getCreationDate().getFullYear().toString();
        var orderTime = customerOrder.getCreationDate().getTime();

        if (years.indexOf(orderYear) === -1) {
            var optionURL =
                URLUtils.url('Order-Filtered', 'orderFilter', orderYear, 'subscriptions', 1).abs().toString();
            filterValues.push({
                displayValue: orderYear,
                optionValue: optionURL
            });
            years.push(orderYear);
        }

        if (querystring.orderFilter
            && querystring.orderFilter !== '12'
            && querystring.orderFilter !== '6') {
            if (orderYear === querystring.orderFilter) {
                orderModel = new OrderModel(
                    customerOrder,
                    { config: config, countryCode: currentLocale.country }
                );
                orders.push(orderModel);
            }
        } else if (querystring.orderFilter
            && YEAR_AGO < orderTime
            && querystring.orderFilter === '12') {
            orderModel = new OrderModel(
                customerOrder,
                { config: config, countryCode: currentLocale.country }
            );
            orders.push(orderModel);
        } else if (SIX_MONTHS_AGO < orderTime) {
            orderModel = new OrderModel(
                customerOrder,
                { config: config, countryCode: currentLocale.country }
            );
            orders.push(orderModel);
        }
    }

    return {
        orders: orders,
        filterValues: filterValues
    };
}

function getCustomerOrder(customer, orderNo) {
	return OrderMgr.searchOrder("customerNo = {0} AND orderNo = {1}", customer.profile.customerNo, orderNo);
}

module.exports = {
	getLastSubscriptionOrder: getLastSubscriptionOrder,
	getCustomersSubscriptionOrders: getCustomersSubscriptionOrders,
	getCustomerOrder: getCustomerOrder
};

