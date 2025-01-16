'use strict';

const Logger = require('dw/system/Logger');
const Site = require('dw/system/Site');
const Transaction = require('dw/system/Transaction');

/**
 * Build subscription data for checkout page
 * @param {Object} currentBasket current basket 
 * @returns {object} subscribtion data object
 */
function getSubscriptionData(currentBasket) {
    if (!currentBasket) {
        return null;
    }

    var basketDef = currentBasket.describe();
    var subscriptionPeriodValues = basketDef.getCustomAttributeDefinition('worldlineDirectSubscriptionPeriod').values;
    var subscriptionFrequencyValues = basketDef.getCustomAttributeDefinition('worldlineDirectSubscriptionFrequency').values;

    var subscriptionData = {
		enabled: Site.current.getCustomPreferenceValue('worldlineDirectSubscription'),
        allowed: (customer && customer.authenticated),
        subscriptionPeriod: currentBasket.custom.worldlineDirectSubscriptionPeriod,
        subscriptionFrequency: currentBasket.custom.worldlineDirectSubscriptionFrequency,
        startDate: currentBasket.custom.worldlineDirectSubscriptionStartDate,
        endDate: currentBasket.custom.worldlineDirectSubscriptionEndDate,
        periodValues: subscriptionPeriodValues,
        frequencyValues: subscriptionFrequencyValues,
        selected: isSubscriptionSelected(currentBasket)
    };

    return subscriptionData;

}

function isSubscriptionSelected(lineItemCtnr) {
	if (!lineItemCtnr) {
        return false;
    }
	
	if (typeof(lineItemCtnr.custom) != 'undefined') {
		return !empty(lineItemCtnr.custom.worldlineDirectSubscriptionPeriod) && !empty(lineItemCtnr.custom.worldlineDirectSubscriptionFrequency) && !empty(lineItemCtnr.custom.worldlineDirectSubscriptionStartDate);// && !empty(lineItemCtnr.custom.worldlineDirectSubscriptionEndDate);
	} else {
		return !empty(lineItemCtnr.worldlineDirectSubscriptionData.worldlineDirectSubscriptionPeriod) && !empty(lineItemCtnr.worldlineDirectSubscriptionData.worldlineDirectSubscriptionFrequency) && !empty(lineItemCtnr.worldlineDirectSubscriptionData.worldlineDirectSubscriptionStartDate);// && !empty(lineItemCtnr.worldlineDirectSubscriptionData.worldlineDirectSubscriptionEndDate);
	}
}

function getEnumValue(selectedValue, enumObject) {
	var iterator = enumObject.iterator();
	while(iterator.hasNext()) {
		var enumInstance = iterator.next();
		if (enumInstance.value == selectedValue) {
			return enumInstance.value;
		}
	}
	
	return null;
}

/**
 * Calculate next charge date
 * @param {Object} subscriptionPeriod 
 * @param {Object} subscriptionFrequency 
 * @param {String} lastExecutionDate
 * @returns {String} next charge date
 */
function calculateNextChargeDate(subscriptionPeriod, subscriptionFrequency, lastExecutionDate, subscriptionEndDate) {
    var Calendar = require('dw/util/Calendar');
    var Logger = require('dw/system/Logger');

    var executionDate = new Date(lastExecutionDate);
    var nextDate = new Calendar(executionDate);
    
    try {
        var calendarField = null;
        switch (subscriptionFrequency) {
            case 'day': calendarField = Calendar.DAY_OF_YEAR;
                break;
            case 'week': calendarField = Calendar.WEEK_OF_YEAR;
                break;
            case 'month': calendarField = Calendar.MONTH;
                break;
            case 'year': calendarField = Calendar.YEAR;
                break;
            default: Logger.error('Unknown subscription frequesncy value: ' + subscriptionFrequency);
        }

        if (calendarField) {
            nextDate.add(calendarField, subscriptionPeriod);
        }
    } catch (err) {
        Logger.error('Error calculating next charging date: ' + err);
    }
    
    //if the subscription has an end date set and it is after the calculated next date we return null
    if (subscriptionEndDate) {
    	let endDate = new Calendar(subscriptionEndDate);
	    if (nextDate.compareTo(endDate) > 0) {
	    	return null;
	    }
    }

    return nextDate.time;
}

exports.getEnumValue = getEnumValue;
exports.getSubscriptionData = getSubscriptionData;
exports.calculateNextChargeDate = calculateNextChargeDate;
exports.isSubscriptionSelected = isSubscriptionSelected;