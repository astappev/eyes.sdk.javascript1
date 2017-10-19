'use strict';

const {MutableImage, CoordinatesType, GeneralUtils, GeometryUtils, ImageUtils} = require('eyes.sdk');

/**
 * @private
 * @type {String}
 */
const JS_GET_VIEWPORT_SIZE =
    "var height = undefined; " +
    "var width = undefined; " +
    "if (window.innerHeight) { height = window.innerHeight; } " +
    "else if (document.documentElement && document.documentElement.clientHeight) { height = document.documentElement.clientHeight; } " +
    "else { var b = document.getElementsByTagName('body')[0]; if (b.clientHeight) {height = b.clientHeight;} }; " +
    "if (window.innerWidth) { width = window.innerWidth; } " +
    "else if (document.documentElement && document.documentElement.clientWidth) { width = document.documentElement.clientWidth; } " +
    "else { var b = document.getElementsByTagName('body')[0]; if (b.clientWidth) { width = b.clientWidth;} }; " +
    "return [width, height];";

/**
 * @private
 * @type {String}
 */
const JS_GET_CURRENT_SCROLL_POSITION =
    "var doc = document.documentElement; " +
    "var x = window.scrollX || ((window.pageXOffset || doc.scrollLeft) - (doc.clientLeft || 0)); " +
    "var y = window.scrollY || ((window.pageYOffset || doc.scrollTop) - (doc.clientTop || 0)); " +
    "return [x, y];";

/**
 * @private
 * @type {String}
 */
const JS_GET_CONTENT_ENTIRE_SIZE =
    "var scrollWidth = document.documentElement.scrollWidth; " +
    "var bodyScrollWidth = document.body.scrollWidth; " +
    "var totalWidth = Math.max(scrollWidth, bodyScrollWidth); " +
    "var clientHeight = document.documentElement.clientHeight; " +
    "var bodyClientHeight = document.body.clientHeight; " +
    "var scrollHeight = document.documentElement.scrollHeight; " +
    "var bodyScrollHeight = document.body.scrollHeight; " +
    "var maxDocElementHeight = Math.max(clientHeight, scrollHeight); " +
    "var maxBodyHeight = Math.max(bodyClientHeight, bodyScrollHeight); " +
    "var totalHeight = Math.max(maxDocElementHeight, maxBodyHeight); " +
    "return [totalWidth, totalHeight];";

/**
 * @return {String}
 */
function JS_GET_COMPUTED_STYLE_FORMATTED_STR(propStyle) {
    return "var elem = arguments[0]; var styleProp = '" + propStyle + "'; " +
        "if (window.getComputedStyle) { " +
        "return window.getComputedStyle(elem, null).getPropertyValue(styleProp);" +
        "} else if (elem.currentStyle) { " +
        "return elem.currentStyle[styleProp];" +
        "} else { " +
        "return null;" +
        "}";
}

/**
 * @return {String}
 */
const JS_GET_IS_BODY_OVERFLOW_HIDDEN =
    "var styles = window.getComputedStyle(document.body, null);" +
    "var overflow = styles.getPropertyValue('overflow');" +
    "var overflowX = styles.getPropertyValue('overflow-x');" +
    "var overflowY = styles.getPropertyValue('overflow-y');" +
    "return overflow == 'hidden' || overflowX == 'hidden' || overflowY == 'hidden'";

/**
 * @private
 * @type {string[]}
 */
const JS_TRANSFORM_KEYS = ["transform", "-webkit-transform"];

/**
 * Handles browser related functionality.
 */
class EyesSeleniumUtils {
    /**
     * Executes a script using the browser's executeScript function - and optionally waits a timeout.
     *
     * @param {WebDriver} browser The driver using which to execute the script.
     * @param {String} script The code to execute on the given driver.
     * @param {PromiseFactory} promiseFactory
     * @param {number|undefined} [stabilizationTimeMs] The amount of time to wait after script execution to
     *        let the browser a chance to stabilize (e.g., finish rendering).
     * @return {Promise<void>} A promise which resolves to the result of the script's execution on the tab.
     */
    static executeScript(browser, script, promiseFactory, stabilizationTimeMs) {
        return browser.executeScript(script).then(result => {
            if (stabilizationTimeMs) {
                return GeneralUtils.sleep(stabilizationTimeMs, promiseFactory)
                    .then(() => result);
            }

            return result;
        });
    };

    /**
     * Returns the computed value of the style property for the current element.
     *
     * @param {WebDriver} browser The driver which will execute the script to get computed style.
     * @param {WebElement} element
     * @param {String} propStyle The style property which value we would like to extract.
     * @return {Promise<string>} The value of the style property of the element, or {@code null}.
     */
    static getComputedStyle(browser, element, propStyle) {
        const scriptToExec = JS_GET_COMPUTED_STYLE_FORMATTED_STR(propStyle);
        return browser.executeScript(scriptToExec, element).then(computedStyle => computedStyle);
    };

