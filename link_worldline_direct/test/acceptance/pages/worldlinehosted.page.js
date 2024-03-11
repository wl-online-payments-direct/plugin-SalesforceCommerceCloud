const I = actor();

module.exports = {
    locators: {
        hostedPageURLPattern: "ingenico.com/hostedcheckout/",
        threeDSecurePageURLPattern: "v-psp.com/acs/checkauthentication",

        btnPaySecurely: "(//*[text()[contains(.,'Pay Securely')]])[1]",

        ideal_redirectLink: "#lnk_redirect",

        ccForm_cardnumber: "#payment-cardnumber",
        ccForm_cardholdername: "#payment-cardholdername",
        ccForm_cardexpirationmonth: "#payment-cardexpirationmonth",
        ccForm_cardexpirationyear: "#payment-cardexpirationyear",
        ccForm_cvc: "#payment-cvc",

        threeDSecureForm_btnSubmit: "#Submit"
    },

    waitForHostedPageToLoad() {
        I.waitInUrl(this.locators.hostedPageURLPattern);
    },

    fillInCreditCardForm(cardholdername, cardnumber, cardexpirationmonth, cardexpirationyear, cvc) {
        I.fillField(this.locators.ccForm_cardnumber, cardnumber);
        I.fillField(this.locators.ccForm_cardholdername, cardholdername);
        I.selectOption(this.locators.ccForm_cardexpirationmonth, cardexpirationmonth);
        I.selectOption(this.locators.ccForm_cardexpirationyear, cardexpirationyear);

        if (cvc !== null) {
            I.fillField(this.locators.ccForm_cvc, cvc);
        }
    },

    waitFor3DSecureFormToLoad() {
        I.waitInUrl(this.locators.threeDSecurePageURLPattern);
    },

    submit3DSecureForm() {
        I.waitForVisible(this.locators.threeDSecureForm_btnSubmit);
        I.waitForEnabled(this.locators.threeDSecureForm_btnSubmit);
        I.click(this.locators.threeDSecureForm_btnSubmit);
    }

};
