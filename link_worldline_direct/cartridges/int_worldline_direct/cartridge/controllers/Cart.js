var cart = module.superModule; // require functionality from last controller in the chain with this name
var server = require('server');

server.extend(cart);

server.prepend('Show', function (req, res, next) {
    // Check if the user clicked the Back browser button while being on an external payment site.
    // In this case we'll recreate their basket
    if (req.session.privacyCache.get("redirectOrderNo") && req.session.privacyCache.get("redirectOrderNo")) {
        var URLUtils = require('dw/web/URLUtils');

        res.redirect(URLUtils.url('WorldlineDirect-BackBtnReturn'));
        return next();
    }

    return next();
});

module.exports = server.exports();