    /**
     * Returns a location based on the given location.
     *
     * @param {Logger} logger The logger to use.
     * @param {WebElement|EyesRemoteWebElement} element The element for which we want to find the content's location.
     * @param {{x: number, y: number}} location The location of the element.
     * @param {PromiseFactory} promiseFactory
     * @return {Promise<{x: number, y: number}>} The location of the content of the element.
     */
    static getLocationWithBordersAddition(logger, element, location, promiseFactory) {
        logger.verbose(`BordersAdditionFrameLocationProvider(logger, element, [${location.x},${location.y}])`);
        if (element.getRemoteWebElement !== undefined) {
            element = element.getRemoteWebElement();
        }

        let leftBorderWidth, topBorderWidth;
        return EyesSeleniumUtils._getLeftBorderWidth(logger, promiseFactory, element).then(val => {
            leftBorderWidth = val;
            return EyesSeleniumUtils._getTopBorderWidth(logger, promiseFactory, element);
        }).then(val => {
            topBorderWidth = val;
            logger.verbose("Done!");
            // Frame borders also have effect on the frame's location.
            return GeometryUtils.locationOffset(location, {x: leftBorderWidth, y: topBorderWidth});
        });
    };

    /**
     * Return width of left border
     *
     * @private
     * @param {Logger} logger
     * @param {PromiseFactory} promiseFactory
     * @param {WebElement} element
     * @return {Promise<number>}
     */
    static _getLeftBorderWidth(logger, promiseFactory, element) {
        return promiseFactory.makePromise(resolve => {
            logger.verbose("Get element border left width...");
            return EyesSeleniumUtils.getComputedStyle(element.getDriver(), element, "border-left-width").then(styleValue => styleValue, err => {
                logger.verbose("Using getComputedStyle failed: ", err);
                logger.verbose("Using getCssValue...");
                return element.getCssValue("border-left-width");
            }).then(propValue => {
                logger.verbose("Done!");
                const leftBorderWidth = Math.round(parseFloat(propValue.trim().replace("px", "")));
                logger.verbose("border-left-width: ", leftBorderWidth);
                resolve(leftBorderWidth);
            }, err => {
                logger.verbose("Couldn't get the element's border-left-width: ", err, ". Falling back to default");
                resolve(0);
            });
        });
    }

    /**
     * Return width of top border
     *
     * @private
     * @param {Logger} logger
     * @param {PromiseFactory} promiseFactory
     * @param {WebElement} element
     * @return {Promise<number>}
     */
    static _getTopBorderWidth(logger, promiseFactory, element) {
        return promiseFactory.makePromise(resolve => {
            logger.verbose("Get element's border top width...");
            return EyesSeleniumUtils.getComputedStyle(element.getDriver(), element, "border-top-width").then(styleValue => styleValue, err => {
                logger.verbose("Using getComputedStyle failed: ", err);
                logger.verbose("Using getCssValue...");
                return element.getCssValue("border-top-width");
            }).then(propValue => {
                logger.verbose("Done!");
                const topBorderWidth = Math.round(parseFloat(propValue.trim().replace("px", "")));
                logger.verbose("border-top-width: ", topBorderWidth);
                resolve(topBorderWidth);
            }, err => {
                logger.verbose("Couldn't get the element's border-top-width: ", err, ". Falling back to default");
                resolve(0);
            });
        });
    }

    /**
     * Gets the device pixel ratio.
     *
     * @param {WebDriver} browser The driver which will execute the script to get the ratio.
     * @param {PromiseFactory} promiseFactory
     * @return {Promise<number>} A promise which resolves to the device pixel ratio (float type).
     */
    static getDevicePixelRatio(browser, promiseFactory) {
        return EyesSeleniumUtils.executeScript(browser, 'return window.devicePixelRatio', promiseFactory, undefined).then(results => parseFloat(results));
    };

    /**
     * Get the current transform of page.
     *
     * @param {WebDriver} browser The driver which will execute the script to get the scroll position.
     * @param {PromiseFactory} promiseFactory
     * @return {Promise<object.<string, string>>} A promise which resolves to the current transform value.
     */
    static getCurrentTransform(browser, promiseFactory) {
        let script = "return { ";
        for (let i = 0, l = JS_TRANSFORM_KEYS.length; i < l; i++) {
            script += `'${JS_TRANSFORM_KEYS[i]}': document.documentElement.style['${JS_TRANSFORM_KEYS[i]}'],`;
        }
        script += " }";

        return EyesSeleniumUtils.executeScript(browser, script, promiseFactory, undefined);
    };

    /**
     * Sets transforms for document.documentElement according to the given map of style keys and values.
     *
     * @param {WebDriver} browser The browser to use.
     * @param {object.<string, string>} transforms The transforms to set. Keys are used as style keys and values are the values for those styles.
     * @param {PromiseFactory} promiseFactory
     * @return {Promise<void>}
     */
    static setTransforms(browser, transforms, promiseFactory) {
        let script = "";
        for (const key in transforms) {
            if (transforms.hasOwnProperty(key)) {
                script += `document.documentElement.style['${key}'] = '${transforms[key]}';`;
            }
        }

        return EyesSeleniumUtils.executeScript(browser, script, promiseFactory, 250);
    };

