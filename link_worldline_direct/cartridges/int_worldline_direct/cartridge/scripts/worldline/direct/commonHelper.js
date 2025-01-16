'use strict';

var WorldlineDirectConstants = require('*/cartridge/scripts/worldline/direct/constants');

/**
 * Returns customer's country code based on geolocation, shipping address or billing address
 * @param {dw.order.Basket} currentBasket - Customer's Basket object
 * @returns {string} countryCode - Customer's Country Code
 */
function getCustomerCountryCode(currentBasket) {
    var countryCode = request.geolocation.countryCode;

    if (currentBasket.billingAddress && currentBasket.billingAddress.countryCode) {
        countryCode = currentBasket.billingAddress.countryCode.value;
    } else if (currentBasket.defaultShipment && currentBasket.defaultShipment.shippingAddress && currentBasket.defaultShipment.shippingAddress.countryCode) {
        countryCode = currentBasket.defaultShipment.shippingAddress.countryCode.value;
    }

    return countryCode;
}

/**
 * Determines if checkout type is set to Hosted Tokenization Page
 * @returns {boolean} hostedTokenizationEnabled
 */
function isHostedTokenizationEnabled() {
    const currentSite = require('dw/system/Site').getCurrent();

    return (WorldlineDirectConstants.CHECKOUT_TYPE_TOKENIZATION === currentSite.getCustomPreferenceValue("worldlineDirectCheckoutType").value);
}

/**
 * Determines if cards should be grouped on HCP
 * @returns {boolean} isHCPGroupCardsEnabled
 */
function isHCPGroupCardsEnabled() {
    return require('dw/system/Site').getCurrent().getCustomPreferenceValue("worldlineDirectHCPGroupCards");
}

/**
 * Handles the payment status actions
 * @param {dw.order.Order} order - The current order
 * @param {Object} payment -  The PaymentResult Object
 */
function handlePaymentStatus(order, payment) {
    const OrderMgr = require('dw/order/OrderMgr');
    const Order = require('dw/order/Order');
    const Resource = require('dw/web/Resource');
    const Transaction = require('dw/system/Transaction');

    if (order.status.value === Order.ORDER_STATUS_CREATED && WorldlineDirectConstants.REJECTED_PAYMENT_STATUSES.indexOf(payment.status) > -1) {
        Transaction.wrap(function () {
            order.custom.worldlineDirectStatusCategory = WorldlineDirectConstants.REJECTED_PAYMENT_STATUS_CATEGORY;
            order.trackOrderChange('Order Worldline Direct Status Category changed to  '  + WorldlineDirectConstants.REJECTED_PAYMENT_STATUS_CATEGORY);
            OrderMgr.failOrder(order, true);
        });

        session.privacy.worldlineDirectError = Resource.msg('error.payment.not.valid', 'worldlineDirect', null);
        throw new Error('error.payment.not.valid');
    } else if (WorldlineDirectConstants.REJECTED_PAYMENT_STATUSES.indexOf(payment.status) > -1) {
        Transaction.wrap(function () {
            order.custom.worldlineDirectStatusCategory = WorldlineDirectConstants.REJECTED_PAYMENT_STATUS_CATEGORY;
            order.trackOrderChange('Order Worldline Direct Status Category changed to  '  + WorldlineDirectConstants.REJECTED_PAYMENT_STATUS_CATEGORY);
            OrderMgr.cancelOrder(order);
        });
    } else if (WorldlineDirectConstants.UNKNOWN_PAYMENT_STATUSES.indexOf(payment.status) > -1) {
        Transaction.wrap(function () {
            order.custom.worldlineDirectStatusCategory = WorldlineDirectConstants.UNKNOWN_PAYMENT_STATUS_CATEGORY;
            order.trackOrderChange('Order Worldline Direct Status Category changed to  '  + WorldlineDirectConstants.UNKNOWN_PAYMENT_STATUS_CATEGORY);
            order.setPaymentStatus(Order.PAYMENT_STATUS_NOTPAID);
            order.trackOrderChange("Order payment status changed to NOT PAID.");
        });
    } else if (WorldlineDirectConstants.SUCCESSFUL_PAYMENT_STATUSES.indexOf(payment.status) > -1) {
        Transaction.wrap(function () {
            order.custom.worldlineDirectStatusCategory = WorldlineDirectConstants.AUTHORIZED_PAYMENT_STATUS_CATEGORY;
            order.trackOrderChange('Order Worldline Direct Status Category changed to  '  + WorldlineDirectConstants.AUTHORIZED_PAYMENT_STATUS_CATEGORY);
        });
    } else if (WorldlineDirectConstants.COMPLETED_PAYMENT_STATUSES.indexOf(payment.status) > -1) {
        Transaction.wrap(function () {
            order.custom.worldlineDirectStatusCategory = WorldlineDirectConstants.COMPLETED_PAYMENT_STATUS_CATEGORY;
            order.trackOrderChange('Order Worldline Direct Status Category changed to  '  + WorldlineDirectConstants.COMPLETED_PAYMENT_STATUS_CATEGORY);
            order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
            order.trackOrderChange("Order payment status changed to PAID.");
        });
    }
}

