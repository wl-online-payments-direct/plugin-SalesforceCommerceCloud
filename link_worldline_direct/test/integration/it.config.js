'use strict';

const getConfig = require('@tridnguyen/config');
const fs = require('fs');
const path = require('path');
const cwd = process.cwd();

function getDwJson() {
    if (fs.existsSync(path.join(cwd, 'dw.json'))) {
        return require(path.join(cwd, 'dw.json'));
    }
    return {};
}

const dwJson = getDwJson();

const baseUrl = 'https://' + global.baseUrl + '/on/demandware.store/Sites-RefArchGlobal-Site/en_NL';
const opts = Object.assign({}, getConfig({
    baseUrl: baseUrl,
    suite: '*',
    reporter: 'spec',
    timeout: 60000,
    locale: 'x_default',

    webhooksKeyId: dwJson.webhooksKeyId || null,
    webhooksKeySecret: dwJson.webhooksKeySecret || null,
    webhooksControllerURL: baseUrl + '/WorldlineDirect-Webhooks',
    htpSessionURL: baseUrl + '/WorldlineDirect-HTPSession'

}, './config.json'));

module.exports = opts;