    /**
     * Set the given transform to document.documentElement for all style keys defined in {@link JS_TRANSFORM_KEYS}
     *
     * @param {WebDriver} browser The driver which will execute the script to set the transform.
     * @param {String} transformToSet The transform to set.
     * @param {PromiseFactory} promiseFactory
     * @return {Promise<void>} A promise which resolves to the previous transform once the updated transform is set.
     */
    static setTransformsetTransform(browser, transformToSet, promiseFactory) {
        const transforms = {};
        if (!transformToSet) {
            transformToSet = '';
        }

        for (let i = 0, l = JS_TRANSFORM_KEYS.length; i < l; i++) {
            transforms[JS_TRANSFORM_KEYS[i]] = transformToSet;
        }

        return EyesSeleniumUtils.setTransforms(browser, transforms, promiseFactory);
    };

    /**
     * CSS translate the document to a given location.
     *
     * @param {WebDriver} browser The driver which will execute the script to set the transform.
     * @param {{x: number, y: number}} point
     * @param {PromiseFactory} promiseFactory
     * @return {Promise<void>} A promise which resolves to the previous transform when the scroll is executed.
     */
    static translateTo(browser, point, promiseFactory) {
        return EyesSeleniumUtils.setTransform(browser, `translate(-${point.x}px, -${point.y}px)`, promiseFactory);
    };

    /**
     * Scroll to the specified position.
     *
     * @param {WebDriver} browser - The driver which will execute the script to set the scroll position.
     * @param {{x: number, y: number}} point Point to scroll to
     * @param {PromiseFactory} promiseFactory
     * @return {Promise<void>} A promise which resolves after the action is performed and timeout passed.
     */
    static setCurrentScrollPosition(browser, point, promiseFactory) {
        return EyesSeleniumUtils.executeScript(browser,
            `window.scrollTo(${parseInt(point.x, 10)}, ${parseInt(point.y, 10)});`,
            promiseFactory, 250);
    };

    /**
     * Gets the current scroll position.
     *
     * @param {WebDriver} browser The driver which will execute the script to get the scroll position.
     * @param {PromiseFactory} promiseFactory
     * @return {Promise<{x: number, y: number}>} A promise which resolves to the current scroll position.
     */
    static getCurrentScrollPosition(browser, promiseFactory) {
        return EyesSeleniumUtils.executeScript(browser, JS_GET_CURRENT_SCROLL_POSITION, promiseFactory, undefined).then(results => {
            // If we can't find the current scroll position, we use 0 as default.
            const x = parseInt(results[0], 10) || 0;
            const y = parseInt(results[1], 10) || 0;
            return {x, y};
        });
    };

    /**
     * Get the entire page size.
     *
     * @param {WebDriver} browser The driver used to query the web page.
     * @param {PromiseFactory} promiseFactory
     * @return {Promise<{width: number, height: number}>} A promise which resolves to an object containing the width/height of the page.
     */
    static getCurrentFrameContentEntireSize(browser, promiseFactory) {
        // IMPORTANT: Notice there's a major difference between scrollWidth
        // and scrollHeight. While scrollWidth is the maximum between an
        // element's width and its content width, scrollHeight might be
        // smaller (!) than the clientHeight, which is why we take the
        // maximum between them.
        return EyesSeleniumUtils.executeScript(browser, JS_GET_CONTENT_ENTIRE_SIZE, promiseFactory).then(results => {
            const totalWidth = parseInt(results[0], 10) || 0;
            const totalHeight = parseInt(results[1], 10) || 0;
            return {width: totalWidth, height: totalHeight};
        });
    };

    /**
     * Updates the document's documentElement "overflow" value (mainly used to remove/allow scrollbars).
     *
     * @param {WebDriver} browser The driver used to update the web page.
     * @param {String} overflowValue The values of the overflow to set.
     * @param {PromiseFactory} promiseFactory
     * @return {Promise<string>} A promise which resolves to the original overflow of the document.
     */
    static setOverflow(browser, overflowValue, promiseFactory) {
        let script;
        if (overflowValue === null) {
            script =
                "var origOverflow = document.documentElement.style.overflow; " +
                "document.documentElement.style.overflow = undefined; " +
                "return origOverflow";
        } else {
            script =
                "var origOverflow = document.documentElement.style.overflow; " +
                "document.documentElement.style.overflow = \"" + overflowValue + "\"; " +
                "return origOverflow";
        }

        return EyesSeleniumUtils.executeScript(browser, script, promiseFactory, 100);
    };

    /**
     * Updates the document's body "overflow" value
     *
     * @param {WebDriver} browser The driver used to update the web page.
     * @param {String} overflowValue The values of the overflow to set.
     * @param {PromiseFactory} promiseFactory
     * @return {Promise<string>} A promise which resolves to the original overflow of the document.
     */
    static setBodyOverflow(browser, overflowValue, promiseFactory) {
        let script;
        if (overflowValue === null) {
            script =
                "var origOverflow = document.body.style.overflow; " +
                "document.body.style.overflow = undefined; " +
                "return origOverflow";
        } else {
            script =
                "var origOverflow = document.body.style.overflow; " +
                "document.body.style.overflow = \"" + overflowValue + "\"; " +
                "return origOverflow";
        }

        return EyesSeleniumUtils.executeScript(browser, script, promiseFactory, 100);
    };