/**
 * Handles order placement actions
 * @param {dw.order.Order} order - The current order
 * @param {Object} paymentResult -  The PaymentResult Object
 * @param {Object|null} req -  Current Request Object || null
 * @param {Object|null} res -  Current Response Object || null
 * @returns {Object} orderPlacementResult
 */
function handleOrderPlacement(order, paymentResult, req, res) {
    const OrderMgr = require('dw/order/OrderMgr');
    const Resource = require('dw/web/Resource');
    const Transaction = require('dw/system/Transaction');
    const URLUtils = require('dw/web/URLUtils');
    const Site = require('dw/system/Site');

    const hooksHelper = require('*/cartridge/scripts/helpers/hooks');
    const COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
    const addressHelpers = require('*/cartridge/scripts/helpers/addressHelpers');

    // Handle custom processing post authorization
    var options = {
        req: req,
        res: res
    };
    var postAuthCustomizations = hooksHelper('app.post.auth', 'postAuthorization', paymentResult, order, options, require('*/cartridge/scripts/hooks/postAuthorizationHandling').postAuthorization);
    if (postAuthCustomizations && Object.prototype.hasOwnProperty.call(postAuthCustomizations, 'error')) {
        return postAuthCustomizations;
    }

    var fraudDetectionStatus = hooksHelper('app.fraud.detection', 'fraudDetection', order, require('*/cartridge/scripts/hooks/fraudDetection').fraudDetection);
    if (fraudDetectionStatus.status === 'fail') {
        Transaction.wrap(function () { OrderMgr.failOrder(order, true); });

        if (req) {
            req.session.privacyCache.set('fraudDetectionStatus', true);
        }

        return {
            error: true,
            redirectUrl: URLUtils.https('Error-ErrorCode', 'err', fraudDetectionStatus.errorCode)
        };
    }

    // Places the order
    var placeOrderResult = COHelpers.placeOrder(order, fraudDetectionStatus);
    if (placeOrderResult.error) {
        return {
            error: true,
            errorMsg: Resource.msg('error.technical', 'checkout', null),
            redirectUrl: URLUtils.https('Checkout-Begin', 'stage', 'payment', 'showError', 'true')
        };
    }

    if (order.custom.worldlineDirectStatusCategory.value === WorldlineDirectConstants.UNKNOWN_PAYMENT_STATUS_CATEGORY) {
        const Order = require('dw/order/Order');
        Transaction.wrap(function () {
            order.setConfirmationStatus(Order.CONFIRMATION_STATUS_NOTCONFIRMED);
            order.setExportStatus(Order.EXPORT_STATUS_NOTEXPORTED);
        });
    }

    // if the order is placed in SALE mode, mark that it has captures
    if (Site.getCurrent().getCustomPreferenceValue('worldlineDirectOperationCode').getValue() === WorldlineDirectConstants.OPERATION_CODE_SALE) {
        Transaction.wrap(function () {
            order.custom.worldlineDirectHasCaptures = true;
        });
    }

    if (req) {
        if (req.currentCustomer.addressBook) {
            // save all used shipping addresses to address book of the logged in customer
            var allAddresses = addressHelpers.gatherShippingAddresses(order);
            allAddresses.forEach(function (address) {
                if (!addressHelpers.checkIfAddressStored(address, req.currentCustomer.addressBook.addresses)) {
                    addressHelpers.saveAddress(address, req.currentCustomer, addressHelpers.generateAddressName(address));
                }
            });
        }

        req.session.privacyCache.set('usingMultiShipping', false);
    }

    if (order.getCustomerEmail()) {
        COHelpers.sendConfirmationEmail(order, order.customerLocaleID);
    }

    return {
        error: false,
        redirectUrl: URLUtils.https('WorldlineDirect-OrderReturn', 'ID', order.orderNo, 'token', order.orderToken)
    };
}

