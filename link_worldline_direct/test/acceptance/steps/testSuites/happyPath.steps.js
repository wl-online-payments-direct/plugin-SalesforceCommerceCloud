const { I, data, cartPage, checkoutPage, worldlineHostedPage, accountPage, loginPage } = inject();

var orderHistoryNumber = '';
let worldlinePaymentMethod = '';

Then('shopper goes to cart', () => {
    I.waitForElement(cartPage.locators.cartIcon);
    I.scrollTo(cartPage.locators.cartIcon);
    I.click(cartPage.locators.cartIcon);
});

Then('shopper changes product quantity to {string}', (quantity) => {
    cartPage.editQuantity(quantity);
});

Then('shopper selects checkout from cart', () => {
    I.waitForElement(cartPage.locators.checkoutBtn);
    I.click(cartPage.locators.checkoutBtn);
});

Then('shopper selects checkout as guest', () => {
    I.waitForElement(checkoutPage.locators.checkoutAsGuestBtn);
    I.fillField(checkoutPage.locators.checkoutAsGuestEmail, data.checkout.email);
    I.click(checkoutPage.locators.checkoutAsGuestBtn);
});

Then('shopper fills out shipping information', () => {
    checkoutPage.fillShippingInfo(data.checkout.fName, data.checkout.lName, data.checkout.address1,
        data.checkout.country, data.checkout.state, data.checkout.city,
        data.checkout.zip, data.checkout.phone);
});

Then('shopper verifies shipping information', () => {
    checkoutPage.verifyShipping(data.checkout.fName, data.checkout.lName, data.checkout.address1,
        data.checkout.city, data.checkout.stateAbr, data.checkout.zip);
});

Then('shopper proceeds to payment section', () => {
    I.waitForElement(checkoutPage.locators.toPayment);
    I.click(checkoutPage.locators.toPayment);
});

Then('shopper fills out billing information', () => {
    checkoutPage.fillPaymentInfoGuest(data.user1.fName, data.user1.lName, data.user1.address1,
        data.user1.city, data.user1.stateAbr, data.user1.zip, data.checkout.email, data.checkout.phone, data.checkout.ccNum,
        data.checkout.expMonth, data.checkout.expYear, data.checkout.ccSecCode);
});

Then('shopper selects Worldline payment method {string}', (paymentMethod) => {
    worldlinePaymentMethod = paymentMethod;

    I.scrollTo(checkoutPage.locators.paymentOptionsContainer);
    I.click(worldlinePaymentMethod, checkoutPage.locators.paymentOptionsContainer);

    if (worldlinePaymentMethod.toUpperCase() === 'IDEAL') {
        I.waitForElement(checkoutPage.locators.worldline_paymentDirectoryIssuerDropDown);
        I.selectOption(checkoutPage.locators.worldline_paymentDirectoryIssuerDropDown, "Issuer Simulation");
    }
});

Then('shopper fills out registered user billing information', () => {
    checkoutPage.fillPaymentInfoRegistered(data.checkout.email, data.checkout.phone, data.checkout.ccSecCode);
});

Then('shopper places order', () => {
    I.waitForElement(checkoutPage.locators.placeOrder);
    I.click(checkoutPage.locators.placeOrder);
    checkoutPage.verifyCheckoutInfo(data.checkout.fName, data.checkout.lName, data.checkout.address1,
        data.checkout.city, data.checkout.zip, data.checkout.phone,
        data.checkout.email, data.checkout.ccNum, data.checkout.ccExpDate, data.product.quantity,
        data.product.totalItemPrice, data.product.shipping, data.product.tax, data.product.estimatedTotal);
    I.waitForElement(checkoutPage.locators.confirmOrder);
    I.click(checkoutPage.locators.confirmOrder);
});

Then('shopper confirms the order on the hosted checkout page', () => {
    worldlineHostedPage.waitForHostedPageToLoad();

    let ccData = null;
    worldlinePaymentMethodUpperCase = worldlinePaymentMethod.toUpperCase();

    if (worldlinePaymentMethodUpperCase === 'VISA') {
        ccData = data.checkout.cards.visa;
    } else if (worldlinePaymentMethodUpperCase === 'MASTERCARD') {
        ccData = data.checkout.cards.master;
    } else if (worldlinePaymentMethodUpperCase === 'AMERICAN EXPRESS') {
        ccData = data.checkout.cards.amex;
    } else if (worldlinePaymentMethodUpperCase === 'DINERS CLUB') {
        ccData = data.checkout.cards.dinersClub;
    } else if (worldlinePaymentMethodUpperCase === 'JCB') {
        ccData = data.checkout.cards.jcb;
    } else if (worldlinePaymentMethodUpperCase === 'MAESTRO') {
        ccData = data.checkout.cards.maestro;
    } else if (worldlinePaymentMethodUpperCase === 'BCMC') {
        ccData = data.checkout.cards.bcmc;
    }

    if (ccData !== null) {
        worldlineHostedPage.fillInCreditCardForm(
            data.checkout.fName + ' ' + data.checkout.lName,
            ccData.ccNum,
            ccData.expMonth,
            ccData.expYear,
            ccData.ccSecCode
        );
    }

    I.waitForEnabled(worldlineHostedPage.locators.btnPaySecurely);
    I.click(worldlineHostedPage.locators.btnPaySecurely);

    if (worldlinePaymentMethodUpperCase === 'IDEAL') {
        I.waitForVisible(worldlineHostedPage.locators.ideal_redirectLink);
        I.click(worldlineHostedPage.locators.ideal_redirectLink);
    } else if (ccData.is3DSecure) {
        worldlineHostedPage.waitFor3DSecureFormToLoad();
        worldlineHostedPage.submit3DSecureForm();
    }
});

Then('shopper verifies the order confirmation page', async () => {
    checkoutPage.verifyOrderConfirmation(data.checkout.fName, data.checkout.lName, data.checkout.address1,
        data.checkout.city, data.checkout.zip, data.checkout.phone,
        data.checkout.email, data.checkout.ccNum, data.checkout.ccExpDate, data.product.quantity,
        data.product.totalItemPrice, data.product.shipping, data.product.tax, data.product.estimatedTotal);
    orderHistoryNumber = await I.grabTextFrom('.summary-details.order-number');
});

Then('shopper goes to profile saved payments page and deletes credit card', () => {
    I.amOnPage(data.account.accountPage);
    accountPage.viewAllPayments();
    accountPage.removePayment(data.account.deletePaymentModalText);
});

Then('logs out of the account', () => {
    accountPage.logOut();
});

Then('shopper is able to fill out the order number, email, and zip code', () => {
    loginPage.checkOrder(orderHistoryNumber, data.orderHistory.email, data.orderHistory.zip);
});

Then('shopper is able to click the check status button', () => {
    I.waitForElement(loginPage.locators.primaryButton);
    I.click(locate(loginPage.locators.primaryButton).withText('Check status'));
});

Then('shopper is able to view order detail', () => {
    loginPage.verifyOrderHistory(data.product);
});
