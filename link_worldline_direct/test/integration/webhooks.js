'use strict';

const assert = require('chai').assert;
const axios = require('axios');
const config = require('./it.config');
const crypto = require('crypto');

const sendWebhookRequest = async (requestBody, validSignature) => {
    const axiosParams = {
        method: "post",
        url: config.webhooksControllerURL,
        data: requestBody,
        validateStatus: (status) => true   // make sure axios doesn't throw when status != 200
    };

    if (validSignature === true) {
        const signature = crypto.createHmac('sha256', config.webhooksKeySecret).update(JSON.stringify(requestBody)).digest('base64');

        axiosParams.headers = {
            'x-gcs-keyid': config.webhooksKeyId,
            'x-gcs-signature': signature
        };
    }

    return await axios(axiosParams);
};

describe('Worldline Webhooks', function () {
    this.timeout(25000);

    before(function () {
        assert.isString(config.webhooksKeyId, 'Please specify "webhooksKeyId" in your dw.json');
        assert.isString(config.webhooksKeySecret, 'Please specify "webhooksKeySecret" in your dw.json');
    });

    it('should reply with status 400 when the signature is not valid', async () => {
        const requestBody = {
            sampleRequestBody: true
        };
        const response = await sendWebhookRequest(requestBody, false);

        assert.equal(response.status, 400);
        const bodyAsJson = response.data;
        assert.isFalse(bodyAsJson.success);
    });

    it('should reply with status 400 when the signature is valid, but the body has no "type" field.', async () => {
        const requestBody = {
            sampleRequestBody: true
        };
        const response = await sendWebhookRequest(requestBody, true);

        assert.equal(response.status, 400);
        const bodyAsJson = response.data;
        assert.isFalse(bodyAsJson.success);
    });

    it('should reply with status 201 when the signature is valid and body is valid', async () => {
        const hookId = crypto.createHash('md5').update((new Date()).getTime().toString()).digest("hex");

        const requestBody = {
            "apiVersion": "v1",
            "created": new Date(),
            "id": hookId,
            "merchantId": "samplemerchantid",
            "payment": {
                "paymentOutput": {
                    "amountOfMoney": {
                        "amount": 106,
                        "currencyCode": "EUR"
                    },
                    "references": {
                        "merchantReference": "00000000000",
                        "merchantParameters": "{\"ot\":\"token\"}"
                    },
                    "cardPaymentMethodSpecificOutput": {
                        "paymentProductId": 2,
                        "authorisationCode": "test123",
                        "card": {
                            "cardNumber": "***********1111",
                            "expiryDate": "0327"
                        },
                        "fraudResults": {
                            "fraudServiceResult": "no-advice",
                            "avsResult": "0",
                            "cvvResult": "0"
                        },
                        "threeDSecureResults": {
                            "eci": "7"
                        }
                    },
                    "paymentMethod": "card"
                },
                "status": "CAPTURE_REQUESTED",
                "statusOutput": {
                    "statusCategory": "PENDING_CONNECT_OR_3RD_PARTY",
                    "statusCode": 91
                },
                "id": "3119006932_11"
            },
            "type": "payment.capture_requested",
            "containsAnOperation": true
        };
        const response = await sendWebhookRequest(requestBody, true);

        assert.equal(response.status, 201);
        const bodyAsJson = response.data;
        assert.isTrue(bodyAsJson.success);
    });
});