    /**
     * Hides the scrollbars of the current context's document element.
     *
     * @param {WebDriver} browser The browser to use for hiding the scrollbars.
     * @param {PromiseFactory} promiseFactory
     * @return {Promise<string>} The previous value of the overflow property (could be {@code null}).
     */
    static hideScrollbars(browser, promiseFactory) {
        return EyesSeleniumUtils.setOverflow(browser, "hidden", promiseFactory);
    };

    /**
     * Tries to get the viewport size using Javascript. If fails, gets the entire browser window size!
     *
     * @param {WebDriver} browser The browser to use.
     * @param {PromiseFactory} promiseFactory
     * @return {Promise<{width: number, height: number}>} The viewport size.
     */
    static getViewportSize(browser, promiseFactory) {
        return promiseFactory.makePromise((resolve, reject) => EyesSeleniumUtils.executeScript(browser, JS_GET_VIEWPORT_SIZE, promiseFactory, undefined).then(results => {
            if (isNaN(results[0]) || isNaN(results[1])) {
                reject("Can't parse values.");
            } else {
                resolve({
                    width: parseInt(results[0], 10) || 0,
                    height: parseInt(results[1], 10) || 0
                });
            }
        }, err => {
            reject(err);
        }));
    };

    /**
     * @param {Logger} logger
     * @param {WebDriver} browser The browser to use.
     * @param {PromiseFactory} promiseFactory
     * @return {Promise<{width: number, height: number}>} The viewport size of the current context, or the display size if the viewport size cannot be retrieved.
     */
    static getViewportSizeOrDisplaySize(logger, browser, promiseFactory) {
        logger.verbose("getViewportSizeOrDisplaySize()");

        return EyesSeleniumUtils.getViewportSize(browser, promiseFactory).catch(err => {
            logger.verbose("Failed to extract viewport size using Javascript:", err);

            // If we failed to extract the viewport size using JS, will use the window size instead.
            logger.verbose("Using window size as viewport size.");
            return browser.manage().window().getSize().then(size => {
                logger.verbose(String.format("Done! Size is", size));
                return size;
            });
        });
    };

    /**
     * @param {Logger} logger
     * @param {WebDriver} browser The browser to use.
     * @param {{width: number, height: number}} requiredSize
     * @param {PromiseFactory} promiseFactory
     * @return {Promise<boolean>}
     */
    static setBrowserSize(logger, browser, requiredSize, promiseFactory) {
        return EyesSeleniumUtils._setBrowserSize(logger, browser, requiredSize, 3, promiseFactory).then(() => true, () => false);
    };

    static _setBrowserSize(logger, browser, requiredSize, retries, promiseFactory) {
        return promiseFactory.makePromise((resolve, reject) => {
            logger.verbose("Trying to set browser size to:", requiredSize);

            return browser.manage().window().setSize(requiredSize.width, requiredSize.height).then(function () {
                return GeneralUtils.sleep(1000, promiseFactory);
            }).then(function () {
                return browser.manage().window().getSize();
            }).then(function (currentSize) {
                logger.log("Current browser size:", currentSize);
                if (currentSize.width === requiredSize.width && currentSize.height === requiredSize.height) {
                    resolve();
                    return;
                }

                if (retries === 0) {
                    reject("Failed to set browser size: retries is out.");
                    return;
                }

                EyesSeleniumUtils._setBrowserSize(logger, browser, requiredSize, retries - 1, promiseFactory).then(() => {
                    resolve();
                }, err => {
                    reject(err);
                });
            });
        });
    }

    /**
     * @param {Logger} logger
     * @param {WebDriver} browser The browser to use.
     * @param {{width: number, height: number}} actualViewportSize
     * @param {{width: number, height: number}} requiredViewportSize
     * @param {PromiseFactory} promiseFactory
     * @return {Promise<boolean>}
     */
    static setBrowserSizeByViewportSize(logger, browser, actualViewportSize, requiredViewportSize, promiseFactory) {
        return browser.manage().window().getSize().then(browserSize => {
            logger.verbose("Current browser size:", browserSize);
            const requiredBrowserSize = {
                width: browserSize.width + (requiredViewportSize.width - actualViewportSize.width),
                height: browserSize.height + (requiredViewportSize.height - actualViewportSize.height)
            };
            return EyesSeleniumUtils.setBrowserSize(logger, browser, requiredBrowserSize, promiseFactory);
        });
    };

