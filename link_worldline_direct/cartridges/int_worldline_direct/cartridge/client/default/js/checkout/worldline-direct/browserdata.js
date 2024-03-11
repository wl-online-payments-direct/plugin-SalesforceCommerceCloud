'use strict';

/**
 * Collects the browser data and stores it in the form
 */
(function () {
    var browserData = {
        colorDepth: screen.colorDepth,
        screenHeight: screen.height,
        screenWidth: screen.width,
        javaEnabled: navigator.javaEnabled(),
        timezoneOffset: new Date().getTimezoneOffset(),
        canMakeApplePayPayments: !!(window.ApplePaySession && window.ApplePaySession.canMakePayments())
    };
    var browserDataStr = JSON.stringify(browserData);

    // append the browserData field to the shipping form, this way we can avoid having to overwrite the shipping.isml template from SFRA
    const shippingForm = document.querySelector(".shipping-form");

    const browserDataInputField = document.createElement("input");
    browserDataInputField.type = "hidden";
    browserDataInputField.name = "browserData";
    browserDataInputField.value = browserDataStr;

    shippingForm.appendChild(browserDataInputField);
}());
