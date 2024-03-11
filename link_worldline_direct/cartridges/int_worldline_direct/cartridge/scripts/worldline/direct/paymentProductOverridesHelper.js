/**
 * @typedef {{
 *  id: number,
 *  name: string,
 *  isShown: boolean
 * }} PaymentProductJSON The payment product JSON data
 *
 * @typedef { dw.object.CustomObject<{ entriesJSON: string }> } PaymentProductsCustomObject The custom object definition that is used to store the payment products.
 *
 * @typedef {{
 *  customObject: PaymentProductsCustomObject | null,
 *  entriesJSON: { [id: string]: Array } | null
 * }} LocalCache The payment product JSON data
 */

/** @type {LocalCache} The local cache that allows these functions to be called multiple times per request, without querying the database. */
var objectCache = {
    customObject: null,
    entriesJSON: null
};

const Logger = require('dw/system/Logger');
const logger = Logger.getRootLogger();

/**
 * @returns {LocalCache} The custom object and JSON entries, either from the local cache or by querying the database.
 */
function getCustomObjectData() {
    if (objectCache.customObject === null || objectCache.entriesJSON === null) {
        const CustomObjectMgr = require('dw/object/CustomObjectMgr');

        /** @type { PaymentProductsCustomObject | null } **/
        const co = CustomObjectMgr.queryCustomObject('WorldlineDirectPaymentProducts', '');

        if (!co) {
            return {
                customObject: null,
                entriesJSON: null
            };
        }

        let entriesJSON = null;
        try {
            entriesJSON = co !== null && typeof co.custom.entriesJSON === "string" ? JSON.parse(co.custom.entriesJSON) : null;

            objectCache.customObject = co;
            objectCache.entriesJSON = entriesJSON;
        } catch (e) {
            logger.error("[paymentProductOverridesHelper::getCustomObjectData()] Error parsing JSON: " + JSON.stringify(e));

            return {
                customObject: null,
                entriesJSON: null
            };
        }
    }

    return objectCache;
}


/**
 * Gets a raw JSON entry and transforms it into an object.
 * In order to save space, the JSON entries are not stored as objects, but as raw arrays.
 *
 * @param {string | number} id ID of the payment product
 * @param {Array} jsonEntry An array containing the product data: 0 -> name, 1 -> isShown
 * @returns {PaymentProductJSON} A JSON object with the product data
 */
function jsonEntryToObject(id, jsonEntry) {
    return {
        id: typeof id !== "number" ? parseInt(id, 10) : id,
        name: jsonEntry[0],
        isShown: jsonEntry[1]
    };
}

/**
 * Gets an array of all payment products from the custom object.
 * Uses a local cache, so it can be called multiple times per request.
 *
 * @returns {dw.util.ArrayList<PaymentProductJSON>} The list of all products
 */
function getAllPaymentProducts() {
    const ArrayList = require('dw/util/ArrayList');
    const entriesJSON = getCustomObjectData().entriesJSON;
    var worldlineDirectPaymentProducts = new ArrayList();
    if (entriesJSON !== null && typeof entriesJSON === "object") {
        const keys = Object.keys(entriesJSON);
        for (let i = 0; i < keys.length; i++) {
            let id = parseInt(keys[i], 10);
            let entry = entriesJSON[id];

            worldlineDirectPaymentProducts.push(jsonEntryToObject(id, entry));
        }
    }

    return worldlineDirectPaymentProducts;
}

/**
 * Gets a payment product JSON
 *
 * @param {number} id The id of the payment product
 * @returns {PaymentProductJSON|null} The JSON of the payment product or null if not found
 */
function getPaymentProduct(id) {
    const entriesJSON = getCustomObjectData().entriesJSON;
    return entriesJSON && entriesJSON[id] ? jsonEntryToObject(id, entriesJSON[id]) : null;
}

/**
 * Saves a payment product into the custom object
 *
 * @param {PaymentProductJSON} paymentProduct A JSON object holding the product data
 * @returns {boolean} Whether the request succeeded or not
 */
function savePaymentProduct(paymentProduct) {
    const Transaction = require('dw/system/Transaction');

    const customObjectData = getCustomObjectData();
    const entriesJSON = customObjectData.entriesJSON;
    const customObject = customObjectData.customObject;
    if (!entriesJSON || !customObject) {
        return false;
    }

    entriesJSON[paymentProduct.id] = [paymentProduct.name, paymentProduct.isShown];

    Transaction.wrap(function () {
        customObject.custom.entriesJSON = JSON.stringify(entriesJSON);
    });

    return true;
}

/**
 * Deletes a payment product from the custom object.
 *
 * @param {string} id The id of the payment product
 * @returns {boolean} Whether the request succeeded or not
 */
function deletePaymentProduct(id) {
    const Transaction = require('dw/system/Transaction');

    const customObjectData = getCustomObjectData();
    const entriesJSON = customObjectData.entriesJSON;
    const customObject = customObjectData.customObject;
    if (!entriesJSON || !customObject) {
        return false;
    }

    if (!entriesJSON[id]) {
        return false;
    }

    delete entriesJSON[id];
    Transaction.wrap(function () {
        customObject.custom.entriesJSON = JSON.stringify(entriesJSON);
    });

    return true;
}

exports.getAllPaymentProducts = getAllPaymentProducts;
exports.getPaymentProduct = getPaymentProduct;
exports.savePaymentProduct = savePaymentProduct;
exports.deletePaymentProduct = deletePaymentProduct;