/**
 * Retrieves tokens for customer's saved payment instruments per payment product
 * @param {int} paymentProductId - The payment product ID
 * @param {dw.customer.Customer} customer -  Current Customer
 * @returns {array} tokens - Array of tokens
 */
function getWalletPaymentIntsrumentTokensByPaymentProductId(paymentProductId, customer) {
    var tokens = [];

    if (customer.authenticated) {
        var wallet = customer.getProfile().getWallet();
        var paymentInstruments = wallet.paymentInstruments;

        if (paymentInstruments.getLength() > 0) {
            var paymentInstrumentsIterator = paymentInstruments.iterator();
            while (paymentInstrumentsIterator.hasNext()) {
                var paymentInstrument = paymentInstrumentsIterator.next();

                if (paymentProductId === null || paymentInstrument.custom.worldlineDirectPaymentProductID === paymentProductId) {
                    tokens.push(paymentInstrument.getCreditCardToken());
                }
            }
        }
    }

    return tokens;
}

/**
 * Retrieves tokens for customer's saved payment instruments per payment method
 * @param {string} paymentMethodID - The payment method ID
 * @param {dw.customer.Customer} customer -  Current Customer
 * @returns {array} tokens - Array of tokens
 */
function getWalletPaymentIntsrumentTokensByPaymentMethod(paymentMethodID, customer) {
    var tokens = [];

    if (customer.authenticated) {
        var wallet = customer.getProfile().getWallet();
        var paymentInstruments = wallet.getPaymentInstruments(paymentMethodID);

        if (paymentInstruments.getLength() > 0) {
            var paymentInstrumentsIterator = paymentInstruments.iterator();
            while (paymentInstrumentsIterator.hasNext()) {
                var paymentInstrument = paymentInstrumentsIterator.next();
                tokens.push(paymentInstrument.getCreditCardToken());
            }
        }
    }

    return tokens;
}

/**
 * Saves current payment instrument in customer's wallet
 * @param {string} token - The token for the current payment
 * @param {dw.order.PaymentInstrument} orderPaymentInstrument -  The payment instrument to save
 * @param {dw.customer.Customer} customer -  Current Customer
 */
