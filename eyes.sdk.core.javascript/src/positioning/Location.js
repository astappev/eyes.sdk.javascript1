'use strict';

const ArgumentGuard = require('../ArgumentGuard');

/**
 * A location in a two-dimensional plane.
 */
class Location {

    // noinspection JSUnusedGlobalSymbols
    static get ZERO () {
      return new Location(0, 0);
    }

    /**
     * Creates a Location instance.
     *
     * @param {Number} x The X coordinate of this location.
     * @param {Number} y The Y coordinate of this location.
     */
    constructor(x, y) {
        ArgumentGuard.isInteger(x, "x");
        ArgumentGuard.isInteger(y, "y");

        this._x = x;
        this._y = y;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Creates a location from another location instance.
     *
     * @param {Location} other A location instance from which to create the location.
     */
    static fromLocation(other) {
        ArgumentGuard.notNull(other, "other");
        return new Location(other.getX(), other.getY());
    }

    /**
     * @return {Number} The X coordinate of this location.
     */
    getX() {
        return this._x;
    }

    /**
     * @return {Number} The Y coordinate of this location.
     */
    getY() {
        return this._y;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Indicates whether some other Location is "equal to" this one.
     *
     * @param {Object|Location} obj The reference object with which to compare.
     * @return {Boolean} {@code true} if this object is the same as the obj argument; {@code false} otherwise.
     */
    equals(obj) {
        if(typeof obj !== typeof this || !(obj instanceof Location)) {
            return false;
        }

        return this.getX() === obj.getX() && this.getY() === obj.getY();
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Get a location translated by the specified amount.
     *
     * @param {Number} dx The amount to offset the x-coordinate.
     * @param {Number} dy The amount to offset the y-coordinate.
     * @return {Location} A location translated by the specified amount.
     */
    offset(dx, dy) {
        return new Location(this._x + dx, this._y + dy);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Get a location translated by the specified amount.
     *
     * @param {Location} amount The amount to offset.
     * @return {Location} A location translated by the specified amount.
     */
    offsetByLocation(amount) {
        return this.offset(amount.getX(), amount.getY());
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Get a scaled location.
     *
     * @param {Number} scaleRatio The ratio by which to scale the results.
     * @return {Location} A scaled copy of the current location.
     */
    scale(scaleRatio) {
        return new Location(Math.ceil(this._x * scaleRatio), Math.ceil(this._y * scaleRatio));
    }

    // noinspection JSUnusedGlobalSymbols
    toString() {
        return `(${this._x}, ${this._y})`;
    }

    // noinspection JSUnusedGlobalSymbols
    toStringForFilename() {
        return `${this._x}_${this._y}`;
    }
}

module.exports = Location;
