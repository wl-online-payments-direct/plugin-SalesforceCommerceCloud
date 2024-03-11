'use strict';

const SFRA_CARTRIDGE_PATH = '../../../../storefront-reference-architecture/';

const assert = require('chai').assert;
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();

const mockSuperModule = require('../../mocks/superModule');
const URLUtils = require(SFRA_CARTRIDGE_PATH + 'test/mocks/dw.web.URLUtils');
const AddressModel = require(SFRA_CARTRIDGE_PATH + 'test/mocks/models/address');

const currentCustomer = {
    addressBook: {
        addresses: {},
        preferredAddress: {
            address1: '15 South Point Drive',
            address2: null,
            city: 'Boston',
            countryCode: {
                displayValue: 'United States',
                value: 'US'
            },
            firstName: 'FirstName',
            lastName: 'LastName',
            ID: 'Home',
            postalCode: '02125',
            stateCode: 'MA'
        }
    },
    customer: {},
    profile: {
        firstName: 'FirstName',
        lastName: 'LastName',
        email: 'sampleemail@gmail.com'
    },
    wallet: {
        paymentInstruments: [
            {
                creditCardExpirationMonth: '3',
                creditCardExpirationYear: '2019',
                maskedCreditCardNumber: '***********4215',
                creditCardType: 'Visa',
                paymentMethod: 'CREDIT_CARD',
                raw: {
                    custom: {
                        worldlineDirectPaymentProductID: 690
                    }
                }
            },
            {
                creditCardExpirationMonth: '4',
                creditCardExpirationYear: '2019',
                maskedCreditCardNumber: '***********4215',
                creditCardType: 'Amex',
                paymentMethod: 'CREDIT_CARD',
                raw: {
                    custom: {
                        worldlineDirectPaymentProductID: 690
                    }
                }
            },
            {
                creditCardExpirationMonth: '6',
                creditCardExpirationYear: '2019',
                maskedCreditCardNumber: '***********4215',
                creditCardType: 'Master Card',
                paymentMethod: 'CREDIT_CARD',
                raw: {
                    custom: {
                        worldlineDirectPaymentProductID: 690
                    }
                }
            },
            {
                creditCardExpirationMonth: '5',
                creditCardExpirationYear: '2019',
                maskedCreditCardNumber: '***********4215',
                creditCardType: 'Discover',
                paymentMethod: 'CREDIT_CARD',
                raw: {
                    custom: {
                        worldlineDirectPaymentProductID: null
                    }
                }
            },
            {
                paymentMethod: 'OTHER',
                creditCardType: 'Discover',
                raw: {
                    custom: {
                    }
                }
            }
        ]
    },
    raw: {
        authenticated: true,
        registered: true
    }
};

function MockCustomer() {}

describe('account', function () {
    const AccountModel = proxyquire('../../../cartridges/int_worldline_direct/cartridge/models/account', {
        'dw/web/URLUtils': URLUtils,
        'dw/customer/Customer': MockCustomer,
        '*/cartridge/scripts/worldline/direct/paymentProductOverridesHelper': {
            getPaymentProduct: function(productId) {
                return {
                    isShown: true
                }
            }
        }
    });

    before(function () {
        mockSuperModule.create(proxyquire(SFRA_CARTRIDGE_PATH + 'cartridges/app_storefront_base/cartridge/models/account', {
            '*/cartridge/models/address': AddressModel,
            'dw/web/URLUtils': URLUtils,
            'dw/customer/Customer': MockCustomer,
        }));
    });

    after(function () {
        mockSuperModule.remove();
    });

    it('should receive Worldline payment instruments', function () {
        const result = new AccountModel(currentCustomer);

        assert.equal(result.customerPaymentInstruments.length, 5);
        assert.equal(result.customerPaymentInstruments[0].worldline.paymentProductID, 690);
        assert.equal(result.customerPaymentInstruments[1].worldline.paymentProductID, 690);
        assert.equal(result.customerPaymentInstruments[2].worldline.paymentProductID, 690);
        assert.equal(result.customerPaymentInstruments[3].worldline, undefined);
        assert.equal(result.customerPaymentInstruments[4].worldline, undefined);
    });

    it('cardTypeImage property should be present for credit cards', function () {
        const result = new AccountModel(currentCustomer);

        assert.equal(result.customerPaymentInstruments.length, 5);

        const validateCC = (ccObject) => {
            assert.isObject(ccObject.cardTypeImage);
            assert.equal(ccObject.cardTypeImage.src, 'some url');
        };

        validateCC(result.customerPaymentInstruments[0]);
        validateCC(result.customerPaymentInstruments[1]);
        validateCC(result.customerPaymentInstruments[2]);
        validateCC(result.customerPaymentInstruments[3]);
    });
});
