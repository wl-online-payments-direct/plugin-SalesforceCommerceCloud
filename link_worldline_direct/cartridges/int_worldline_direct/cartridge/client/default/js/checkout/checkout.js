'use strict';

var billingHelpers = require('./billing');
var summaryHelpers = require('./summary');
var base = require('base/checkout/checkout');

[billingHelpers, summaryHelpers].forEach(function (library) {
    Object.keys(library).forEach(function (item) {
        if (typeof library[item] === 'object') {
            exports[item] = $.extend({}, exports[item], library[item]);
        } else {
            exports[item] = library[item];
        }
    });
});

module.exports = base;
