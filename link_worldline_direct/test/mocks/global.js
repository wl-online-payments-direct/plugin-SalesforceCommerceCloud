function empty(obj) {
    return (obj === null || obj === undefined || obj === '' || (typeof (obj) !== 'function' && obj.length !== undefined && obj.length === 0));
}

function SessionMock() {
    this.forms = {};

    this.currency = {
        currencyCode: 'USD'
    };

    this.privacy = {};

    this.getCurrency = function () {
        return this.currency;
    };

    this.setCurrency = function (currency) {
        this.currency = currency;
    };

    this.getCustomer = function () {
        return {
            ID: "111233",
            authenticated: true,
            profile: {
                customerNo: "CUSTOMER_NO"
            }
        };
    };
}

function RequestMock() {
    this.locale = 'locale';
    this.httpLocale = 'http locale';
    this.httpUserAgent = 'http user agent';
    this.httpRemoteAddress = 'http remote address';

    this.session = new SessionMock();

    this.getLocale = function () {
        return this.locale;
    };

    this.setLocale = function (locale) {
        this.locale = locale;
    };

    this.getSession = function () {
        return this.session;
    };

    this.getHttpHeaders = function () {
        return {
            get(headerName) {
                return headerName + "-VALUE";
            }
        }
    }
}

module.exports = {
    empty: empty,
    RequestMock: RequestMock,
    SessionMock: SessionMock
};
