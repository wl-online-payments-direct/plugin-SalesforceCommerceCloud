'use strict';

const server = require('server');
const base = module.superModule;
server.extend(base);

const userLoggedIn = require('*/cartridge/scripts/middleware/userLoggedIn');

/**
 * PaymentInstruments-DeletePayment : Deletes the saved card from the Worldline server
 * @name Base/PaymentInstruments-DeletePayment
 * @function
 * @memberof PaymentInstruments
 * @param {middleware} - userLoggedIn.validateLoggedInAjax
 * @param {querystringparameter} - UUID - the universally unique identifier of the payment instrument to be removed from the shopper's account
 * @param {category} - sensitive
 * @param {returns} - json
 * @param {serverfunction} - get
 */
server.append('DeletePayment', userLoggedIn.validateLoggedInAjax, function (req, res, next) {
    this.on('route:BeforeComplete', function () {
        const worldlineDirectConstants = require('*/cartridge/scripts/worldline/direct/constants');
        var payment = res.getViewData();

        if (payment.raw.paymentMethod.indexOf(worldlineDirectConstants.PAYMENT_METHOD_CARD) > -1) {
            const worldlineApiFacade = require('*/cartridge/scripts/worldline/direct/api/facade');
            worldlineApiFacade.deleteToken(payment.raw.getCreditCardToken());
        }
    });

    return next();
});

module.exports = server.exports();
