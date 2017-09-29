'use strict';

/**
 * Encapsulates image retrieval.
 *
 * @abstract
 */
class Trigger {

    // noinspection JSUnusedGlobalSymbols, LocalVariableNamingConventionJS
    /**
     * @readonly
     * @enum {String}
     */
    static get TriggerType () {
        return {
        Unknown: 'Unknown',
        Mouse: 'Mouse',
        Text: 'Text',
        Keyboard: 'Keyboard',
      };
    }

    constructor() {
        if (new.target === Trigger) {
            throw new TypeError("Can not construct `Trigger` instance directly, should be used implementation!");
        }
    }

    // noinspection JSMethodCanBeStatic, JSUnusedGlobalSymbols
    /**
     * @abstract
     * @return {Trigger.TriggerType}
     */
    getTriggerType() {
        throw new TypeError('The method `getTriggerType` from `Trigger` should be implemented!');
    }
}

Object.freeze(Trigger.TriggerType);
module.exports = Trigger;
