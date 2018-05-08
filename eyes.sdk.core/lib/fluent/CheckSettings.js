'use strict';

const { MatchLevel } = require('../match/MatchLevel');
const { Region } = require('../geometry/Region');
const { FloatingMatchSettings } = require('../match/FloatingMatchSettings');
const { IgnoreRegionByRectangle } = require('./IgnoreRegionByRectangle');
const { FloatingRegionByRectangle } = require('./FloatingRegionByRectangle');
const { GetRegion } = require('./GetRegion');
const { GetFloatingRegion } = require('./GetFloatingRegion');

/**
 * The Match settings object to use in the various Eyes.Check methods.
 */
class CheckSettings {
  /**
   * @param {?number} [timeout=-1]
   * @param {Region|RegionObject} [region]
   */
  constructor(timeout = -1, region) {
    this._matchLevel = undefined;
    this._ignoreCaret = undefined;
    this._stitchContent = false;
    this._timeout = timeout;
    this._targetRegion = region;

    this._ignoreRegions = [];
    this._floatingRegions = [];
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Shortcut to set the match level to {@code MatchLevel.LAYOUT}.
   *
   * @return {CheckSettings} This instance of the settings object.
   */
  layout() {
    this._matchLevel = MatchLevel.Layout;
    return this;
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Shortcut to set the match level to {@code MatchLevel.EXACT}.
   *
   * @return {CheckSettings} This instance of the settings object.
   */
  exact() {
    this._matchLevel = MatchLevel.Exact;
    return this;
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Shortcut to set the match level to {@code MatchLevel.STRICT}.
   *
   * @return {CheckSettings} This instance of the settings object.
   */
  strict() {
    this._matchLevel = MatchLevel.Strict;
    return this;
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Shortcut to set the match level to {@code MatchLevel.CONTENT}.
   *
   * @return {CheckSettings} This instance of the settings object.
   */
  content() {
    this._matchLevel = MatchLevel.Content;
    return this;
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Set the match level by which to compare the screenshot.
   *
   * @param {MatchLevel} matchLevel The match level to use.
   * @return {CheckSettings} This instance of the settings object.
   */
  matchLevel(matchLevel) {
    this._matchLevel = matchLevel;
    return this;
  }

  /**
   * @return {MatchLevel}
   */
  getMatchLevel() {
    return this._matchLevel;
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Defines if to detect and ignore a blinking caret in the screenshot.
   *
   * @param {boolean} [ignoreCaret=true] Whether or not to detect and ignore a blinking caret in the screenshot.
   * @return {CheckSettings} This instance of the settings object.
   */
  ignoreCaret(ignoreCaret = true) {
    this._ignoreCaret = ignoreCaret;
    return this;
  }

  /**
   * @return {boolean}
   */
  getIgnoreCaret() {
    return this._ignoreCaret;
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Defines that the screenshot will contain the entire element or region, even if it's outside the view.
   *
   * @return {CheckSettings} This instance of the settings object.
   */
  fully() {
    this._stitchContent = true;
    return this;
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * @param {boolean} [stitchContent=true]
   * @return {CheckSettings}
   */
  stitchContent(stitchContent = true) {
    this._stitchContent = stitchContent;
    return this;
  }

  /**
   * @return {boolean}
   */
  getStitchContent() {
    return this._stitchContent;
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Defines the timeout to use when acquiring and comparing screenshots.
   *
   * @param {number} timeoutMilliseconds The timeout to use in milliseconds.
   * @return {CheckSettings} This instance of the settings object.
   */
  timeout(timeoutMilliseconds) {
    this._timeout = timeoutMilliseconds;
    return this;
  }

  /**
   * @return {number}
   */
  getTimeout() {
    return this._timeout;
  }

  /**
   * @protected
   * @param {Region|RegionObject} region
   */
  updateTargetRegion(region) {
    this._targetRegion = region;
  }

  /**
   * @return {Region}
   */
  getTargetRegion() {
    if (this._targetRegion && !(this._targetRegion instanceof Region)) {
      this._targetRegion = new Region(this._targetRegion);
    }

    return this._targetRegion;
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Adds a region to ignore.
   *
   * @param {GetRegion|Region} regionOrContainer The region or region container to ignore when validating the
   *   screenshot.
   * @return {CheckSettings} This instance of the settings object.
   */
  ignore(regionOrContainer) {
    if (regionOrContainer instanceof Region) {
      this._ignoreRegions.push(new IgnoreRegionByRectangle(regionOrContainer));
    } else if (regionOrContainer instanceof GetRegion) {
      this._ignoreRegions.push(regionOrContainer);
    } else {
      throw new TypeError('ignore method called with argument of unknown type!');
    }

    return this;
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Adds one or more ignore regions.
   *
   * @param {GetRegion...|Region...} regionsOrContainers One or more regions or region containers to ignore when
   *   validating the screenshot.
   * @return {CheckSettings} This instance of the settings object.
   */
  ignores(...regionsOrContainers) {
    if (!regionsOrContainers) {
      throw new TypeError('ignores method called without arguments!');
    }

    regionsOrContainers.forEach(region => {
      this.ignore(region);
    });

    return this;
  }

  /**
   * @return {GetRegion[]}
   */
  getIgnoreRegions() {
    return this._ignoreRegions;
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Adds a floating region. A floating region is a a region that can be placed within the boundaries of a bigger
   * region.
   *
   * @param {GetFloatingRegion|Region|FloatingMatchSettings} regionOrContainer The content rectangle or region
   *   container
   * @param {number} [maxUpOffset] How much the content can move up.
   * @param {number} [maxDownOffset] How much the content can move down.
   * @param {number} [maxLeftOffset] How much the content can move to the left.
   * @param {number} [maxRightOffset] How much the content can move to the right.
   * @return {CheckSettings} This instance of the settings object.
   */
  floating(regionOrContainer, maxUpOffset, maxDownOffset, maxLeftOffset, maxRightOffset) {
    // noinspection IfStatementWithTooManyBranchesJS
    if (regionOrContainer instanceof FloatingMatchSettings) {
      const floatingRegion = new FloatingRegionByRectangle(
        regionOrContainer.getRegion(),
        regionOrContainer.getMaxUpOffset(),
        regionOrContainer.getMaxDownOffset(),
        regionOrContainer.getMaxLeftOffset(),
        regionOrContainer.getMaxRightOffset()
      );
      this._floatingRegions.push(floatingRegion);
    } else if (regionOrContainer instanceof Region) {
      const floatingRegion = new FloatingRegionByRectangle(
        new Region(regionOrContainer),
        maxUpOffset,
        maxDownOffset,
        maxLeftOffset,
        maxRightOffset
      );
      this._floatingRegions.push(floatingRegion);
    } else if (regionOrContainer instanceof GetFloatingRegion) {
      this._floatingRegions.push(regionOrContainer);
    } else {
      throw new TypeError('floating method called with argument of unknown type!');
    }

    return this;
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Adds a floating region. A floating region is a a region that can be placed within the boundaries of a
   * bigger region.
   *
   * @param {number} maxOffset How much each of the content rectangles can move in any direction.
   * @param {Region...} regionsOrContainers One or more content rectangles or region containers
   * @return {CheckSettings} This instance of the settings object.
   */
  floatings(maxOffset, ...regionsOrContainers) {
    if (!regionsOrContainers) {
      throw new TypeError('floatings method called without arguments!');
    }

    regionsOrContainers.forEach(region => {
      this.floating(region, maxOffset, maxOffset, maxOffset, maxOffset);
    });

    return this;
  }

  /**
   * @return {GetFloatingRegion[]}
   */
  getFloatingRegions() {
    return this._floatingRegions;
  }
}

exports.CheckSettings = CheckSettings;