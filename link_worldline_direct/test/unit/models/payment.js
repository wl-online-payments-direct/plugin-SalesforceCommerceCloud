'use strict';

const SFRA_CARTRIDGE_PATH = '../../../../storefront-reference-architecture/';

const assert = require('chai').assert;

const mockSuperModule = require('../../mocks/superModule');
const ArrayList = require(SFRA_CARTRIDGE_PATH + 'test/mocks/dw.util.Collection');

const paymentMethods = new ArrayList([
    {
        ID: 'GIFT_CERTIFICATE',
        name: 'Gift Certificate'
    },
    {
        ID: 'CREDIT_CARD',
        name: 'Credit Card'
    }
]);

const paymentCards = new ArrayList([
    {
        cardType: 'Visa',
        name: 'Visa',
        UUID: 'some UUID'
    },
    {
        cardType: 'Amex',
        name: 'American Express',
        UUID: 'some UUID'
    },
    {
        cardType: 'Master Card',
        name: 'MasterCard'
    },
    {
        cardType: 'Discover',
        name: 'Discover'
    }
]);

const paymentInstruments = new ArrayList([
    {
        creditCardNumberLastDigits: '1111',
        creditCardHolder: 'CC Holder name',
        creditCardExpirationYear: 2018,
        creditCardType: 'Visa',
        paymentMethod: 'WORLDLINE_DIRECT_CARD',
        creditCardExpirationMonth: 1,
        paymentTransaction: {
            amount: {
                value: 0
            }
        },
        custom: {
            worldlineDirectPaymentProductName: 'Worldline product name',
            worldlineDirectCreditCardAlias: '************1111'
        }
    }
]);

function createApiBasket(options) {
    const basket = {
        totalGrossPrice: {
            value: 'some value'
        }
    };

    if (options && options.paymentMethods) {
        basket.paymentMethods = options.paymentMethods;
    }

    if (options && options.paymentCards) {
        basket.paymentCards = options.paymentCards;
    }

    if (options && options.paymentInstruments) {
        basket.paymentInstruments = options.paymentInstruments;
    }

    return basket;
}

describe('Payment', function () {
    before(function () {
        mockSuperModule.create(require(SFRA_CARTRIDGE_PATH + 'test/mocks/models/payment'));
    });

    after(function () {
        mockSuperModule.remove();
    });


    const PaymentModel = require('../../mocks/models/payment');

    it('should take payment Methods and convert to a plain object ', function () {
        const result = new PaymentModel(createApiBasket({ paymentMethods: paymentMethods }), null);
        assert.equal(result.applicablePaymentMethods.length, 2);
        assert.equal(result.applicablePaymentMethods[0].ID, 'GIFT_CERTIFICATE');
        assert.equal(result.applicablePaymentMethods[0].name, 'Gift Certificate');
        assert.equal(result.applicablePaymentMethods[1].ID, 'CREDIT_CARD');
        assert.equal(result.applicablePaymentMethods[1].name, 'Credit Card');
    });

    it('should take payment cards and convert to a plain object ', function () {
        const result = new PaymentModel(createApiBasket({ paymentCards: paymentCards }), null);
        assert.equal(result.applicablePaymentCards.length, 3);

        assert.equal(result.applicablePaymentCards[0].cardType, 'Visa');
        assert.equal(result.applicablePaymentCards[0].name, 'Visa');
        assert.equal(result.applicablePaymentCards[1].cardType, 'Amex');
        assert.equal(result.applicablePaymentCards[1].name, 'American Express');
    });

    it('should take payment instruments and convert to a plain object ', function () {
        const result = new PaymentModel(createApiBasket({ paymentInstruments: paymentInstruments }), null);
        assert.equal(result.selectedPaymentInstruments.length, 1);

        assert.equal(result.selectedPaymentInstruments[0].name, 'Worldline product name');
        assert.equal(result.selectedPaymentInstruments[0].owner, 'CC Holder name');
        assert.equal(result.selectedPaymentInstruments[0].expirationYear, 2018);
        assert.equal(result.selectedPaymentInstruments[0].maskedCreditCardNumber, '************1111');
        assert.equal(result.selectedPaymentInstruments[0].paymentMethod, 'WORLDLINE_DIRECT_CARD');
        assert.equal(result.selectedPaymentInstruments[0].expirationMonth, 1);
        assert.equal(result.selectedPaymentInstruments[0].amount, 0);
    });
});