    /**
     * Tries to set the viewport
     *
     * @param {Logger} logger
     * @param {WebDriver} browser The browser to use.
     * @param {{width: number, height: number}} requiredSize The viewport size.
     * @param {PromiseFactory} promiseFactory
     * @return {Promise<void>}
     */
    static setViewportSize(logger, browser, requiredSize, promiseFactory) {
        // First we will set the window size to the required size.
        // Then we'll check the viewport size and increase the window size accordingly.
        logger.verbose("setViewportSize(", requiredSize, ")");
        return promiseFactory.makePromise((resolve, reject) => {
            try {
                let actualViewportSize;
                EyesSeleniumUtils.getViewportSize(browser, promiseFactory).then(viewportSize => {
                    actualViewportSize = viewportSize;
                    logger.verbose("Initial viewport size:", actualViewportSize);

                    // If the viewport size is already the required size
                    if (actualViewportSize.width === requiredSize.width && actualViewportSize.height === requiredSize.height) {
                        resolve();
                        return;
                    }

                    // We move the window to (0,0) to have the best chance to be able to
                    // set the viewport size as requested.
                    browser.manage().window().setPosition(0, 0).catch(() => {
                        logger.verbose("Warning: Failed to move the browser window to (0,0)");
                    }).then(function () {
                        return EyesSeleniumUtils.setBrowserSizeByViewportSize(logger, browser, actualViewportSize, requiredSize, promiseFactory);
                    }).then(function () {
                        return EyesSeleniumUtils.getViewportSize(browser, promiseFactory);
                    }).then(function (actualViewportSize) {
                        if (actualViewportSize.width === requiredSize.width && actualViewportSize.height === requiredSize.height) {
                            resolve();
                            return;
                        }

                        // Additional attempt. This Solves the "maximized browser" bug
                        // (border size for maximized browser sometimes different than non-maximized, so the original browser size calculation is wrong).
                        logger.verbose("Trying workaround for maximization...");
                        return EyesSeleniumUtils.setBrowserSizeByViewportSize(logger, browser, actualViewportSize, requiredSize, promiseFactory).then(function () {
                            return EyesSeleniumUtils.getViewportSize(browser, promiseFactory);
                        }).then(function (viewportSize) {
                            actualViewportSize = viewportSize;
                            logger.verbose("Current viewport size:", actualViewportSize);

                            if (actualViewportSize.width === requiredSize.width && actualViewportSize.height === requiredSize.height) {
                                resolve();
                                return;
                            }

                            return browser.manage().window().getSize().then(browserSize => {
                                const MAX_DIFF = 3;
                                const widthDiff = actualViewportSize.width - requiredSize.width;
                                const widthStep = widthDiff > 0 ? -1 : 1; // -1 for smaller size, 1 for larger
                                const heightDiff = actualViewportSize.height - requiredSize.height;
                                const heightStep = heightDiff > 0 ? -1 : 1;

                                const currWidthChange = 0;
                                const currHeightChange = 0;
                                // We try the zoom workaround only if size difference is reasonable.
                                if (Math.abs(widthDiff) <= MAX_DIFF && Math.abs(heightDiff) <= MAX_DIFF) {
                                    logger.verbose("Trying workaround for zoom...");
                                    const retriesLeft = Math.abs((widthDiff === 0 ? 1 : widthDiff) * (heightDiff === 0 ? 1 : heightDiff)) * 2;
                                    const lastRequiredBrowserSize = null;
                                    return EyesSeleniumUtils._setWindowSize(logger, browser, requiredSize, actualViewportSize, browserSize,
                                        widthDiff, widthStep, heightDiff, heightStep, currWidthChange, currHeightChange,
                                        retriesLeft, lastRequiredBrowserSize, promiseFactory).then(() => {
                                        resolve();
                                    }, () => {
                                        reject("Failed to set viewport size: zoom workaround failed.");
                                    });
                                }

                                reject("Failed to set viewport size!");
                            });
                        });
                    });
                }).catch(err => {
                    reject(err);
                });
            } catch (err) {
                reject(new Error(err));
            }
        });
    };

    /**
     * @private
     * @param {Logger} logger
     * @param {WebDriver} browser
     * @param {{width: number, height: number}} requiredSize
     * @param actualViewportSize
     * @param browserSize
     * @param widthDiff
     * @param widthStep
     * @param heightDiff
     * @param heightStep
     * @param currWidthChange
     * @param currHeightChange
     * @param retriesLeft
     * @param lastRequiredBrowserSize
     * @param {PromiseFactory} promiseFactory
     * @return {Promise<void>}
     */
    static _setWindowSize(
        logger,
        browser,
        requiredSize,
        actualViewportSize,
        browserSize,
        widthDiff,
        widthStep,
        heightDiff,
        heightStep,
        currWidthChange,
        currHeightChange,
        retriesLeft,
        lastRequiredBrowserSize,
        promiseFactory
    ) {
        return promiseFactory.makePromise((resolve, reject) => {
            logger.verbose(`Retries left: ${retriesLeft}`);
            // We specifically use "<=" (and not "<"), so to give an extra resize attempt
            // in addition to reaching the diff, due to floating point issues.
            if (Math.abs(currWidthChange) <= Math.abs(widthDiff) && actualViewportSize.width !== requiredSize.width) {
                currWidthChange += widthStep;
            }

            if (Math.abs(currHeightChange) <= Math.abs(heightDiff) && actualViewportSize.height !== requiredSize.height) {
                currHeightChange += heightStep;
            }

            const requiredBrowserSize = {
                width: browserSize.width + currWidthChange,
                height: browserSize.height + currHeightChange
            };

            if (lastRequiredBrowserSize && requiredBrowserSize.width === lastRequiredBrowserSize.width && requiredBrowserSize.height === lastRequiredBrowserSize.height) {
                logger.verbose("Browser size is as required but viewport size does not match!");
                logger.verbose(`Browser size: ${requiredBrowserSize} , Viewport size: ${actualViewportSize}`);
                logger.verbose("Stopping viewport size attempts.");
                resolve();
                return;
            }

            return EyesSeleniumUtils.setBrowserSize(logger, browser, requiredBrowserSize, promiseFactory).then(() => {
                lastRequiredBrowserSize = requiredBrowserSize;
                return EyesSeleniumUtils.getViewportSize(browser, promiseFactory);
            }).then(actualViewportSize => {
                logger.verbose("Current viewport size:", actualViewportSize);
                if (actualViewportSize.width === requiredSize.width && actualViewportSize.height === requiredSize.height) {
                    resolve();
                    return;
                }

                if ((Math.abs(currWidthChange) <= Math.abs(widthDiff) || Math.abs(currHeightChange) <= Math.abs(heightDiff)) && (--retriesLeft > 0)) {
                    return EyesSeleniumUtils._setWindowSize(logger, browser, requiredSize, actualViewportSize, browserSize,
                        widthDiff, widthStep, heightDiff, heightStep, currWidthChange, currHeightChange,
                        retriesLeft, lastRequiredBrowserSize, promiseFactory).then(() => {
                        resolve();
                    }, err => {
                        reject(err);
                    });
                }

                reject("Failed to set window size!");
            });
        });
    }

