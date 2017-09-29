'use strict';

const dateformat = require('dateformat');

/**
 * Collection of utility methods.
 */
class GeneralUtils {

    /**
     * @private
     */
    static get DATE_FORMAT_ISO8601 () {
      return "yyyy-mm-dd'T'HH:MM:ss'Z'";
    }

    /**
     * @private
     */
    static get DATE_FORMAT_RFC1123 () {
      return "dddd, dd mmm yyyy HH:MM:ss 'GMT'";
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * Concatenate the url to the suffix - making sure there are no double slashes
     *
     * @param {String} url - The left side of the URL.
     * @param {String} suffix - the right side.
     * @return {String} the URL
     **/
    static urlConcat(url, suffix) {
        let left = url;
        if (url.lastIndexOf("/") === (url.length - 1)) {
            left = url.slice(0, url.length - 1);
        }

        if (suffix.indexOf("/") === 0) {
            return left + suffix;
        }

        return left + "/" + suffix;
    };

    //noinspection JSUnusedGlobalSymbols
    /**
     * Convert object into json string
     *
     * @param {Object} o
     * @return {String}
     */
    static toJson(o) {
        return JSON.stringify(o);
    };

    //noinspection JSUnusedGlobalSymbols
    /**
     * Generate GUID
     *
     * @return {String}
     */
    static guid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            // noinspection MagicNumberJS, NonShortCircuitBooleanExpressionJS
            const r = Math.random() * 16 | 0;
            // noinspection MagicNumberJS, NonShortCircuitBooleanExpressionJS
            const v = (c === 'x') ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    //noinspection JSUnusedGlobalSymbols
    /**
     * Clone object
     *
     * @param {Date|Array|Object} obj
     * @return {*}
     */
    static clone(obj) {
        // noinspection EqualityComparisonWithCoercionJS
        if (obj == null || typeof obj !== "object") {
            return obj;
        }

        if (obj instanceof Date) {
            return new Date(obj.getTime());
        }

        if (obj instanceof Array) {
            return Array.from(obj);
        }

        if (obj instanceof Object) {
            const copy = obj.constructor();
            for (const attr in obj) {
                if (obj.hasOwnProperty(attr)) {
                    copy[attr] = GeneralUtils.clone(obj[attr]);
                }
            }
            return copy;
        }

        throw new Error("Unable to copy object! Its type isn't supported.");
    };

    //noinspection JSUnusedGlobalSymbols
    /**
     * Creates a property with default configuration (writable, enumerable, configurable).
     *
     * @param {Object} obj The object to create the property on.
     * @param {String} name The name of the property
     * @param {Function} getFunc The getter of the property
     * @param {Function} setFunc The setter of the property
     */
    static definePropertyWithDefaultConfig(obj, name, getFunc, setFunc) {
        Object.defineProperty(obj, name, {
            enumerable: true,
            configurable: true,
            get: getFunc,
            set: setFunc
        });
    };

    //noinspection JSUnusedGlobalSymbols
    /**
     * Creates a property with default configuration (writable, enumerable, configurable) and default getter/setter.
     *
     * @param {Object} obj The object to create the property on.
     * @param {String} name The name of the property
     */
    static defineStandardProperty(obj, name) {
        const getFunc = function get () { return this[`_${name}`]; };
        const setFunc = function set (v) { this[`_${name}`] = v; };
        GeneralUtils.definePropertyWithDefaultConfig(obj, name, getFunc, setFunc);
    };

    //noinspection JSUnusedGlobalSymbols
    /**
     * Waits a specified amount of time before resolving the returned promise.
     *
     * @param {int} ms The amount of time to sleep in milliseconds.
     * @param {PromiseFactory} promiseFactory
     * @return {Promise<void>} A promise which is resolved when sleep is done.
     */
    static sleep(ms, promiseFactory) {
        return promiseFactory.makePromise(resolve => {
            setTimeout(() => {
                resolve();
            }, ms);
        });
    };

    //noinspection JSUnusedGlobalSymbols
    /**
     * Convert a Date object to a ISO-8601 date string
     *
     * @param {Date} [date] Date which will be converted
     * @return {String} String formatted as ISO-8601 (yyyy-MM-dd'T'HH:mm:ss'Z')
     */
    static getIso8601Data(date = new Date()) {
        return dateformat(date, GeneralUtils.DATE_FORMAT_ISO8601);
    };

    //noinspection JSUnusedGlobalSymbols
    /**
     * Convert a Date object to a RFC-1123 date string
     *
     * @param {Date} [date] Date which will be converted
     * @return {String} String formatted as RFC-1123 (E, dd MMM yyyy HH:mm:ss 'GMT')
     */
    static getRfc1123Date(date = new Date()) {
        return dateformat(date, GeneralUtils.DATE_FORMAT_RFC1123);
    };

    //noinspection JSUnusedGlobalSymbols
    /**
     * Convert object(s) to a string
     *
     * @param {*} args
     * @return {String}
     */
    static stringify(...args) {
        return args.map(function (arg) {
            if (typeof arg === 'object') {
                return JSON.stringify(arg);
            }

            return arg;
        }).join(" ");
    };

    /**
     * @return {int}
     */
    static currentTimeMillis() {
        return (new Date).getTime();
    }
}

module.exports = GeneralUtils;