function savePaymentInstrumentToWallet(token, orderPaymentInstrument, customer) {
    var existingTokens = getWalletPaymentIntsrumentTokensByPaymentProductId(orderPaymentInstrument.custom.worldlineDirectPaymentProductID, customer);

    if (existingTokens.indexOf(token) < 0) {
        const Transaction = require('dw/system/Transaction');
        const worldlineApiFacade = require('*/cartridge/scripts/worldline/direct/api/facade');
        var tokenData = worldlineApiFacade.getToken(token);
        if (tokenData.success !== true) {
            return;
        }

        var wallet = customer.getProfile().getWallet();
        var isCardPaymentInstrument = (orderPaymentInstrument.custom.worldlineDirectPaymentMethod === 'card');
        var paymentMethod = (isCardPaymentInstrument) ? WorldlineDirectConstants.PAYMENT_METHOD_CARD : WorldlineDirectConstants.PAYMENT_METHOD_REDIRECT;

        Transaction.wrap(function () {
            var storedPaymentInstrument = wallet.createPaymentInstrument(paymentMethod);

            storedPaymentInstrument.custom.worldlineDirectPaymentProductID = tokenData.paymentProductId;
            storedPaymentInstrument.custom.worldlineDirectPaymentProductName = orderPaymentInstrument.custom.worldlineDirectPaymentProductName;
            storedPaymentInstrument.custom.worldlineDirectPaymentMethod = orderPaymentInstrument.custom.worldlineDirectPaymentMethod;

            var expirationMonth = parseInt(tokenData.card.data.cardWithoutCvv.expiryDate.substr(0, 2), 10);
            var expirationYear = parseInt(tokenData.card.data.cardWithoutCvv.expiryDate.substr(2, 2), 10);

            if (tokenData.card) {
                storedPaymentInstrument.setCreditCardType(
                    orderPaymentInstrument.getCreditCardType()
                );
                storedPaymentInstrument.setCreditCardExpirationMonth(expirationMonth);
                storedPaymentInstrument.setCreditCardExpirationYear(expirationYear);
                storedPaymentInstrument.setCreditCardHolder(tokenData.card.data.cardWithoutCvv.cardholderName);
                storedPaymentInstrument.custom.worldlineDirectCreditCardAlias = tokenData.card.alias;
            }

            storedPaymentInstrument.setCreditCardToken(token);
        });
    }
}

/**
 * Updates the Worldline-related statuses of an order.
 *
 * @param {dw.order.Order} order The order to be updated
 * @param {string} transactionStatus The Worldline status returned by the API
 * @param {Object} transactionStatusOutput A statusOutput JSON object returned by the API
 * @param {string} transactionStatusCategory A status category returned by the API
 */
function updatePaymentTransaction(order, transactionStatus, transactionStatusOutput, transactionStatusCategory) {
    const Transaction = require('dw/system/Transaction');

    Transaction.wrap(function () {
        order.custom.worldlineDirectStatus = transactionStatus;
        order.custom.worldlineDirectStatusCode = transactionStatusOutput.statusCode;
        order.custom.worldlineDirectIsAuthorized = transactionStatusOutput.isAuthorized;
        order.custom.worldlineDirectIsCancellable = transactionStatusOutput.isCancellable;
        order.custom.worldlineDirectIsRefundable = transactionStatusOutput.isRefundable;

        if (transactionStatusCategory !== null) {
            order.custom.worldlineDirectStatusCategory = transactionStatusCategory;
        }
    });
}

/**
 * Return worldline order payment instrument
 *
 * @param {dw.order.LineItemCtnr} basket - Basket
 * @returns {dw.order.OrderPaymentInstrument} payment instrument with id worldline
 */
function getWorldlinePaymentInstrument(basket) {
    var paymentInstruments = basket.getPaymentInstruments();

    for (let i = 0; i < paymentInstruments.length; i++) {
        var paymentInstrument = paymentInstruments[i];
        if (!empty(paymentInstrument.custom.worldlineDirectPaymentProductID)) {
            return paymentInstrument;
        }
    }

    return null;
}

/**
 * Processes orders that have a pending payment or a payment in unknown status.
 *
 * @param {dw.order.Order} order The order to be processed
 */
