'use strict';

const ArgumentGuard = require('../ArgumentGuard');
const RectangleSize = require('./RectangleSize');
const Location = require('./Location');
const CoordinatesType = require('./CoordinatesType');

/**
 * A Region in a two-dimensional plane.
 */
class Region {

    // noinspection JSUnusedGlobalSymbols
    static get EMPTY() {
      return new Region(0, 0, 0, 0)
    };

    /**
     * Creates a Region instance.
     *
     * @param {Number} left The left offset of this region.
     * @param {Number} top The top offset of this region.
     * @param {Number} width The width of the region.
     * @param {Number} height The height of the region.
     * @param {CoordinatesType} [coordinatesType=SCREENSHOT_AS_IS] The coordinatesType of the region.
     */
    constructor(left, top, width, height, coordinatesType = CoordinatesType.SCREENSHOT_AS_IS) {
        ArgumentGuard.isInteger(left, "left");
        ArgumentGuard.isInteger(top, "top");
        ArgumentGuard.greaterThanOrEqualToZero(width, "width", true);
        ArgumentGuard.greaterThanOrEqualToZero(height, "height", true);

        this._left = left;
        this._top = top;
        this._width = width;
        this._height = height;
        this._coordinatesType = coordinatesType;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Creates a Region from another Region instance.
     *
     * @param {Region} other A Region instance from which to create the Region.
     * @return {Region}
     */
    static fromRegion(other) {
        ArgumentGuard.notNull(other, "other");
        return new Region(other.getLeft(), other.getTop(), other.getWidth(), other.getHeight(), other.getCoordinatesType());
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Creates a Region from Location and Size objects
     *
     * @param {Location} location A Region instance from which to create the Region.
     * @param {RectangleSize} size A Region instance from which to create the Region.
     * @param {CoordinatesType} [coordinatesType=SCREENSHOT_AS_IS] The coordinatesType of the region.
     * @return {Region}
     */
    static fromLocationAndSize(location, size, coordinatesType = CoordinatesType.SCREENSHOT_AS_IS) {
        ArgumentGuard.notNull(location, "location");
        ArgumentGuard.notNull(size, "size");

        return new Region(location.getX(), location.getY(), size.getWidth(), size.getHeight(), coordinatesType);
    }

    /**
     * @return {Number} The region's left offset.
     */
    getLeft() {
        return this._left;
    }

    /**
     * @return {Number} The region's top offset.
     */
    getTop() {
        return this._top;
    }

    /**
     * @return {Number} The region's width.
     */
    getWidth() {
        return this._width;
    }

    /**
     * @return {Number} The region's height.
     */
    getHeight() {
        return this._height;
    }

    /**
     * @return {CoordinatesType} The region's coordinatesType.
     */
    getCoordinatesType() {
        return this._coordinatesType;
    }

    /**
     * @return {Location} The (top,left) position of the current region.
     */
    getLocation() {
        return new Location(this._left, this._top);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Set the (top,left) position of the current region
     *
     * @param {Location} location The (top,left) position to set.
     */
    setLocation(location) {
        ArgumentGuard.notNull(location, "location");
        this._left = location.getX();
        this._top = location.getY();
    }

    /**
     * @return {RectangleSize} The size of the region.
     */
    getSize() {
        return new RectangleSize(this._width, this._height);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Set the (width,height) size of the current region
     *
     * @param {RectangleSize} size The updated size of the region.
     */
    setSize(size) {
        ArgumentGuard.notNull(size, "size");
        this._width = size.getWidth();
        this._height = size.getHeight();
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Indicates whether some other Region is "equal to" this one.
     *
     * @param {Object|Region} obj The reference object with which to compare.
     * @return {Boolean} {@code true} if this object is the same as the obj argument; {@code false} otherwise.
     */
    equals(obj) {
        if(typeof obj !== typeof this || !(obj instanceof Region)) {
            return false;
        }

        return (this.getLeft() === obj.getLeft())
            && (this.getTop() === obj.getTop())
            && (this.getWidth() === obj.getWidth())
            && (this.getHeight() === obj.getHeight());
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * @return {Boolean} {@code true} if the region is empty; {@code false} otherwise.
     */
    isEmpty() {
        return this.getLeft() === Region.EMPTY.getLeft()
            && this.getTop() === Region.EMPTY .getTop()
            && this.getWidth() === Region.EMPTY.getWidth()
            && this.getHeight() === Region.EMPTY.getHeight();
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Get a Region translated by the specified amount.
     *
     * @param {Number} dx The amount to offset the x-coordinate.
     * @param {Number} dy The amount to offset the y-coordinate.
     * @return {Region} A region with an offset location.
     */
    offset(dx, dy) {
        return Region.fromLocationAndSize(this.getLocation().offset(dx, dy), this.getSize(), this.getCoordinatesType());
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * @return {Location}
     */
    static getMiddleOffset() {
        const middleX = this._width / 2;
        const middleY = this._height / 2;

        return new Location(middleX, middleY);
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Get a region which is a scaled version of the current region.
     * IMPORTANT: This also scales the LOCATION(!!) of the region (not just its size).
     *
     * @param {Number} scaleRatio The ratio by which to scale the results.
     * @return {Region} A new region which is a scaled version of the current region.
     */
    scale(scaleRatio) {
        return Region.fromLocationAndSize(this.getLocation().scale(scaleRatio), this.getSize().scale(scaleRatio), this.getCoordinatesType());
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * Returns a list of sub-regions which compose the current region.
     *
     * @param {RectangleSize} subRegionSize The default sub-region size to use.
     * @param {Boolean} [isFixedSize=false] If {@code false}, then sub-regions might have a size which is smaller then {@code subRegionSize}
     *                      (thus there will be no overlap of regions). Otherwise, all sub-regions will have the same size,
     *                      but sub-regions might overlap.
     * @return {Array.<Region>} The sub-regions composing the current region. If {@code subRegionSize} is equal or greater
     *                      than the current region, only a single region is returned.
     */
    getSubRegions(subRegionSize, isFixedSize = false) {
        if (isFixedSize) {
            return _getSubRegionsWithFixedSize(this, subRegionSize);
        }

        return _getSubRegionsWithVaryingSize(this, subRegionSize);
    };

    //noinspection JSUnusedGlobalSymbols
    /**
     * Check if a specified region is contained within the another region.
     *
     * @param {Region} other The region to check if it is contained within the current region.
     * @return {Boolean} True if the region is contained within the another region, false otherwise.
     */
    containsRegion(other) {
        const right = this._left + this._width;
        const otherRight = other.getLeft() + other.getWidth();

        const bottom = this._top + this._height;
        const otherBottom = other.getTop() + other.getHeight();
        return this._top <= other.getTop() && this._left <= other.getLeft() && bottom >= otherBottom && right >= otherRight;
    };

    //noinspection JSUnusedGlobalSymbols
    /**
     * Check if a specified location is contained within this this.
     *
     * @param {Location} location The location to test.
     * @return {Boolean} True if the location is contained within this region, false otherwise.
     */
    containsLocation(location) {
        return location.getX() >= this._left
            && location.getX() <= (this._left + this._width)
            && location.getY() >= this._top
            && location.getY() <= (this._top + this._height);
    };

    //noinspection JSUnusedGlobalSymbols
    /**
     * Check if a region is intersected with the current region.
     *
     * @param {Region} other The region to check intersection with.
     * @return {Boolean} True if the regions are intersected, false otherwise.
     */
    isIntersected(other) {
        const right = this._left + this._width;
        const bottom = this._top + this._height;

        const otherLeft = other.getLeft();
        const otherTop = other.getTop();
        const otherRight = otherLeft + other.getWidth();
        const otherBottom = otherTop + other.getHeight();

        return (((this._left <= otherLeft && otherLeft <= right) || (otherLeft <= this._left && this._left <= otherRight))
            && ((this._top <= otherTop && otherTop <= bottom) || (otherTop <= this._top && this._top <= otherBottom)));
    };

    //noinspection JSUnusedGlobalSymbols
    /**
     * Replaces this region with the intersection of itself and {@code other}
     *
     * @param {Region} other The region with which to intersect.
     */
    intersect(other) {
        if (!this.isIntersected(other)) {
            this._makeEmpty();
            return;
        }

        // The regions intersect. So let's first find the left & top values
        const otherLeft = other.getLeft();
        const otherTop = other.getTop();

        const intersectionLeft = (this._left >= otherLeft) ? this._left : otherLeft;
        const intersectionTop = (this._top >= otherTop) ? this._top : otherTop;

        // Now the width and height of the intersect
        const right = this._left + this._width;
        const otherRight = otherLeft + other.getWidth();
        const intersectionRight = (right <= otherRight) ? right : otherRight;
        const intersectionWidth = intersectionRight - intersectionLeft;

        const bottom = this._top + this._height;
        const otherBottom = otherTop + other.getHeight();
        const intersectionBottom = (bottom <= otherBottom) ? bottom : otherBottom;
        const intersectionHeight = intersectionBottom - intersectionTop;

        this._left = intersectionLeft;
        this._top = intersectionTop;
        this._width = intersectionWidth;
        this._height = intersectionHeight;
    };

    /**
     * @private
     */
    _makeEmpty() {
        this._left = Region.EMPTY.getLeft();
        this._top = Region.EMPTY.getTop();
        this._width = Region.EMPTY.getWidth();
        this._height = Region.EMPTY.getHeight();
        this._coordinatesType = Region.EMPTY.getCoordinatesType();
    }

    // noinspection JSUnusedGlobalSymbols
    toString() {
        return `(${this._left}, ${this._top}) ${this._width}x${this._height}, ${true._coordinatesType}`;
    }
}

/**
 * @private
 * @param {Region} containerRegion The region to divide into sub-regions.
 * @param {RectangleSize} subRegionSize The maximum size of each sub-region.
 * @return {Array.<Region>} The sub-regions composing the current region. If subRegionSize
 *                          is equal or greater than the current region, only a single region is returned.
 */
function _getSubRegionsWithFixedSize(containerRegion, subRegionSize) {
    ArgumentGuard.notNull(containerRegion, "containerRegion");
    ArgumentGuard.notNull(subRegionSize, "subRegionSize");

    const subRegions = [];

    let subRegionWidth = subRegionSize.getWidth();
    let subRegionHeight = subRegionSize.getHeight();

    ArgumentGuard.greaterThanZero(subRegionWidth, "subRegionSize width");
    ArgumentGuard.greaterThanZero(subRegionHeight, "subRegionSize height");

    // Normalizing.
    if (subRegionWidth > containerRegion.getWidth()) {
        subRegionWidth = containerRegion.getWidth();
    }
    if (subRegionHeight > containerRegion.getHeight()) {
        subRegionHeight = containerRegion.getHeight();
    }

    // If the requested size is greater or equal to the entire region size, we return a copy of the region.
    if (subRegionWidth === containerRegion.getWidth() && subRegionHeight === containerRegion.getHeight()) {
        subRegions.push(Region.fromRegion(containerRegion));
        return subRegions;
    }

    let currentTop = containerRegion.getTop();
    const bottom = containerRegion.getTop() + containerRegion.getHeight() - 1;
    const right = containerRegion.getLeft() + containerRegion.getWidth() - 1;

    while (currentTop <= bottom) {

        if (currentTop + subRegionHeight > bottom) {
            currentTop = (bottom - subRegionHeight) + 1;
        }

        let currentLeft = containerRegion.getLeft();
        while (currentLeft <= right) {
            if (currentLeft + subRegionWidth > right) {
                currentLeft = (right - subRegionWidth) + 1;
            }

            subRegions.push(new Region(currentLeft, currentTop, subRegionWidth, subRegionHeight));

            currentLeft += subRegionWidth;
        }
        currentTop += subRegionHeight;
    }
    return subRegions;
}

/**
 * @private
 * @param {Region} containerRegion The region to divide into sub-regions.
 * @param {RectangleSize} maxSubRegionSize The maximum size of each sub-region (some regions might be smaller).
 * @return {Array.<Region>} The sub-regions composing the current region. If maxSubRegionSize is equal or greater
 *                          than the current region, only a single region is returned.
 */
function _getSubRegionsWithVaryingSize(containerRegion, maxSubRegionSize) {
    ArgumentGuard.notNull(containerRegion, "containerRegion");
    ArgumentGuard.notNull(maxSubRegionSize, "maxSubRegionSize");
    ArgumentGuard.greaterThanZero(maxSubRegionSize.getWidth(), "maxSubRegionSize.getWidth()");
    ArgumentGuard.greaterThanZero(maxSubRegionSize.getHeight(), "maxSubRegionSize.getHeight()");

    const subRegions = [];

    let currentTop = containerRegion.getTop();
    const bottom = containerRegion.getTop() + containerRegion.getHeight();
    const right = containerRegion.getLeft() + containerRegion.getWidth();

    while (currentTop < bottom) {

        let currentBottom = currentTop + maxSubRegionSize.getHeight();
        if (currentBottom > bottom) { currentBottom = bottom; }

        let currentLeft = containerRegion.getLeft();
        while (currentLeft < right) {
            let currentRight = currentLeft + maxSubRegionSize.getWidth();
            if (currentRight > right) { currentRight = right; }

            const currentHeight = currentBottom - currentTop;
            const currentWidth = currentRight - currentLeft;

            subRegions.push(new Region(currentLeft, currentTop, currentWidth, currentHeight));
            currentLeft += maxSubRegionSize.getWidth();
        }
        currentTop += maxSubRegionSize.getHeight();
    }
    return subRegions;
}

module.exports = Region;
