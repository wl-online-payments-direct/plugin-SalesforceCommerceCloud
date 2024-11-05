'use strict';

let Constants = {};

Constants.OPERATION_CODE_SALE                   = 'SALE';

Constants.PAYMENT_URL_PREFIX                    = 'https://payment.';

// string elements with these names will have their values filtered from the logs
Constants.LOG_FILTER_KEY_NAMES = [
    "ID", "FIRSTNAME", "LASTNAME", "SURNAME", "MIDNAME", "EMAIL", "EMAILADDRESS", "PHONE", "PHONENUMBER", "IP", "IPADDRESS", "MERCHANTCUSTOMERID", "TOKEN", "TOKENS", "USERAGENT",
    "CARDHOLDERNAME", "CARDNUMBER", "EXPIRYDATE", "XID", "BIN", "AUTHORISATIONCODE",
    "REDIRECTURL", "PARTIALREDIRECTURL", "RETURNMAC"
];

// objects with these names will have all of their string elements filtered from the logs
Constants.LOG_FILTER_OBJECT_NAMES = ["ADDRESS", "SHIPPINGADDRESS", "BILLINGADDRESS", "PERSONALINFORMATION", "CONTACTDETAILS", "CARD", "EXTERNALTOKENLINKED"];

// SFCC Payment method constants
Constants.PAYMENT_METHOD_PREFIX                 = 'WORLDLINE_DIRECT';
Constants.PAYMENT_METHOD_CARD                   = Constants.PAYMENT_METHOD_PREFIX + '_CARD';
Constants.PAYMENT_METHOD_REDIRECT               = Constants.PAYMENT_METHOD_PREFIX + '_REDIRECT';
Constants.PAYMENT_METHOD_CREDIT_REDIRECT        = Constants.PAYMENT_METHOD_PREFIX + '_CREDIT_REDIRECT';
Constants.PAYMENT_METHOD_DIRECTDEBIT            = Constants.PAYMENT_METHOD_PREFIX + '_DIRECTDEBIT';

Constants.PAYMENT_PROCESSOR_PREFIX             = 'WORLDLINE_DIRECT';
Constants.PAYMENT_PROCESSOR_CREDIT             = Constants.PAYMENT_PROCESSOR_PREFIX + '_CREDIT';
Constants.PAYMENT_PROCESSOR_REDIRECT           = Constants.PAYMENT_PROCESSOR_PREFIX + '_REDIRECT';
Constants.PAYMENT_PROCESSOR_CREDIT_REDIRECT    = Constants.PAYMENT_PROCESSOR_PREFIX + '_CREDIT_REDIRECT';
Constants.PAYMENT_PROCESSOR_DIRECTDEBIT        = Constants.PAYMENT_PROCESSOR_PREFIX + '_DIRECTDEBIT';

// Worldline-Direct Payment Product Constants
Constants.PAYMENT_PRODUCT_GROUP_CARD            = 'card';
Constants.PAYMENT_PRODUCT_GROUP_REDIRECT        = 'redirect';
Constants.PAYMENT_PRODUCT_GROUP_MOBILE          = 'mobile';
Constants.PAYMENT_PRODUCT_DIRECT_DEBIT          = 'directDebit';
Constants.PAYMENT_PRODUCT_BANCONTACT_ID         = 3012;
Constants.PAYMENT_PRODUCT_IDEAL_ID              = 809;
Constants.PAYMENT_PRODUCT_APPLE_PAY_ID          = 302;
Constants.PAYMENT_PRODUCT_INTERSOLVE_ID         = 5700;
Constants.PAYMENT_PRODUCT_SEPA_DIRECT_DEBIT_ID  = 771;

// Klarna and Oney require us to send the line item prices with the API request. They will be hidden if the worldlineDirectCheckoutSendLineItemPrices site preference is not checked
Constants.PAYMENT_PRODUCTS_WITH_LINEITEM_PRICES = [3301, 3302, 5110, 5600];

Constants.CHECKOUT_TYPE_HOSTED_PAGE             = 1;
Constants.CHECKOUT_TYPE_TOKENIZATION            = 2;

Constants.HOSTED_CHECKOUT_RETURN_CONTROLLER     = 'WorldlineDirect-HCPReturn';
Constants.HOSTED_TOKENIZATION_RETURN_CONTROLLER = 'WorldlineDirect-HTPReturn';

Constants.REJECTED_PAYMENT_STATUS_CATEGORY      = 'REJECTED';
Constants.REJECTED_PAYMENT_STATUSES             = ['CREATED', 'CANCELLED', 'REJECTED', 'REJECTED_CAPTURE', 'PENDING_COMPLETION'];
Constants.UNKNOWN_PAYMENT_STATUS_CATEGORY       = 'PENDING';
Constants.UNKNOWN_PAYMENT_STATUSES              = ['REDIRECTED', 'PENDING_PAYMENT', 'AUTHORIZATION_REQUESTED', 'CAPTURE_REQUESTED'];
Constants.AUTHORIZED_PAYMENT_STATUS_CATEGORY    = 'AUTHORIZED';
Constants.SUCCESSFUL_PAYMENT_STATUSES           = ['PENDING_CAPTURE'];
Constants.CANCELLED_PAYMENT_STATUS_CATEGORY     = 'CANCELLED';
Constants.COMPLETED_PAYMENT_STATUS_CATEGORY     = 'COMPLETED';
Constants.CAPTURED_PAYMENT_STATUS               = 'CAPTURED';
Constants.COMPLETED_PAYMENT_STATUSES            = ['CAPTURED'];

Constants.ABANDONED_PAYMENT_STATUSES            = ['CREATED', 'REDIRECTED'];
Constants.VALID_CAPTURE_STATUSES                = ['CAPTURED', 'CAPTURE_REQUESTED'];
Constants.VALID_REFUND_STATUSES                 = ['REFUNDED', 'REFUND_REQUESTED'];
Constants.PENDING_CAPTURE_STATUSES              = ['CAPTURE_REQUESTED'];

Constants.TOKEN_CREATED                         = 'CREATED';
Constants.TOKEN_UPDATED                         = 'UPDATED';
Constants.TOKEN_UNCHANGED                       = 'UNCHANGED';

Constants.SURCHARGE_TRANSACTION_ID_REGEXP       = /(900000)(\d{10})(\d{3})/;

Constants.RECURRING_ORDERS_SUBSCRIPTION_STATUS_ACTIVE = 'active';
Constants.RECURRING_ORDERS_SUBSCRIPTION_STATUS_BLOCKED = 'blocked';
Constants.RECURRING_ORDERS_SUBSCRIPTION_STATUS_CANCELLED = 'cancelled';
Constants.RECURRING_ORDERS_SUBSCRIPTION_STATUS_COMPLETED = 'completed';
Constants.RECURRING_ORDERS_CREATED_BY_MERCHANT	= 'MIT';
Constants.RECURRING_ORDERS_CREATED_BY_CUSTOMER	= 'CIT';

module.exports = Constants;
/* eslint no-multi-spaces: "off" */
