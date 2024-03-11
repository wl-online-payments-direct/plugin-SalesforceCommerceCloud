var checkout = module.superModule;
var server = require('server');

server.extend(checkout);

/**
 * Extends the SFRA controller in order to add additional vars in pdict on the checkout.
 */
server.append('Begin', function (req, res, next) {
    const worldlineDirectCommonHelper = require('*/cartridge/scripts/worldline/direct/commonHelper');
    worldlineDirectCommonHelper.appendPaymentDetailsToResponseViewData(res);

    const URLUtils = require('dw/web/URLUtils');
    var viewData = res.getViewData();

    if (!empty(session.privacy.worldlineDirectError)) {
        viewData.worldlineDirectError = session.privacy.worldlineDirectError;
        delete session.privacy.worldlineDirectError;

        if (request.httpParameterMap.showError.value !== "true") {
            res.redirect(URLUtils.https('Checkout-Begin', 'stage', 'payment', 'showError', 'true'));
        }
    }

    res.setViewData(viewData);

    return next();
});

module.exports = server.exports();