    /**
     * @private
     * @param {{left: number, top: number, width: number, height: number}} part
     * @param {Array<{position: {x: number, y: number}, size: {width: number, height: number}, image: Buffer}>} parts
     * @param {{imageBuffer: Buffer, width: number, height: number}} imageObj
     * @param {WebDriver} browser
     * @param {Promise<void>} promise
     * @param {PromiseFactory} promiseFactory
     * @param {{width: number, height: number}} viewportSize
     * @param {PositionProvider} positionProvider
     * @param {ScaleProviderFactory} scaleProviderFactory
     * @param {CutProvider} cutProvider
     * @param {{width: number, height: number}} entirePageSize
     * @param {number} pixelRatio
     * @param {number} rotationDegrees
     * @param {boolean} automaticRotation
     * @param {number} automaticRotationDegrees
     * @param {boolean} isLandscape
     * @param {int} waitBeforeScreenshots
     * @param {{left: number, top: number, width: number, height: number}} regionInScreenshot
     * @param {boolean} [saveDebugScreenshots=false]
     * @param {String} [debugScreenshotsPath=null]
     * @return {Promise<void>}
     */
    static _processPart(
        part,
        parts,
        imageObj,
        browser,
        promise,
        promiseFactory,
        viewportSize,
        positionProvider,
        scaleProviderFactory,
        cutProvider,
        entirePageSize,
        pixelRatio,
        rotationDegrees,
        automaticRotation,
        automaticRotationDegrees,
        isLandscape,
        waitBeforeScreenshots,
        regionInScreenshot,
        saveDebugScreenshots,
        debugScreenshotsPath
    ) {
        return promise.then(function () {
            return promiseFactory.makePromise(function (resolve) {
                // Skip 0,0 as we already got the screenshot
                if (part.left === 0 && part.top === 0) {
                    parts.push({
                        image: imageObj.imageBuffer,
                        size: {width: imageObj.width, height: imageObj.height},
                        position: {x: 0, y: 0}
                    });

                    resolve();
                    return;
                }

                const partPosition = {x: part.left, y: part.top};
                return positionProvider.setPosition(partPosition).then(function () {
                    return positionProvider.getCurrentPosition();
                }).then(function (currentPosition) {
                    return EyesSeleniumUtils._captureViewport(browser, promiseFactory, viewportSize, scaleProviderFactory, cutProvider, entirePageSize,
                        pixelRatio, rotationDegrees, automaticRotation, automaticRotationDegrees, isLandscape,
                        waitBeforeScreenshots, regionInScreenshot, saveDebugScreenshots, debugScreenshotsPath).then(function (partImage) {
                        return partImage.asObject();
                    }).then(function (partObj) {
                        parts.push({
                            image: partObj.imageBuffer,
                            size: {width: partObj.width, height: partObj.height},
                            position: {x: currentPosition.x, y: currentPosition.y}
                        });

                        resolve();
                    });
                });
            });
        });
    };

