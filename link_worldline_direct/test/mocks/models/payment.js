'use strict';

const SFRA_CARTRIDGE_PATH = '../../../../storefront-reference-architecture/';

const proxyquire = require('proxyquire').noCallThru().noPreserveCache();
const collections = require(SFRA_CARTRIDGE_PATH + 'test/mocks/util/collections');
const SiteMock = require('../../mocks/dw.system.Site');

function proxyModel() {
    return proxyquire('../../../cartridges/int_worldline_direct/cartridge/models/payment', {
        'dw/system/Site': SiteMock,
        '*/cartridge/scripts/worldline/direct/paymentProductOverridesHelper': {
            getPaymentProduct: function(productId) {
                return {
                    isShown: true
                }
            }
        },
        '*/cartridge/scripts/util/collections': collections,
        'dw/order/PaymentMgr': {
            getApplicablePaymentMethods: function () {
                return [
                    {
                        ID: 'GIFT_CERTIFICATE',
                        name: 'Gift Certificate'
                    },
                    {
                        ID: 'CREDIT_CARD',
                        name: 'Credit Card'
                    }
                ];
            },
            getPaymentMethod: function () {
                return {
                    getApplicablePaymentCards: function () {
                        return [
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
                        ];
                    }
                };
            },
            getApplicablePaymentCards: function () {
                return ['applicable payment cards'];
            }
        },
        'dw/order/PaymentInstrument': {},
        'dw/system/Logger': {
            getRootLogger: function () {

            }
        },
        'dw/order/Basket': function () {},
        'dw/web/Resource': {},
        '*/cartridge/scripts/worldline/direct/commonHelper': {
            isHostedTokenizationEnabled: function() {
                return false;
            }
        },
        '*/cartridge/scripts/worldline/direct/api/facade': {},
        '*/cartridge/scripts/worldline/direct/constants': require('../../../cartridges/int_worldline_direct/cartridge/scripts/worldline/direct/constants')
    });
}

module.exports = proxyModel();
