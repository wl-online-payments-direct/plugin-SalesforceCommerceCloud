/* global jQuery */
(function ($) {
    $(document).ready(function () {
        const pageDiv = document.querySelector(".page");
        if (pageDiv.classList.contains("transactions")) {
            const page = require("./pages/worldlineTransactions");
            page.init(window.worldlineAdminConfig, $);
        } else if (pageDiv.classList.contains("payment_products")) {
            const page = require("./pages/worldlinePaymentProducts");
            page.init($);
        }
    });
}(jQuery));
