'use strict';

/**
 * This function is to handle the post payment authorization customizations
 * @param {Object} result - Authorization Result
 * @returns {Object | null} redirect data or null if a redirect should not be done
 */
function postAuthorization(result) {
    if (result.redirect) {
        return {
            error: true,
            cartError: true,    // a hacky way to make the redirect use GET, instead of POST
            redirectUrl: result.redirectUrl,
            redirectOrderNo: result.redirectOrderNo,
            redirectOrderToken: result.redirectOrderToken
        };
    }

    return null;
}

exports.postAuthorization = postAuthorization;
