'use strict';

/**
 * Interface for saving debug screenshots.
 *
 * @abstract
 */
class DebugScreenshotsProvider {
  static get DEFAULT_PREFIX() {
    return "screenshot_";
  }

  static get DEFAULT_PATH() {
    return ""
  };

    constructor() {
        this._prefix = DebugScreenshotsProvider.DEFAULT_PREFIX;
        this._path = null;
    }


    getPrefix() {
        return this._prefix;
    }

    setPrefix(value) {
        this._prefix = value || DebugScreenshotsProvider.DEFAULT_PREFIX;
    }

    getPath() {
        return this._path;
    }

    setPath(value) {
        if (value) {
            value = value.endsWith("/") ? value : value + '/';
        } else {
            value = DebugScreenshotsProvider.DEFAULT_PATH;
        }

        this._path = value;
    }

    // noinspection JSMethodCanBeStatic, JSUnusedGlobalSymbols
    /**
     * @abstract
     * @param {MutableImage} image
     * @param {String} suffix
     * @return {Promise<void>}
     */
    save(image, suffix) {
        throw new TypeError('The method `save` from `DebugScreenshotsProvider` should be implemented!');
    }
}

module.exports = DebugScreenshotsProvider;
