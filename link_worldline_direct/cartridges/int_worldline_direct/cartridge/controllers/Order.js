var orderController = module.superModule;
var server = require('server');

server.extend(orderController);

/**
 * Extends the SFRA controller in order to add additional vars in pdict on the checkout.
 */
server.append('Confirm', function (req, res, next) {
    const worldlineDirectCommonHelper = require('*/cartridge/scripts/worldline/direct/commonHelper');
    worldlineDirectCommonHelper.appendPaymentDetailsToResponseViewData(res);

    return next();
});

module.exports = server.exports();