function processUnconfirmedOrder(order) {
    const Transaction = require('dw/system/Transaction');
    const OrderMgr = require('dw/order/OrderMgr');
    const Order = require('dw/order/Order');
    const worldlineApiFacade = require('*/cartridge/scripts/worldline/direct/api/facade');

    var paymentInstrument = getWorldlinePaymentInstrument(order);
    var paymentTransaction = paymentInstrument.getPaymentTransaction();
    var paymentProcessor = paymentTransaction.getPaymentProcessor();

    var paymentAPIResponse = null;
    var apiStatusOutput = null;
    var apiStatus = null;
    var transactionID = null;
    if (paymentProcessor.ID === WorldlineDirectConstants.PAYMENT_PROCESSOR_CREDIT || paymentProcessor.ID === WorldlineDirectConstants.PAYMENT_PROCESSOR_CREDIT_REDIRECT) {
        transactionID = paymentTransaction.getTransactionID();
        paymentAPIResponse = worldlineApiFacade.getPayment(transactionID);

        if (paymentAPIResponse.success === true) {
            apiStatusOutput = paymentAPIResponse.paymentOutput.statusOutput;
            apiStatus = paymentAPIResponse.paymentOutput.status;
        }
    } else if (paymentProcessor.ID === WorldlineDirectConstants.PAYMENT_PROCESSOR_REDIRECT) {
        transactionID = order.custom.worldlineDirectTransactionID;
        paymentAPIResponse = worldlineApiFacade.getHostedCheckout(transactionID);

        if (paymentAPIResponse.success === true) {
            apiStatusOutput = paymentAPIResponse.createdPaymentOutput.payment.statusOutput;
            apiStatus = paymentAPIResponse.createdPaymentOutput.payment.status;
        }
    }

    if (paymentAPIResponse && paymentAPIResponse.success === true) {
        if (WorldlineDirectConstants.REJECTED_PAYMENT_STATUSES.indexOf(apiStatus) > -1) {
            updatePaymentTransaction(order, apiStatus, apiStatusOutput, WorldlineDirectConstants.REJECTED_PAYMENT_STATUS_CATEGORY);

            Transaction.wrap(function () {
                OrderMgr.cancelOrder(order);
            });
        } else if (WorldlineDirectConstants.SUCCESSFUL_PAYMENT_STATUSES.indexOf(apiStatus) > -1) {
            updatePaymentTransaction(order, apiStatus, apiStatusOutput, WorldlineDirectConstants.AUTHORIZED_PAYMENT_STATUS_CATEGORY);

            Transaction.wrap(function () {
                order.setConfirmationStatus(Order.CONFIRMATION_STATUS_CONFIRMED);
                order.setExportStatus(Order.EXPORT_STATUS_READY);
            });
        } else if (WorldlineDirectConstants.COMPLETED_PAYMENT_STATUSES.indexOf(apiStatus) > -1) {
            updatePaymentTransaction(order, apiStatus, apiStatusOutput, WorldlineDirectConstants.COMPLETED_PAYMENT_STATUS_CATEGORY);

            Transaction.wrap(function () {
                order.setConfirmationStatus(Order.CONFIRMATION_STATUS_CONFIRMED);
                order.setExportStatus(Order.EXPORT_STATUS_READY);
                order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
            });
        }
    }
}

/**
 * Uses Worldline's API to verify is all payments have been successfully captured.
 *
 * @param {dw.order.PaymentTransaction} paymentTransaction The payment transaction, associated with the Worldline's payment instrument
 * @returns {boolean} Whether all payments have been captured
 */
function allPaymentsAreCaptured(paymentTransaction) {
    const worldlineApiFacade = require('*/cartridge/scripts/worldline/direct/api/facade');

    var capturesResponse = worldlineApiFacade.getPaymentCaptures(paymentTransaction.getTransactionID());
    if (capturesResponse.success !== true) {
        return false;
    }

    var originalAmount = paymentTransaction.amount.value;
    var currencyCode = paymentTransaction.amount.currencyCode;
    var capturedAmount = 0;

    for (let i = 0; i < capturesResponse.captures.length; i++) {
        var paymentCapture = capturesResponse.captures[i];
        if (paymentCapture.status === WorldlineDirectConstants.CAPTURED_PAYMENT_STATUS) {
            capturedAmount += convertWorldlineAmountToMoney(paymentCapture.captureOutput.amountOfMoney.amount, currencyCode).value;
        }
    }

    // we may be looking at the original transaction that has changed its own status... 
    if (capturedAmount === 0) {
        var transactionResponse = worldlineApiFacade.getPayment(paymentTransaction.getTransactionID());
        if (transactionResponse.success !== true) {
            return false;
        }

        if (transactionResponse.status === WorldlineDirectConstants.CAPTURED_PAYMENT_STATUS) {
            capturedAmount = convertWorldlineAmountToMoney(transactionResponse.paymentOutput.acquiredAmount.amount, transactionResponse.paymentOutput.acquiredAmount.currencyCode).value;
        }
    }

    return capturedAmount >= originalAmount;    // depending on the configuration in Worldline, it may be possible to capture a higher amount than the original transaction
}

