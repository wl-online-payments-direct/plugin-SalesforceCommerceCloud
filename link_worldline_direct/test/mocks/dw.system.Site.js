'use strict';

module.exports = { 
    getCurrent() {
        return {
            getCustomPreferenceValue (attributeId) {
                const enumFields = ['worldlineDirectOperationCode'];

                if (enumFields.indexOf(attributeId) > -1) {
                    return {
                        getValue() {
                            return attributeId + '-VALUE';
                        }
                    }
                }

                return attributeId + "-VALUE";
            }
        }
    }
};
