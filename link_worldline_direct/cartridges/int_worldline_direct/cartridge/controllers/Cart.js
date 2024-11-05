'use strict';

/**
 * @namespace Cart
 */

var cart = module.superModule; // require functionality from last controller in the chain with this name
var server = require('server');

var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');
var worldlineDirectSubscriptionHelper = require('*/cartridge/scripts/worldline/direct/subscriptionHelper');
var BasketMgr = require('dw/order/BasketMgr');
const Calendar = require('dw/util/Calendar');
const StringUtils = require('dw/util/StringUtils');
const Transaction = require('dw/system/Transaction');

server.extend(cart);

server.prepend('Show', function (req, res, next) {
    // Check if the user clicked the Back browser button while being on an external payment site.
    // In this case we'll recreate their basket
    if (req.session.privacyCache.get("redirectOrderNo") && req.session.privacyCache.get("redirectOrderNo")) {
        var URLUtils = require('dw/web/URLUtils');

        res.redirect(URLUtils.url('WorldlineDirect-BackBtnReturn'));
        return next();
    }

    return next();
});

server.append('Show', server.middleware.https, consentTracking.consent, csrfProtection.generateToken, function (req, res, next) {
    var Resource = require('dw/web/Resource');

    var viewData = res.getViewData();

    var currentBasket = BasketMgr.getCurrentBasket();

    if (currentBasket) {
        var subscriptionData = worldlineDirectSubscriptionHelper.getSubscriptionData(currentBasket);
        var date = new Date();
        if (empty(subscriptionData.startDate)) {
	        var startDate = new Calendar(date);
	        startDate.add(Calendar.DATE, 1);
        } else {
        	var startDate = new Calendar(subscriptionData.startDate);
        }
        
        
        
        if (!empty(subscriptionData.endDate)) {
        	var endDate = new Calendar(subscriptionData.endDate);
        }
        
    	var minEndDate = new Calendar(startDate.time);
    	minEndDate.add(Calendar.DATE, 1);
        
        viewData.subscriptionData = subscriptionData;
	    viewData.dates = {
    		"startDate": StringUtils.formatCalendar(startDate, "YYYY-MM-dd"),
    		"endDate": empty(subscriptionData.endDate) ? null : StringUtils.formatCalendar(endDate, "YYYY-MM-dd"),
    		"minEndDate": StringUtils.formatCalendar(minEndDate, "YYYY-MM-dd")
	    }
    }

    return next();
});

server.post('SetSubscriptionData', function (req, res, next) {
	const subscriptionStatus = 'active';
	const subscriptionOrderType = 'CIT'
	var currentBasket = BasketMgr.getCurrentBasket();
	if (req.httpParameterMap.wlSubscriptionReplenishOrder.value == 1) {
		var currentBasket = BasketMgr.getCurrentBasket();
		var basketDef = currentBasket.describe();
		var subscriptionPeriodValues = basketDef.getCustomAttributeDefinition('worldlineDirectSubscriptionPeriod').values;
		var subscriptionFrequencyValues = basketDef.getCustomAttributeDefinition('worldlineDirectSubscriptionFrequency').values;
		var subscriptionStatusValues = basketDef.getCustomAttributeDefinition('worldlineDirectSubscriptionStatus').values;
		var subscriptionOrderTypeValues = basketDef.getCustomAttributeDefinition('worldlineDirectSubscriptionOrderType').values;
		
		Transaction.wrap(function() {
			currentBasket.custom.worldlineDirectSubscriptionPeriod = worldlineDirectSubscriptionHelper.getEnumValue(req.httpParameterMap.wlSbscriptionPeriod.intValue, subscriptionPeriodValues);
			currentBasket.custom.worldlineDirectSubscriptionFrequency = worldlineDirectSubscriptionHelper.getEnumValue(req.httpParameterMap.wlSubscriptionFrequency.value, subscriptionFrequencyValues);
			currentBasket.custom.worldlineDirectSubscriptionStartDate = req.httpParameterMap.wlSubscriptionStartDate.value ? new Date(req.httpParameterMap.wlSubscriptionStartDate.value) : null;
			currentBasket.custom.worldlineDirectSubscriptionEndDate = req.httpParameterMap.wlSubscriptionEndDate.value ? new Date(req.httpParameterMap.wlSubscriptionEndDate.value) : null;
			currentBasket.custom.worldlineDirectSubscriptionNextDate = req.httpParameterMap.wlSubscriptionStartDate.value ? new Date(req.httpParameterMap.wlSubscriptionStartDate.value) : null;
			currentBasket.custom.worldlineDirectSubscriptionStatus = worldlineDirectSubscriptionHelper.getEnumValue(subscriptionStatus, subscriptionStatusValues);
			currentBasket.custom.worldlineDirectSubscriptionOrderType = worldlineDirectSubscriptionHelper.getEnumValue(subscriptionOrderType, subscriptionOrderTypeValues);
		});
	} else {
		Transaction.wrap(function() {
			currentBasket.custom.worldlineDirectSubscriptionPeriod = null;
			currentBasket.custom.worldlineDirectSubscriptionFrequency = null;
			currentBasket.custom.worldlineDirectSubscriptionStartDate = null;
			currentBasket.custom.worldlineDirectSubscriptionEndDate = null;
			currentBasket.custom.worldlineDirectSubscriptionNextDate = null;
			currentBasket.custom.worldlineDirectSubscriptionStatus = null;
			currentBasket.custom.worldlineDirectSubscriptionOrderType = null;
		});
	}
	
});

module.exports = server.exports();