/**
 * This function should be called everytime a capture is performed. It checks if this was the last capture and if so, it finalizes the order.
 *
 * @param {dw.order.Order} order The associated order
 * @param {dw.order.PaymentInstrument} worldlinePaymentInstrument The Worldline payment instrument, associated with the order
 * @param {string} worldlineStatus The payment status, taken from the webhook or the API response
 * @param {Object} worldlineStatusOutput the statusOutput object, taken from the webhook or the API response
 */
function handlePaymentCapture(order, worldlinePaymentInstrument, worldlineStatus, worldlineStatusOutput) {
    const Transaction = require('dw/system/Transaction');
    const Order = require('dw/order/Order');

    if (WorldlineDirectConstants.VALID_CAPTURE_STATUSES.indexOf(worldlineStatus) > -1) {
        Transaction.wrap(function () {
            order.custom.worldlineDirectHasCaptures = true;
        });
    }

    if (worldlineStatus === WorldlineDirectConstants.CAPTURED_PAYMENT_STATUS) {
        // payment is successfully captured (it's not pending), verify if this was the last pending capture, if so - mark the order as paid
        if (allPaymentsAreCaptured(worldlinePaymentInstrument.getPaymentTransaction())) {
            Transaction.wrap(function () {
                order.custom.worldlineDirectStatus = worldlineStatus;
                order.custom.worldlineDirectStatusCode = worldlineStatusOutput.statusCode;
                order.custom.worldlineDirectStatusCategory = WorldlineDirectConstants.COMPLETED_PAYMENT_STATUS_CATEGORY;

                order.setExportStatus(Order.EXPORT_STATUS_READY);
                order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);

                order.trackOrderChange("Order payment status changed to PAID.");

                // isAuthorized, isCancellable and isRefundable are sometimes not available in the capture response JSON and in the first webhook with type "payment.capture_requested".
                // A later webhook with type "payment.captured" has them.
                if (worldlineStatusOutput.isCancellable !== undefined) {
                    order.custom.worldlineDirectIsCancellable = worldlineStatusOutput.isCancellable;
                }
                if (worldlineStatusOutput.isAuthorized !== undefined) {
                    order.custom.worldlineDirectIsAuthorized = worldlineStatusOutput.isAuthorized;
                }
                if (worldlineStatusOutput.isRefundable !== undefined) {
                    order.custom.worldlineDirectIsRefundable = worldlineStatusOutput.isRefundable;
                }
            });
        }
    }
}


/**
 * Calculates the captured amount
 *
 * @param {dw.order.Order} order the referenced order
 * @param {Array} paymentCaptures a JSON array containing the captures from the API response
 * @param {Object} originalTransactionAmount the amount of the original transaction
 * @returns {integer} the captured amount
 */
function getCapturedAmount(order, paymentCaptures, originalTransactionAmount) {
    var amount = 0;
    for (let i = 0; i < paymentCaptures.length; i++) {
        var paymentCapture = paymentCaptures[i];
        if (WorldlineDirectConstants.VALID_CAPTURE_STATUSES.indexOf(paymentCapture.status) > -1) {
            amount += paymentCapture.captureOutput.acquiredAmount.amount;
        }
    }

    if (amount === 0 && order.custom.worldlineDirectStatusCategory.value === WorldlineDirectConstants.COMPLETED_PAYMENT_STATUS_CATEGORY) {
        amount = originalTransactionAmount;
    }

    return amount;
}

/**
 * Calculates the captured amount
 *
 * @param {dw.order.Order} order the referenced order
 * @param {Array} paymentCaptures a JSON array containing the captures from the API response
 * @param {Object} originalTransactionAmount the amount of the original transaction
 * @returns {integer} the capturable amount
 */
