'use strict';

var server = require('server');
server.extend(module.superModule);

var csrfProtection = require('*/cartridge/scripts/middleware/csrf');

/**
 * Appends to the shipping form, so that we can save the browserData in session (since the SFRA shipping form gets cleared on refresh)
 */
server.append(
    'SubmitShipping',
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        session.privacy.browserData = request.httpParameterMap.browserData.value;

        return next();
    }
);

module.exports = server.exports();
