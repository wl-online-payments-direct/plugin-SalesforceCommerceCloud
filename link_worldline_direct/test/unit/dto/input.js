'use strict';

const INT_WORLDLINE_PATH = '../../../cartridges/int_worldline_direct/';

const assert = require('chai').assert;
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();

const SiteMock = require('../../mocks/dw.system.Site');
const URLUtilsMock = require('../../mocks/dw.web.URLUtils');
const GlobalMock = require('../../mocks/global');
const worldlineDirectConstantsMock = {
    HOSTED_CHECKOUT_RETURN_CONTROLLER: 'HOSTED_CHECKOUT_RETURN_CONTROLLER-VALUE'
};

const paymentInstruments = [
    {
        creditCardNumberLastDigits: '1111',
        creditCardHolder: 'CC Holder name',
        creditCardExpirationYear: 2018,
        creditCardType: 'Visa',
        maskedCreditCardNumber: '************1111',
        paymentMethod: 'WORLDLINE_DIRECT_CARD',
        creditCardExpirationMonth: 1,
        paymentTransaction: {
            amount: {
                value: 0
            }
        },
        custom: {
            worldlineDirectPaymentProductName: 'Worldline product name',
            worldlineDirectPaymentProductID: "12",
        }
    }
];

const order = {
    getOrderNo: function () {
        return "ORDER-NO"
    },
    getOrderToken: function () {
        return "ORDER-TOKEN"
    }
}

const paymentProcessor = {
    ID: "WORLDLINE_DIRECT_CREDIT"
}

const customer = {
    authenticated: false,
};


describe('dto / input', function () {
    global.request = new GlobalMock.RequestMock();
    global.session = new GlobalMock.SessionMock();
    global.empty = GlobalMock.empty;

    after(function() {
        delete global.request;
        delete global.session;
        delete global.empty;
    });

    describe('cardpayment', function () {
        const WorldlineDirectCardPaymentMethodSpecificInput = proxyquire(INT_WORLDLINE_PATH + '/cartridge/scripts/worldline/direct/dto/input/cardpayment', {
            'dw/system/Site': SiteMock
        });
        const input = new WorldlineDirectCardPaymentMethodSpecificInput(paymentInstruments[0], customer);
    
        it('should generate Worldline-specific object', function () {
            assert.deepEqual(input, {
                authorizationMode: 'worldlineDirectOperationCode-VALUE',
                tokenize: true,
                transactionChannel: 'ECOMMERCE',
                paymentProductId: 12
            });
        });
    });

    describe('hostedcheckout', function () {
        const WorldlineDirectHostedCheckoutSpecificInput = proxyquire(INT_WORLDLINE_PATH + '/cartridge/scripts/worldline/direct/dto/input/hostedcheckout', {
            'dw/system/Site': SiteMock,
            'dw/web/URLUtils': URLUtilsMock,
            '*/cartridge/scripts/worldline/direct/constants': worldlineDirectConstantsMock,
            '*/cartridge/scripts/worldline/direct/commonHelper': {
                getWalletPaymentIntsrumentTokensByPaymentProductId: function() {
                    return ['token1', 'token2', 'token3']
                }
            }
        });
        const input = new WorldlineDirectHostedCheckoutSpecificInput(paymentInstruments[0], order);
    
        it('should generate Worldline-specific object', function () {
            assert.deepEqual(input, {
                "isRecurring": false,
                "locale": "locale",
                "showResultPage": false,
                "returnUrl": "https-url",
                "paymentProductFilters": {
                    "restrictTo": {
                        "products": [
                            12
                        ]
                    }
                },
                "variant": 'worldlineDirectHCPTemplate-VALUE',
                "tokens": "token1,token2,token3"
            });
        });
    });
    
    describe('mobilepayment', function () {
        const WorldlineDirectMobilePaymentMethodSpecificInput = proxyquire(INT_WORLDLINE_PATH + '/cartridge/scripts/worldline/direct/dto/input/mobilepayment', {
            'dw/system/Site': SiteMock
        });
        const input = new WorldlineDirectMobilePaymentMethodSpecificInput(paymentInstruments[0]);
    
        it('should generate Worldline-specific object', function () {
            assert.deepEqual(input, {
                authorizationMode: 'worldlineDirectOperationCode-VALUE',
                paymentProductId: 12
              });
        });
    });
    
    describe('redirectpayment', function () {
        const WorldlineDirectRedirectPaymentMethodSpecificInput = proxyquire(INT_WORLDLINE_PATH + '/cartridge/scripts/worldline/direct/dto/input/redirectpayment', {
            'dw/system/Site': SiteMock,
            'dw/web/URLUtils': URLUtilsMock,
            '*/cartridge/scripts/worldline/direct/constants': worldlineDirectConstantsMock,
        });
        const input = new WorldlineDirectRedirectPaymentMethodSpecificInput(paymentInstruments[0], paymentProcessor, order);
    
        it('should generate Worldline-specific object', function () {
            assert.deepEqual(input, {
                requiresApproval: true,
                tokenize: false,
                paymentProductId: 12,
                redirectionData: { returnUrl: 'https-url' }
              });
        });
    });

    describe('tokenizedcardpayment', function () {
        const WorldlineDirectCardPaymentMethodSpecificInput = proxyquire(INT_WORLDLINE_PATH + '/cartridge/scripts/worldline/direct/dto/input/tokenizedcardpayment', {
            'dw/system/Site': SiteMock,
            'dw/web/URLUtils': URLUtilsMock,
            '*/cartridge/scripts/worldline/direct/constants': worldlineDirectConstantsMock,
        });
        const input = new WorldlineDirectCardPaymentMethodSpecificInput(paymentInstruments[0], order);
    
        it('should generate Worldline-specific object', function () {
            assert.deepEqual(input, {
                authorizationMode: 'worldlineDirectOperationCode-VALUE',
                tokenize: false,
                transactionChannel: 'ECOMMERCE',
                paymentProductId: 12,
                token: undefined,
                returnUrl: 'https-url',
                threeDSecure: { redirectionData: { returnUrl: 'https-url' } }
              });
        });
    });
});