    /**
     * @private
     * @param {WebDriver} browser
     * @param {PromiseFactory} promiseFactory
     * @param {{width: number, height: number}} viewportSize
     * @param {ScaleProviderFactory} scaleProviderFactory
     * @param {CutProvider} cutProvider
     * @param {{width: number, height: number}} entirePageSize
     * @param {number} pixelRatio
     * @param {number} rotationDegrees
     * @param {boolean} automaticRotation
     * @param {number} automaticRotationDegrees
     * @param {boolean} isLandscape
     * @param {int} waitBeforeScreenshots
     * @param {{left: number, top: number, width: number, height: number}} [regionInScreenshot]
     * @param {boolean} [saveDebugScreenshots=false]
     * @param {String} [debugScreenshotsPath=null]
     * @return {Promise<MutableImage>}
     */
    static _captureViewport(
        browser,
        promiseFactory,
        viewportSize,
        scaleProviderFactory,
        cutProvider,
        entirePageSize,
        pixelRatio,
        rotationDegrees,
        automaticRotation,
        automaticRotationDegrees,
        isLandscape,
        waitBeforeScreenshots,
        regionInScreenshot,
        saveDebugScreenshots,
        debugScreenshotsPath
    ) {
        let mutableImage, scaleRatio = 1;
        return GeneralUtils.sleep(waitBeforeScreenshots, promiseFactory).then(function () {
            return browser.takeScreenshot().then(function (screenshot64) {
                return new MutableImage(new Buffer(screenshot64, 'base64'), promiseFactory);
            }).then(function (image) {
                mutableImage = image;
                if (saveDebugScreenshots) {
                    const filename = "screenshot " + (new Date()).getTime()+ " original.png";
                    return mutableImage.saveImage(debugScreenshotsPath + filename.replace(/ /g, '_'));
                }
            }).then(function () {
                if (cutProvider) {
                    return cutProvider.cut(mutableImage, promiseFactory).then(function (image) {
                        mutableImage = image;
                    });
                }
            }).then(function () {
                return mutableImage.getSize();
            }).then(function (imageSize) {
                if (isLandscape && automaticRotation && imageSize.height > imageSize.width) {
                    rotationDegrees = automaticRotationDegrees;
                }

                if (scaleProviderFactory) {
                    const scaleProvider = scaleProviderFactory.getScaleProvider(imageSize.width);
                    scaleRatio = scaleProvider.getScaleRatio();
                }

                if (regionInScreenshot) {
                    const scaledRegion = GeometryUtils.scaleRegion(regionInScreenshot, 1 / scaleRatio);
                    return mutableImage.cropImage(scaledRegion);
                }
            }).then(function () {
                if (saveDebugScreenshots) {
                    const filename = "screenshot " +  (new Date()).getTime() + " cropped.png";
                    return mutableImage.saveImage(debugScreenshotsPath + filename.replace(/ /g, '_'));
                }
            }).then(function () {
                if (scaleRatio !== 1) {
                    return mutableImage.scaleImage(scaleRatio);
                }
            }).then(function () {
                if (saveDebugScreenshots) {
                    const filename = "screenshot " + (new Date()).getTime() + " scaled.png";
                    return mutableImage.saveImage(debugScreenshotsPath + filename.replace(/ /g, '_'));
                }
            }).then(function () {
                if (rotationDegrees !== 0) {
                    return mutableImage.rotateImage(rotationDegrees);
                }
            }).then(function () {
                return mutableImage.getSize();
            }).then(function (imageSize) {
                // If the image is a viewport screenshot, we want to save the current scroll position (we'll need it for check region).
                if (imageSize.width <= viewportSize.width && imageSize.height <= viewportSize.height) {
                    return EyesSeleniumUtils.getCurrentScrollPosition(browser, promiseFactory).then(function (scrollPosition) {
                        return mutableImage.setCoordinates(scrollPosition);
                    }, function () {
                        // Failed to get Scroll position, setting coordinates to default.
                        return mutableImage.setCoordinates({x: 0, y: 0});
                    });
                }
            }).then(function () {
                return mutableImage;
            });
        });
    };

