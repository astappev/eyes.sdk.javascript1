'use strict';

const fs = require("fs");

const Location = require('../positioning/Location');
const RectangleSize = require('../positioning/RectangleSize');
const ImageUtils = require('./ImageUtils');

const disabled = !fs.open;

/**
 * Parses the image if possible - meaning dimensions and BMP are extracted and available
 *
 * @private
 * @param {MutableImage} that The context of the current instance of MutableImage
 */
function _parseImage(that) {
    return that._promiseFactory.makePromise(resolve => {
        if (that._isParsed || disabled) {
            return resolve();
        }

        return ImageUtils.parseImage(that._imageBuffer, that._promiseFactory).then(imageData => {
            that._imageBmp = imageData;
            that._width = imageData.width;
            that._height = imageData.height;
            that._isParsed = true;
            resolve();
        });
    });
}

/**
 * Packs the image if possible - meaning the buffer is updated according to the edited BMP
 *
 * @private
 * @param {MutableImage} that The context of the current instance of MutableImage
 */
function _packImage(that) {
    return that._promiseFactory.makePromise(resolve => {
        if (!that._isParsed || that._imageBuffer || disabled) {
            return resolve();
        }

        return ImageUtils.packImage(that._imageBmp, that._promiseFactory).then(buffer => {
            that._imageBuffer = buffer;
            resolve();
        });
    });
}

/**
 * Retrieve image size - if image is not parsed, get image size from buffer
 *
 * @private
 * @param {MutableImage} that The context of the current instance of MutableImage
 */
function _retrieveImageSize(that) {
    if (that._isParsed || that._width && that._height) {
        return;
    }

    const imageSize = ImageUtils.getImageSizeFromBuffer(that._imageBuffer);
    that._width = imageSize.width;
    that._height = imageSize.height;
}

/**
 * A wrapper for image buffer that parses it to BMP to allow editing and extracting its dimensions
 */
class MutableImage {

    /**
     * @param {Buffer} image Encoded bytes of image
     * @param {PromiseFactory} promiseFactory An object which will be used for creating deferreds/promises.
     **/
    constructor(image, promiseFactory) {
        this._imageBuffer = image;
        this._promiseFactory = promiseFactory;
        this._isParsed = false;
        this._imageBmp = undefined;
        this._width = 0;
        this._height = 0;
        this._top = 0;
        this._left = 0;
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * Coordinates represent the image's position in a larger context (if any).
     * E.g., A screenshot of the browser's viewport of a web page.
     *
     * @return {Promise.<Location>} The coordinates of the image in the larger context (if any)
     */
    getCoordinates() {
        return this._promiseFactory.resolve(new Location(this._left, this._top));
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * Coordinates represent the image's position in a larger context (if any).
     * E.g., A screenshot of the browser's viewport of a web page.
     *
     * @param {Location} coordinates
     * @return {Promise.<void>}
     */
    setCoordinates(coordinates) {
        this._left = coordinates.getX();
        this._top = coordinates.getY();
        return this._promiseFactory.resolve();
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * Size of the image. Parses the image if necessary
     *
     * @return {RectangleSize}
     */
    getSize() {
        _retrieveImageSize(this);
        return new RectangleSize(this._width, this._height);
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * @return {Number}
     */
    getWidth() {
        _retrieveImageSize(this);
        return this._width;
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * @return {Number}
     */
    getHeight() {
        _retrieveImageSize(this);
        return this._height;
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * Return the image as buffer and image width and height.
     *
     * @return {Promise.<{imageBuffer: Buffer, width: number, height: number}>}
     */
    asObject() {
        const that = this;
        return _packImage(that).then(() => _retrieveImageSize(that)).then(() => ({
            imageBuffer: that._imageBuffer,
            width: that._width,
            height: that._height
        }));
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * Scales the image in place (used to downsize by 2 for retina display chrome bug - and tested accordingly).
     *
     * @param {Number} scaleRatio
     * @return {Promise.<MutableImage>}
     */
    scaleImage(scaleRatio) {
        if (scaleRatio === 1) {
            return this._promiseFactory.resolve();
        }

        const that = this;
        return _parseImage(that).then(() => {
            if (that._isParsed) {
                return ImageUtils.scaleImage(that._imageBmp, scaleRatio, that._promiseFactory).then(() => {
                    that._imageBuffer = null;
                    that._width = that._imageBmp.width;
                    that._height = that._imageBmp.height;
                    return that;
                });
            }
            return that;
        });
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * Crops the image according to the given region.
     *
     * @param {Region} region
     * @return {Promise.<MutableImage>}
     */
    cropImage(region) {
        const that = this;
        return _parseImage(that).then(() => {
            if (that._isParsed) {
                return ImageUtils.cropImage(that._imageBmp, region, that._promiseFactory).then(() => {
                    that._imageBuffer = null;
                    that._width = that._imageBmp.width;
                    that._height = that._imageBmp.height;
                    return that;
                });
            }
            return that;
        });
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * Crops the image according to the given region and return new image, do not override existing
     *
     * @param {Region} region
     * @return {Promise.<MutableImage>}
     */
    getImagePart(region) {
        const that = this;
        return _packImage(that).then(() => {
            const newImage = new MutableImage(Buffer.from(that._imageBuffer), that._promiseFactory);
            return newImage.cropImage(region);
        });
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * Rotates the image according to the given degrees.
     *
     * @param {Number} degrees
     * @return {Promise.<MutableImage>}
     */
    rotateImage(degrees) {
        const that = this;
        if (degrees === 0) {
            return that._promiseFactory.makePromise(resolve => {
                resolve(that);
            });
        }

        return _parseImage(that).then(() => {
            if (that._isParsed) {
                // If the region's coordinates are relative to the image, we convert them to absolute coordinates.
                return ImageUtils.rotateImage(that._imageBmp, degrees, that._promiseFactory).then(() => {
                    that._imageBuffer = null;
                    that._width = that._imageBmp.width;
                    that._height = that._imageBmp.height;
                    return that;
                });
            }
            return that;
        });
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * Write image to local directory
     *
     * @param {String} filename
     * @return {Promise.<void>}
     */
    saveImage(filename) {
        const that = this;
        return that.getImageBuffer().then(imageBuffer => ImageUtils.saveImage(imageBuffer, filename, that._promiseFactory));
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * @return {?Promise.<Buffer>}
     */
    getImageBuffer() {
        const that = this;
        return _packImage(that).then(() => that._imageBuffer);
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * @return {?Promise.<png.Image>}
     */
    getImageData() {
        const that = this;
        return _parseImage(that).then(() => that._imageBmp);
    }

    /**
     * @param {String} image64 base64 encoded bytes of image
     * @param {PromiseFactory} promiseFactory An object which will be used for creating deferreds/promises.
     * @return {MutableImage}
     */
    static fromBase64(image64, promiseFactory) {
        return new MutableImage(new Buffer(image64, 'base64'), promiseFactory);
    }
}

module.exports = MutableImage;