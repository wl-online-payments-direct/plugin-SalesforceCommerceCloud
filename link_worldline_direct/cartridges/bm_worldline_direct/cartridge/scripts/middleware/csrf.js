'use strict';

var csrfProtection = require('dw/web/CSRFProtection');
var URLUtils = require('dw/web/URLUtils');

/**
 * Middleware validating CSRF token
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next call in the middleware chain
 * @returns {void}
 */
function validateRequest(req, res, next) {
    if (!csrfProtection.validateRequest()) {
        res.redirect(URLUtils.url('ViewApplication-DisplayWelcomePage'));
    }

    next();
}

module.exports = {
    validateRequest: validateRequest
};