    /**
     * Capture screenshot from given driver
     *
     * @param {WebDriver} browser
     * @param {PromiseFactory} promiseFactory
     * @param {{width: number, height: number}} viewportSize
     * @param {PositionProvider} positionProvider
     * @param {ScaleProviderFactory} scaleProviderFactory
     * @param {CutProvider} cutProvider
     * @param {boolean} fullPage
     * @param {boolean} hideScrollbars
     * @param {boolean} useCssTransition
     * @param {number} rotationDegrees
     * @param {boolean} automaticRotation
     * @param {number} automaticRotationDegrees
     * @param {boolean} isLandscape
     * @param {int} waitBeforeScreenshots
     * @param {boolean} checkFrameOrElement
     * @param {RegionProvider} [regionProvider]
     * @param {boolean} [saveDebugScreenshots=false]
     * @param {String} [debugScreenshotsPath=null]
     * @return {Promise<MutableImage>}
     */
    static getScreenshot(
        browser,
        promiseFactory,
        viewportSize,
        positionProvider,
        scaleProviderFactory,
        cutProvider,
        fullPage,
        hideScrollbars,
        useCssTransition,
        rotationDegrees,
        automaticRotation,
        automaticRotationDegrees,
        isLandscape,
        waitBeforeScreenshots,
        checkFrameOrElement,
        regionProvider,
        saveDebugScreenshots,
        debugScreenshotsPath
    ) {
        const MIN_SCREENSHOT_PART_HEIGHT = 10, MAX_SCROLLBAR_SIZE = 50;
        let originalPosition, originalOverflow, originalBodyOverflow, entirePageSize, regionInScreenshot, pixelRatio, imageObject, screenshot;

        hideScrollbars = hideScrollbars === null ? useCssTransition : hideScrollbars;

        // step #1 - get entire page size for future use (scaling and stitching)
        return positionProvider.getEntireSize().then(pageSize => {
            entirePageSize = pageSize;
        }, () => {
            // Couldn't get entire page size, using viewport size as default.
            entirePageSize = viewportSize;
        }).then(() => // step #2 - get the device pixel ratio (scaling)
        EyesSeleniumUtils.getDevicePixelRatio(browser, promiseFactory).then(ratio => {
            pixelRatio = ratio;
        }, () => {
            // Couldn't get pixel ratio, using 1 as default.
            pixelRatio = 1;
        })).then(() => {
            // step #3 - hide the scrollbars if instructed
            if (hideScrollbars) {
                return EyesSeleniumUtils.setOverflow(browser, "hidden", promiseFactory).then(originalVal => {
                    originalOverflow = originalVal;

                    if (useCssTransition) {
                        return EyesSeleniumUtils.executeScript(browser, JS_GET_IS_BODY_OVERFLOW_HIDDEN, promiseFactory).then(isBodyOverflowHidden => {
                            if (isBodyOverflowHidden) {
                                return EyesSeleniumUtils.setBodyOverflow(browser, "initial", promiseFactory).then(originalBodyVal => {
                                    originalBodyOverflow = originalBodyVal;
                                });
                            }
                        });
                    }
                });
            }
        }).then(() => {
            // step #4 - if this is a full page screenshot we need to scroll to position 0,0 before taking the first
            if (fullPage) {
                return positionProvider.getState().then(state => {
                    originalPosition = state;
                    return positionProvider.setPosition({x: 0, y: 0});
                }).then(() => {
                    return positionProvider.getCurrentPosition()
                }).then(location => {
                    if (location.x !== 0 || location.y !== 0) {
                        throw new Error("Could not scroll to the x/y corner of the screen");
                    }
                });
            }
        }).then(() => {
            if (regionProvider) {
                return EyesSeleniumUtils._captureViewport(browser, promiseFactory, viewportSize, scaleProviderFactory, cutProvider, entirePageSize, pixelRatio,
                    rotationDegrees, automaticRotation, automaticRotationDegrees, isLandscape, waitBeforeScreenshots).then(function (image) {
                    return regionProvider.getRegionInLocation(image, CoordinatesType.SCREENSHOT_AS_IS, promiseFactory);
                }).then(function (region) {
                    regionInScreenshot = region;
                });
            }
        }).then(() => {
            // step #5 - Take screenshot of the 0,0 tile / current viewport
            return EyesSeleniumUtils._captureViewport(browser, promiseFactory, viewportSize, scaleProviderFactory, cutProvider, entirePageSize, pixelRatio, rotationDegrees,
                automaticRotation, automaticRotationDegrees, isLandscape, waitBeforeScreenshots,
                checkFrameOrElement ? regionInScreenshot : null, saveDebugScreenshots, debugScreenshotsPath)
                .then(function (image) {
                    screenshot = image;
                    return screenshot.asObject();
                }).then(function (imageObj) {
                    imageObject = imageObj;
                });
        }).then(function () {
            return promiseFactory.makePromise(function (resolve) {
                if (!fullPage && !checkFrameOrElement) {
                    resolve();
                    return;
                }
                // IMPORTANT This is required! Since when calculating the screenshot parts for full size,
                // we use a screenshot size which is a bit smaller (see comment below).
                if (imageObject.width >= entirePageSize.width && imageObject.height >= entirePageSize.height) {
                    resolve();
                    return;
                }

                // We use a smaller size than the actual screenshot size in order to eliminate duplication
                // of bottom scroll bars, as well as footer-like elements with fixed position.
                const screenshotPartSize = {
                    width: imageObject.width,
                    height: Math.max(imageObject.height - MAX_SCROLLBAR_SIZE, MIN_SCREENSHOT_PART_HEIGHT)
                };

                const screenshotParts = GeometryUtils.getSubRegions({
                    left: 0, top: 0, width: entirePageSize.width,
                    height: entirePageSize.height
                }, screenshotPartSize, false);

                const parts = [];
                let promise = promiseFactory.makePromise(function (resolve) {
                    resolve();
                });

                screenshotParts.forEach(function (part) {
                    promise = EyesSeleniumUtils._processPart(part, parts, imageObject, browser, promise, promiseFactory,
                        viewportSize, positionProvider, scaleProviderFactory, cutProvider, entirePageSize, pixelRatio, rotationDegrees, automaticRotation,
                        automaticRotationDegrees, isLandscape, waitBeforeScreenshots, checkFrameOrElement ? regionInScreenshot : null, saveDebugScreenshots, debugScreenshotsPath);
                });
                promise.then(function () {
                    return ImageUtils.stitchImage(entirePageSize, parts, promiseFactory).then(function (stitchedBuffer) {
                        screenshot = new MutableImage(stitchedBuffer, promiseFactory);
                        resolve();
                    });
                });
            });
        }).then(function () {
            if (hideScrollbars) {
                return EyesSeleniumUtils.setOverflow(browser, originalOverflow, promiseFactory);
            }
        }).then(() => {
            if (originalBodyOverflow) {
                return EyesSeleniumUtils.setBodyOverflow(browser, originalBodyOverflow, promiseFactory);
            }
        }).then(() => {
            if (fullPage) {
                return positionProvider.restoreState(originalPosition);
            }
        }).then(() => {
            if (!checkFrameOrElement && regionInScreenshot) {
                return screenshot.cropImage(regionInScreenshot);
            }
        }).then(() => screenshot);
    };
}

module.exports = EyesSeleniumUtils;