function getCapturableAmount(order, paymentCaptures, originalTransactionAmount) {
    var amount = 0;
    for (let i = 0; i < paymentCaptures.length; i++) {
        var paymentCapture = paymentCaptures[i];
        if (WorldlineDirectConstants.VALID_CAPTURE_STATUSES.indexOf(paymentCapture.status) > -1) {
            amount += paymentCapture.captureOutput.amountOfMoney.amount;
        }
    }

    if (amount === 0 && order.custom.worldlineDirectStatusCategory.value === WorldlineDirectConstants.COMPLETED_PAYMENT_STATUS_CATEGORY) {
        amount = originalTransactionAmount;
    }

    let capturableAmount = originalTransactionAmount - amount;

    return capturableAmount < 0 ? 0 : capturableAmount;
}

/**
 * Calculates the refunded amount
 *
 * @param {Array} paymentRefunds a JSON array containing the refunds from the API response
 * @returns {integer} the refunded amount
 */
function getRefundedAmount(paymentRefunds) {
    var amount = 0;
    for (let i = 0; i < paymentRefunds.length; i++) {
        var paymentRefund = paymentRefunds[i];
        if (WorldlineDirectConstants.VALID_REFUND_STATUSES.indexOf(paymentRefund.status) > -1) {
            amount += paymentRefund.refundOutput.amountOfMoney.amount;
        }
    }

    return amount;
}

/**
 * Appends the selected payment method to current page's viewData.
 * @param {Object} res Global response object
 */
function appendPaymentDetailsToResponseViewData(res) {
    const worldlineDirectConstants = require('*/cartridge/scripts/worldline/direct/constants');
    var viewData = res.getViewData();

    var selectedPaymentMethod = viewData.order && viewData.order.billing.payment.applicablePaymentMethods && viewData.order.billing.payment.applicablePaymentMethods.length > 0
        ? viewData.order.billing.payment.applicablePaymentMethods[0].ID
        : null;

    if (viewData.order && viewData.order.billing.payment.selectedPaymentInstruments.length) {
        var selectedPaymentInstrument = viewData.order.billing.payment.selectedPaymentInstruments[0];
        selectedPaymentMethod = selectedPaymentInstrument.paymentMethod;

        if (selectedPaymentMethod === worldlineDirectConstants.PAYMENT_METHOD_REDIRECT) {
            if ((empty(selectedPaymentInstrument.paymentProductID) || selectedPaymentInstrument.paymentProductID == 'null') && dw.system.Site.getCurrent().getCustomPreferenceValue('worldlineDirectHCPGroupCards')) {
                selectedPaymentMethod = worldlineDirectConstants.PAYMENT_METHOD_REDIRECT + '__CARDS';
            } else {
                selectedPaymentMethod = worldlineDirectConstants.PAYMENT_METHOD_REDIRECT + '__' + selectedPaymentInstrument.paymentProductID;
            }
        } else if (selectedPaymentMethod === worldlineDirectConstants.PAYMENT_METHOD_DIRECTDEBIT) {
            selectedPaymentMethod = worldlineDirectConstants.PAYMENT_METHOD_DIRECTDEBIT + '__' + selectedPaymentInstrument.paymentProductID;
        }
    }

    viewData.worldlineDirectConstants = worldlineDirectConstants;
    viewData.selectedPaymentMethod = selectedPaymentMethod;

    res.setViewData(viewData);
}

function convertMoneyToWorldlineAmount(money) {
    return convertMoneyAmountToWorldlineAmount(money.value, money.currencyCode);
}

function convertMoneyAmountToWorldlineAmount(amount, currencyCode) {
    const Currency = require('dw/util/Currency');

    var currency = Currency.getCurrency(currencyCode);
    var currencyFractionDigits = currency.getDefaultFractionDigits();

    return amount * Math.pow(10, currencyFractionDigits);
}

