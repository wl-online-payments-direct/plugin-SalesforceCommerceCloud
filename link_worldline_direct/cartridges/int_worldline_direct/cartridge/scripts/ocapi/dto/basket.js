'use strict';
const WorldlineDirectConstants = require('*/cartridge/scripts/worldline/direct/constants');

/**
 * 
 * @param productLineItems : dw.order.ProductLineItem
 * @returns array
 */
WorldlineDirectBasketDTO.prototype.getProducts = function (productLineItems) {
	var productsArray = [];
	if (!productLineItems.empty) {
		var productLineItemsIterator = productLineItems.iterator();
		while(productLineItemsIterator.hasNext()) {
			var productLineItem = productLineItemsIterator.next();
			productsArray.push(
				{
					product_id: productLineItem.productID,
					quantity: productLineItem.quantity.value
				}
			);
		}
	}
	
	return productsArray;
}

/**
 * 
 * @param couponLineItems : dw.order.CouponLineItem
 * @returns array
 */
WorldlineDirectBasketDTO.prototype.getCouponObject = function (couponLineItems) {
	var couponsObject = [];
	if (!couponLineItems.empty) {
		
		var couponLineItemsIterator = couponLineItems.iterator();
		while(couponLineItemsIterator.hasNext()) {
			var couponLineItem = couponLineItemsIterator.next();
			couponsObject.push(
				{
					code: couponLineItem.couponCode
				}
			);
		}
	}
	
	return couponsObject;
}

/**
 * 
 * @param customer : dw.customer.Customer
 * @returns object
 */
WorldlineDirectBasketDTO.prototype.getCustomerObject = function (customer) {
	var customerObject = {};
	if (customer) {
		customerObject = {
			customer_id: customer.ID,
			customer_name: customer.profile.firstName + ' ' + customer.profile.lastName,
			customer_no: customer.profile.customerNo,
			email: customer.profile.email
		};
	}
	
	return customerObject;
}

/**
 * Delivers the billing and shipping address object based on the supplied address
 * 
 * @param orderAddress : dw.order.OrderAddress
 * @returns object
 */
WorldlineDirectBasketDTO.prototype.getAddressObject = function (orderAddress) {
	var addressObject = {};
	if (orderAddress) {
		addressObject = {
			address1: orderAddress.address1,
			address2: orderAddress.address2,
			city: orderAddress.city,
			country_code: orderAddress.countryCode.value,
			first_name: orderAddress.firstName,
			full_name: orderAddress.fullName,
			id: orderAddress.UUID,
			last_name: orderAddress.lastName,
			phone: orderAddress.phone,
			postal_code: orderAddress.postalCode,
			state_code: orderAddress.stateCode
		};
	}
	
	return addressObject;
}

WorldlineDirectBasketDTO.prototype.getShippingMethodObject = function (shipment) {
	var shippingMethod = shipment.shippingMethod;
	return {
		"description": shippingMethod.description,
        "id": shippingMethod.ID,
        "name": shippingMethod.displayName,
        "price": shipment.adjustedMerchandizeTotalPrice.value
	}
}

WorldlineDirectBasketDTO.prototype.getPaymentObject = function (orderTotal, paymentInstrument) {
	
	var paymentObject = {
			"amount": orderTotal,
			"c_worldlineDirectPaymentMethod": paymentInstrument.custom.worldlineDirectPaymentMethod,
			"c_worldlineDirectPaymentProductID": paymentInstrument.custom.worldlineDirectPaymentProductID,
			"c_worldlineDirectPaymentProductName": paymentInstrument.custom.worldlineDirectPaymentProductName
	};
	
	if (paymentInstrument.custom.worldlineDirectPaymentMethod == WorldlineDirectConstants.PAYMENT_PRODUCT_GROUP_CARD) { //cards
		paymentObject.payment_card = {
	        "card_type": paymentInstrument.creditCardType,
	        "number": paymentInstrument.creditCardNumber,
	        "credit_card_token": paymentInstrument.creditCardToken,
	        "expiration_month": paymentInstrument.creditCardExpirationMonth,
	        "expiration_year": paymentInstrument.creditCardExpirationYear,
	        "holder": paymentInstrument.creditCardHolder
	    };
		paymentObject.c_worldlineDirectCreditCardAlias = paymentInstrument.custom.worldlineDirectCreditCardAlias;
		paymentObject.c_worldlineDirectCardExpiry = paymentInstrument.custom.worldlineDirectCardExpiry;
		paymentObject.c_worldlineDirectCardSchemeReferenceData = paymentInstrument.custom.worldlineDirectCardSchemeReferenceData;
		
		paymentObject.payment_method_id = WorldlineDirectConstants.PAYMENT_METHOD_CARD;
		
		
	} else if (paymentInstrument.custom.worldlineDirectPaymentMethod == WorldlineDirectConstants.PAYMENT_PRODUCT_DIRECT_DEBIT) {//sepa
		paymentObject.c_worldlineDirectMandateReference = paymentInstrument.custom.worldlineDirectMandateReference;
		paymentObject.payment_method_id = WorldlineDirectConstants.PAYMENT_METHOD_DIRECTDEBIT;
	}
	
	return paymentObject;
}

WorldlineDirectBasketDTO.prototype.getShippingAddresses = function (shipments) {
	var shippingAddressObject = [];
	var shipmentsIterator = shipments.iterator();
	while (shipmentsIterator.hasNext()) {
		var shipment = shipmentsIterator.next();
		shippingAddressObject.push({
			"shipment_id": shipment.ID, 
			"shipping_address": this.getAddressObject(shipment.getShippingAddress()),
			"shipping_method" : this.getShippingMethodObject(shipment)
		});
	}
	
	return shippingAddressObject;
}

WorldlineDirectBasketDTO.prototype.getPaymentInstrument = function (paymentInstruments) {
	if (!paymentInstruments.empty) {
		var paymentInstrumentsIterator = paymentInstruments.iterator();
		
		return paymentInstrumentsIterator.next();
	}
}

function WorldlineDirectBasketDTO(order) {
	
	this.products = this.getProducts(order.getAllProductLineItems());
	this.coupons = this.getCouponObject(order.getCouponLineItems());
	this.customer = this.getCustomerObject(order.customer);
	this.billingAddress = this.getAddressObject(order.getBillingAddress());
	this.shippingAddresses = this.getShippingAddresses(order.getShipments());
	this.paymentInstrument = this.getPaymentInstrument(order.getPaymentInstruments());
	this.basket =  {
		"billing_address": this.billingAddress,
		"currency": order.getCurrencyCode(),
		"customer_info": this.customer,
		"product_items": this.products,
		"shipments": this.shippingAddresses,
		"coupon_items": this.coupons,
		"payment_instruments":  [
	        {
	            "payment_method_id": this.paymentInstrument.custom.worldlineDirectPaymentMethod == WorldlineDirectConstants.PAYMENT_PRODUCT_GROUP_CARD ? WorldlineDirectConstants.PAYMENT_METHOD_CARD : WorldlineDirectConstants.PAYMENT_METHOD_DIRECTDEBIT
	        }
	    ],
	    "c_worldlineDirectSubscriptionOrderType": WorldlineDirectConstants.RECURRING_ORDERS_CREATED_BY_MERCHANT,
	    "c_worldlineDirectSubscriptionOriginalOrderID": order.orderNo,
	    "c_worldlineDirectSubscriptionInitialTransactionID": order.custom.worldlineDirectTransactionID
	};
	
}

module.exports = WorldlineDirectBasketDTO;