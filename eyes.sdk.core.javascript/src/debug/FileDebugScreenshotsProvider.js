'use strict';

const dateformat = require('dateformat');

const DebugScreenshotsProvider = require('./DebugScreenshotsProvider');

/**
 * A debug screenshot provider for saving screenshots to file.
 */
class FileDebugScreenshotProvider extends DebugScreenshotsProvider {

    /**
     * @private
     */
    static get DATE_FORMAT (){
      return "yyyy_mm_dd_HH_MM_ss_l";
    }


    // noinspection JSUnusedGlobalSymbols
    /**
     * @param {MutableImage} image
     * @param {String} suffix
     * @return {Promise<void>}
     */
    save(image, suffix) {
        const filename = this.path + this.prefix + this.getFormattedTimeStamp() + "_" + suffix + ".png";
        return image.saveImage(filename.replace(' ', '_'));
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * @return {Promise<void>}
     */
    getFormattedTimeStamp() {
        return dateformat(new Date(), FileDebugScreenshotProvider.DATE_FORMAT);
    }
}

module.exports = FileDebugScreenshotProvider;
