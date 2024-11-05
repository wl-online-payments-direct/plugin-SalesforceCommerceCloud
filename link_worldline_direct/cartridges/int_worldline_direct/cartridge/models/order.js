'use strict';

/**
 * Order class that represents the current order
 * @param {dw.order.LineItemCtnr} lineItemContainer - Current users's basket/order
 * @param {Object} options - The current order's line items
 * @param {Object} options.config - Object to help configure the orderModel
 * @param {string} options.config.numberOfLineItems - helps determine the number of lineitems needed
 * @param {string} options.countryCode - the current request country code
 * @constructor
 */
function OrderModel(lineItemContainer, options) {
	module.superModule.call(this, lineItemContainer, options);
	var paymentInstruments = lineItemContainer.getPaymentInstruments();

	this.worldlineDirectSubscriptionData = {
			worldlineDirectSubscriptionPeriod : lineItemContainer.custom.worldlineDirectSubscriptionPeriod,
			worldlineDirectSubscriptionFrequency : lineItemContainer.custom.worldlineDirectSubscriptionFrequency,
			worldlineDirectSubscriptionStartDate : lineItemContainer.custom.worldlineDirectSubscriptionStartDate,
			worldlineDirectSubscriptionEndDate : lineItemContainer.custom.worldlineDirectSubscriptionEndDate,
			worldlineDirectSubscriptionStatus : lineItemContainer.custom.worldlineDirectSubscriptionStatus,
			worldlineDirectPaymentProductName: (paymentInstruments.length) ? paymentInstruments.iterator().next().custom.worldlineDirectPaymentProductName : null
	}
}

module.exports = OrderModel;