'use strict';

const assert = require('chai').assert;
const axios = require('axios');
const config = require('./it.config');

describe('Worldline Checkout', function () {
    this.timeout(25000);

    describe('Hosted Tokenization Session', function () {
        it('should be able to create a valid hosted tokenization session and get an iFrame URL', async () => {
            const response = await axios({
                method: "get",
                url: config.htpSessionURL,
                validateStatus: (status) => true   // make sure axios doesn't throw when status != 200
            });
    
            assert.equal(response.status, 200);
            assert.equal(response.data.error, false);
            assert.isNotNull(response.data.redirectUrl);
        });
    });
});