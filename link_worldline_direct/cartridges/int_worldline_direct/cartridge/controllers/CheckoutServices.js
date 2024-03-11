'use strict';

/**
 * @namespace CheckoutServices
 */

var server = require('server');
var base = module.superModule;

server.extend(base);

/**
 * CheckoutServices-PlaceOrder : The CheckoutServices-PlaceOrder endpoint places the order
 * @name Base/CheckoutServices-PlaceOrder
 * @function
 * @memberof CheckoutServices
 * @param {middleware} - server.middleware.https
 * @param {category} - sensitive
 * @param {returns} - json
 * @param {serverfunction} - post
 */
server.append('PlaceOrder', server.middleware.https, function (req, res, next) {
    if (res.viewData.redirectOrderNo) {
        req.session.privacyCache.set('redirectOrderNo', res.viewData.redirectOrderNo);
        req.session.privacyCache.set('redirectOrderToken', res.viewData.redirectOrderToken);
    }

    return next();
});

module.exports = server.exports();