function convertWorldlineAmountToMoney(amount, currencyCode) {
    const Currency = require('dw/util/Currency');
    const Money = require('dw/value/Money');

    var currency = Currency.getCurrency(currencyCode);
    var currencyFractionDigits = currency.getDefaultFractionDigits();

    return new Money(amount / Math.pow(10, currencyFractionDigits), currencyCode);
}

function validateAmountPaid(order, paymentOutput) {
    const OrderMgr = require('dw/order/OrderMgr');
    const Order = require('dw/order/Order');
    const Resource = require('dw/web/Resource');
    const Transaction = require('dw/system/Transaction');

    var amountPaid = convertWorldlineAmountToMoney(paymentOutput.acquiredAmount.amount, paymentOutput.acquiredAmount.currencyCode);

    if ('surchargeSpecificOutput' in paymentOutput) {
        var surchargeAmount = convertWorldlineAmountToMoney(paymentOutput.surchargeSpecificOutput.surchargeAmount.amount, paymentOutput.surchargeSpecificOutput.surchargeAmount.currencyCode);

        Transaction.wrap(function () {
            order.custom.worldlineDirectSurchargeAmount = surchargeAmount.value;
        });
    }

    if ([WorldlineDirectConstants.AUTHORIZED_PAYMENT_STATUS_CATEGORY, WorldlineDirectConstants.UNKNOWN_PAYMENT_STATUS_CATEGORY].indexOf(order.custom.worldlineDirectStatusCategory.value) < 0 && amountPaid.compareTo(order.getTotalGrossPrice()) < 0) {
        Transaction.wrap(function () {
            //order.custom.worldlineDirectStatusCategory = WorldlineDirectConstants.REJECTED_PAYMENT_STATUS_CATEGORY;
            order.trackOrderChange('Order failed due to amount paid being less than order total.');
            OrderMgr.failOrder(order, true);
        });

        session.privacy.worldlineDirectError = Resource.msg('error.payment.not.valid', 'worldlineDirect', null);
        throw new Error('error.payment.not.valid');
    }

    return true;
}

function standartiseTransactionId(tid) {
    let transactionId = tid;
    
    if (WorldlineDirectConstants.SURCHARGE_TRANSACTION_ID_REGEXP.test(transactionId)) {
        let matches = transactionId.toString().match(WorldlineDirectConstants.SURCHARGE_TRANSACTION_ID_REGEXP);
        transactionId = matches[2];
    } else {
        transactionId = transactionId.split("_")[0];
    }

    return transactionId;
}

module.exports = {
    getCustomerCountryCode: getCustomerCountryCode,
    getWorldlinePaymentInstrument: getWorldlinePaymentInstrument,
    isHostedTokenizationEnabled: isHostedTokenizationEnabled,
    handlePaymentStatus: handlePaymentStatus,
    savePaymentInstrumentToWallet: savePaymentInstrumentToWallet,
    getWalletPaymentIntsrumentTokensByPaymentProductId: getWalletPaymentIntsrumentTokensByPaymentProductId,
    getWalletPaymentIntsrumentTokensByPaymentMethod: getWalletPaymentIntsrumentTokensByPaymentMethod,
    handleOrderPlacement: handleOrderPlacement,
    updatePaymentTransaction: updatePaymentTransaction,
    handlePaymentCapture: handlePaymentCapture,
    processUnconfirmedOrder: processUnconfirmedOrder,
    getCapturedAmount: getCapturedAmount,
    getCapturableAmount: getCapturableAmount,
    getRefundedAmount: getRefundedAmount,
    appendPaymentDetailsToResponseViewData: appendPaymentDetailsToResponseViewData,
    isHCPGroupCardsEnabled:isHCPGroupCardsEnabled,
    convertMoneyToWorldlineAmount:convertMoneyToWorldlineAmount,
    convertMoneyAmountToWorldlineAmount:convertMoneyAmountToWorldlineAmount,
    convertWorldlineAmountToMoney:convertWorldlineAmountToMoney,
    validateAmountPaid: validateAmountPaid,
    standartiseTransactionId: standartiseTransactionId
};
