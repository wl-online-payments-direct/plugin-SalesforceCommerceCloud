'use strict';

const assert = require('chai').assert;
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();
const GlobalMock = require('../../mocks/global');
const SiteMock = require('../../mocks/dw.system.Site');
const worldlineDirectConstants = require('../../../cartridges/int_worldline_direct/cartridge/scripts/worldline/direct/constants');

global.session = new GlobalMock.SessionMock();

const TaxMgrMock = {
    TAX_POLICY_GROSS: 0,
    TAX_POLICY_NET: 1,

    getTaxationPolicy() {
        return this.TAX_POLICY_GROSS;
    }
};

const address = {
    address1: 'address1',
    address2: 'address2',
    countryCode: {
        displayValue: 'United States',
        value: 'US'
    },
    firstName: 'first name',
    lastName: 'last name',
    city: 'city',
    phone: '333-333-3333',
    postalCode: '04330',
    stateCode: 'ME',
};
const order = {
    customerEmail: 'customer email',

    paymentInstruments: [
        {
            custom: {
                worldlineDirectPaymentProductID: 3302
            }
        }
    ],

    allProductLineItems: [
        {
            UUID: 'lineItemUUID1',
            getAdjustedPrice: function(proratedPrices) {
                return {
                    value: 100,
                    currencyCode: 'EUR'
                }
            },
            getLineItemText: function() {
                return "line item text"
            },
            quantityValue: 1,
            productID: 'product id',
            productName: 'product name',
            taxRate: 0.2
        }
    ],

    getCurrencyCode: function () {
        return "EUR";
    },
    getOrderNo: function () {
        return "ORDER-NO"
    },
    getOrderToken: function () {
        return "ORDER-TOKEN"
    },
    getBillingAddress: function () {
        return address;
    },
    getDefaultShipment: function () {
        return {
            getShippingAddress() {
                return address;
            },

            adjustedShippingTotalPrice: {
                value: 50
            },
            adjustedShippingTotalTax: {
                value: 10
            }
        };
    },
    getTotalGrossPrice: function() {
        return {
            value: 150,
        }
    }
}

const PersonalNameMock = require('../../../cartridges/int_worldline_direct/cartridge/scripts/worldline/direct/dto/common/personalname');
const AddressMock = proxyquire('../../../cartridges/int_worldline_direct/cartridge/scripts/worldline/direct/dto/common/address', {
    '*/cartridge/scripts/worldline/direct/dto/common/personalname': PersonalNameMock
})

describe('dto / order', function () {
    const WorldlineDirectOrder = proxyquire('../../../cartridges/int_worldline_direct/cartridge/scripts/worldline/direct/dto/order', {
        'dw/system/Site': SiteMock,
        'dw/order/TaxMgr': TaxMgrMock,
        '*/cartridge/scripts/worldline/direct/dto/common/address': AddressMock,
        '*/cartridge/scripts/worldline/direct/constants': worldlineDirectConstants,
        '*/cartridge/scripts/worldline/direct/dto/order/customer': proxyquire('../../../cartridges/int_worldline_direct/cartridge/scripts/worldline/direct/dto/order/customer', {
            '*/cartridge/scripts/worldline/direct/dto/common/address': AddressMock,
            '*/cartridge/scripts/worldline/direct/dto/common/personalname': PersonalNameMock
        })
    });
    const input = new WorldlineDirectOrder(order);

    it('should generate Worldline-specific object', function () {
        assert.deepEqual(input, {
            "amountOfMoney": {
                "amount": 15000,
                "currencyCode": "EUR"
            },
            "references": {
                "merchantReference": "ORDER-NO",
                "merchantParameters": "{\"ot\":\"ORDER-TOKEN\"}"
            },
            "customer": {
                "merchantCustomerId": "CUSTOMER_NO",
                "accountType": "existing",
                "locale": "locale",
                "device": {
                    "acceptHeader": "accept-VALUE",
                    "ipAddress": "http remote address",
                    "locale": "http locale",
                    "userAgent": "http user agent"
                },
                "contactDetails": {
                    "emailAddress": "customer email",
                    "phoneNumber": "333-333-3333"
                },
                "personalInformation": {
                    "name": {
                        "firstName": "first name",
                        "surname": "last name"
                    }
                },
                "billingAddress": {
                    "additionalInfo": "address2",
                    "city": "city",
                    "countryCode": "US",
                    "street": "address1",
                    "zip": "04330",
                    "state": "ME"
                }
            },
            "shipping": {
                "address": {
                    "additionalInfo": "address2",
                    "city": "city",
                    "countryCode": "US",
                    "street": "address1",
                    "zip": "04330",
                    "state": "ME",
                    "name": {
                        "firstName": "first name",
                        "surname": "last name"
                    }
                },
                "emailAddress": "customer email"
            }
        });
    });
});
