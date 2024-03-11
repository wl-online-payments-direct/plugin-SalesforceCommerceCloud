
/** *******************************************************************************
*
* Description:     Class for Worldline HTTP Service,
*
/*********************************************************************************/

const LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
const logFilterHelper = require('*/cartridge/scripts/worldline/direct/logFilterHelper');


/**
 *  HTTP Services
 *  @param {string} siteID like RefArch
 *  @returns {dw.svc.Service} The service
 */
var worldlineService = function (siteID) {
    return LocalServiceRegistry.createService("worldline.https.direct." + siteID.toLowerCase(), {
        createRequest: function (svc, params) {
            svc.setAuthentication("NONE");
            svc.setRequestMethod(params.method);

            params.headers.keySet().toArray().forEach(function (key) {
                svc.addHeader(key, params.headers.get(key));
            });

            svc.setURL(params.url);

            if (params.method == 'POST' || params.method == 'PUT') {
                return JSON.stringify(params.body);
            }

            return null;
        },
        parseResponse: function (svc, client) {
            try {
                return JSON.parse(client.text);
            } catch (e) {
                throw new Error("Server returned invalid json: [ " + client.text + " ].", svc);
            }
        },
        filterLogMessage: function (msg) {
            return logFilterHelper.filterJSONString(msg);
        }
    });
};

module.exports = worldlineService;
