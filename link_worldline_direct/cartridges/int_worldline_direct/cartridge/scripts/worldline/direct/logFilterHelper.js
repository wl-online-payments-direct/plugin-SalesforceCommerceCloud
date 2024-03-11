const System = require('dw/system/System');
const WorldlineDirectConstants = require('*/cartridge/scripts/worldline/direct/constants');

/**
 * Loops through a JSON object and executes a function for each of its elements
 * @param {*} o The JSON Object
 * @param {*} func The function to be called on each element
 */
function traverse(o, func) {
    Object.keys(o).forEach(function (i) {
        func.apply(this, [o, i, o[i]]);
        if (o[i] !== null && typeof o[i] === "object") {
            traverse(o[i], func);
        }
    });
}

/**
 * Filters a string value inside a JSON object
 * @param {*} obj The parent JSON object that holds this element
 * @param {*} key The name of the element inside the parent JSON object
 * @param {*} value the value to be filtered
 */
function filterChildStrings(obj, key, value) {
    if (typeof value === "string") {
        obj[key] = "__PROVIDED__";
    }
}

/**
 * Removes sensitive personal information from a JSON object
 * @param {*} obj The parent JSON object that holds this element
 * @param {*} key The name of the element inside the parent JSON object
 * @param {*} value the value to be filtered
 */
function filterElements(obj, key, value) {
    if (typeof value === "string") {
        if (WorldlineDirectConstants.LOG_FILTER_KEY_NAMES.indexOf(key.toUpperCase()) > -1) {
            obj[key] = "__PROVIDED__";
        }
    } else if (value !== null && typeof value === "object") {
        if (WorldlineDirectConstants.LOG_FILTER_OBJECT_NAMES.indexOf(key.toUpperCase()) > -1) {
            traverse(obj[key], filterChildStrings);
        }
    }
}

/**
 * Removes sensitive personal information from a JSON string on production instances
 * @param {*} jsonString The string to be filtered
 * @returns {string} the filtered string
 */
function filterJSONString(jsonString) {
    if (System.getInstanceType() !== System.PRODUCTION_SYSTEM) {
        return jsonString;
    }

    if (typeof jsonString === "string") {
        try {
            var json = JSON.parse(jsonString);
            traverse(json, filterElements);

            return JSON.stringify(json);
        } catch (e) {
            // this is a string, filter for things like "Webservice Communication: worldline.https.direct.refarchglobal (DELETE https://.../tokens/...)"
            jsonString = jsonString.replace(/(\/tokens\/|\/token\/).*/g, "$1__PROVIDED__");
        }
    }


    return jsonString;
}

exports.filterJSONString = filterJSONString;
