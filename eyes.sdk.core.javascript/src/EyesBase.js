'use strict';

const Logger = require('./logging/Logger');

const Region = require('./positioning/Region');
const Location = require('./positioning/Location');
const RectangleSize = require('./positioning/RectangleSize');
const CoordinatesType = require('./positioning/CoordinatesType');

const FileDebugScreenshotsProvider = require('./debug/FileDebugScreenshotsProvider');
const NullDebugScreenshotProvider = require('./debug/NullDebugScreenshotProvider');

const SimplePropertyHandler = require('./handlers/SimplePropertyHandler');
const ReadOnlyPropertyHandler = require('./handlers/ReadOnlyPropertyHandler');

const ImageDeltaCompressor = require('./images/ImageDeltaCompressor');

const AppOutputProvider = require('./capture/AppOutputProvider');
const AppOutputWithScreenshot = require('./capture/AppOutputWithScreenshot');
const AppOutput = require('./capture/AppOutput');

const FixedScaleProvider = require('./scaling/FixedScaleProvider');
const NullScaleProvider = require('./scaling/NullScaleProvider');

const NullCutProvider = require('./cutting/NullCutProvider');

const InvalidPositionProvider = require('./positioning/InvalidPositionProvider');

const TextTrigger = require('./triggers/TextTrigger');
const MouseTrigger = require('./triggers/MouseTrigger');

const MatchResult = require('./server/MatchResult');
const MatchLevel = require('./match/MatchLevel');
const ImageMatchSettings = require('./match/ImageMatchSettings');
const MatchWindowData = require('./match/MatchWindowData');

const DiffsFoundError = require('./errors/DiffsFoundError');
const NewTestError = require('./errors/NewTestError');
const TestFailedError = require('./errors/TestFailedError');

const CheckSettings = require('./fluent/CheckSettings');

const SessionStartInfo = require('./server/SessionStartInfo');
const SessionType = require('./server/SessionType');
const PropertyData = require('./server/PropertyData');

const FailureReports = require('./FailureReports');
const GeneralUtils = require('./GeneralUtils');
const ArgumentGuard = require('./ArgumentGuard');
const AppEnvironment = require('./AppEnvironment');
const ServerConnector = require('./server/ServerConnector');
const MatchWindowTask = require('./MatchWindowTask');
const SessionEventHandler = require('./SessionEventHandler');
const BatchInfo = require('./BatchInfo');
const TestResults = require('./server/TestResults');

/**
 * Core/Base class for Eyes - to allow code reuse for different SDKs (images, selenium, etc).
 */
class EyesBase {

    static get DEFAULT_EYES_SERVER() {
      return "https://eyesapi.applitools.com";
    }

    static get DEFAULT_MATCH_TIMEOUT() {
      return 2000;
    }

    static get USE_DEFAULT_TIMEOUT() {
      return -1;
    }

    /** @type {Boolean} */ _shouldMatchWindowRunOnceOnTimeout;

    /** @type {MatchWindowTask} */ _matchWindowTask;

    /** @type {ServerConnector} */ _serverConnector;
    /** @type {RunningSession} */ _runningSession;
    /** @type {SessionStartInfo} */ _sessionStartInfo;
    /** @type {PropertyHandler<RectangleSize>} */ _viewportSizeHandler;
    /** @type {EyesScreenshot} */ _lastScreenshot;
    /** @type {PropertyHandler<ScaleProvider>} */ _scaleProviderHandler;
    /** @type {PropertyHandler<CutProvider>} */ _cutProviderHandler;
    /** @type {PositionProvider} */  _positionProvider;

    /**
     * Will be checked <b>before</b> any argument validation. If true, all method will immediately return without performing any action.
     * @type {Boolean}
     */
    _isDisabled;

    /** @type {Logger} */ _logger;
    /** @type {Boolean} */ _isOpen;
    /** @type {String} */ _agentId;

    /**
     * Will be set for separately for each test.
     * @type {String}
     */
    _currentAppName;

    /**
     * The default app name if no current name was provided. If this is {@code null} then there is no default appName.
     * @type {String}
     */
    _appName;

    /** @type {SessionType} */ _sessionType;
    /** @type {String} */ _testName;
    /** @type {ImageMatchSettings} */ _defaultMatchSettings;
    /** @type {int} */ _matchTimeout;
    /** @type {BatchInfo} */ _batch;
    /** @type {String} */ _hostApp;
    /** @type {String} */ _hostOS;
    /** @type {String} */ _baselineEnvName;
    /** @type {String} */ _environmentName;
    /** @type {String} */ _branchName;
    /** @type {String} */ _parentBranchName;
    /** @type {FailureReports} */ _failureReports;
    /** @type {Trigger[]} */ _userInputs = [];
    /** @type {PropertyData[]} */ _properties = [];

    /**
     * Used for automatic save of a test run. New tests are automatically saved by default.
     * @type {Boolean}
     */
    _saveNewTests = true;
    /**
     * @type {Boolean}
     */
    _saveFailedTests = false;

    /** @type {DebugScreenshotsProvider} */ _debugScreenshotsProvider;
    /** @type {Boolean} */ _isViewportSizeSet;

    /** @type {int} */ _stitchingOverlap = 50;

    /**
     * The session ID of webdriver instance
     *
     * @type {String}
     */
    _autSessionId;

    /** @type {int} */ _validationId = -1;
    /** @type {SessionEventHandler[]} */ _sessionEventHandlers = [];

    /**
     * Creates a new {@code EyesBase}instance that interacts with the Eyes Server at the specified url.
     *
     * @param {PromiseFactory} promiseFactory An object which will be used for creating deferreds/promises.
     * @param {String} serverUrl The Eyes server URL.
     **/
    constructor(promiseFactory, serverUrl) {
        if(this._isDisabled) {
            this._userInputs = null;
            return;
        }

        ArgumentGuard.notNull(promiseFactory, "promiseFactory");
        ArgumentGuard.notNull(serverUrl, "serverUrl");

        this._logger = new Logger();
        this._promiseFactory = promiseFactory;
        this._scaleProviderHandler = new SimplePropertyHandler();
        this._scaleProviderHandler.set(new NullScaleProvider());
        this._cutProviderHandler = new SimplePropertyHandler();
        this._cutProviderHandler.set(new NullCutProvider());
        this._positionProvider = new InvalidPositionProvider();
        this._viewportSizeHandler = new SimplePropertyHandler();
        this._viewportSizeHandler.set(null);
        this._debugScreenshotsProvider = new NullDebugScreenshotProvider();
        this._defaultMatchSettings = new ImageMatchSettings();

        this._serverConnector = new ServerConnector(this._promiseFactory, this._logger, serverUrl);
        this._matchTimeout = EyesBase.DEFAULT_MATCH_TIMEOUT;
        this._failureReports = FailureReports.ON_CLOSE;
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * Sets the user given agent id of the SDK.
     *
     * @param agentId {String} The agent ID to set.
     */
    setAgentId(agentId) {
        this._agentId = agentId;
    }

    /**
     * @return {String} The user given agent id of the SDK.
     */
    getAgentId() {
        return this._agentId;
    }

    /**
     * Sets the API key of your applitools Eyes account.
     *
     * @param apiKey {String} The api key to be used.
     */
    setApiKey(apiKey) {
        ArgumentGuard.notNull(apiKey, "apiKey");
        this._serverConnector.setApiKey(apiKey);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * @return {String} The currently set API key or {@code null} if no key is set.
     */
    getApiKey() {
        return this._serverConnector.getApiKey();
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * Sets the current server URL used by the rest client.
     *
     * @param serverUrl {String} The URI of the rest server, or {@code null} to use the default server.
     */
    setServerUrl(serverUrl) {
        if (serverUrl) {
            this._serverConnector.setServerUrl(serverUrl);
        } else {
            this._serverConnector.setServerUrl(this.getDefaultServerUrl());
        }
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * @return {String} The URI of the eyes server.
     */
    getServerUrl() {
        return this._serverConnector.getServerUrl();
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * Sets the proxy settings to be used by the request module.
     *
     * @param {ProxySettings|string} arg1 The proxy url to be used by the serverConnector or ProxySettings instance. If {@code null} then no proxy is set.
     * @param {String} [username]
     * @param {String} [password]
     */
    setProxy(arg1, username, password) {
        return this._serverConnector.setProxy(arg1, username, password);
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * @return {ProxySettings} current proxy settings used by the server connector, or {@code null} if no proxy is set.
     */
    getProxy() {
        return this._serverConnector.getProxy();
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * @param isDisabled {Boolean} If true, all interactions with this API will be silently ignored.
     */
    setIsDisabled(isDisabled) {
        this._isDisabled = isDisabled;
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * @return {Boolean} Whether eyes is disabled.
     */
    getIsDisabled() {
        return this._isDisabled;
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * @param appName {String} The name of the application under test.
     */
    setAppName(appName) {
        this._appName = appName;
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * @return {String} The name of the application under test.
     */
    getAppName() {
        return this._currentAppName || this._appName;
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * Sets the branch in which the baseline for subsequent test runs resides.
     * If the branch does not already exist it will be created under the
     * specified parent branch (see {@link #setParentBranchName}).
     * Changes to the baseline or model of a branch do not propagate to other
     * branches.
     *
     * @param branchName {String} Branch name or {@code null} to specify the default branch.
     */
    setBranchName(branchName) {
        this._branchName = branchName;
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * @return {String} The current branch name.
     */
    getBranchName() {
        return this._branchName;
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * Sets the branch under which new branches are created.
     *
     * @param parentBranchName {String} Branch name or {@code null} to specify the default branch.
     */
    setParentBranchName(parentBranchName) {
        this._parentBranchName = parentBranchName;
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * @return {String} The name of the current parent branch under which new branches will be created.
     */
    getParentBranchName() {
        return this._parentBranchName;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Clears the user inputs list.
     *
     * @protected
     */
    clearUserInputs() {
        if (this._isDisabled) {
            return;
        }
        this._userInputs.length = 0;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * @protected
     * @return {Trigger[]} User inputs collected between {@code checkWindowBase} invocations.
     */
    getUserInputs() {
        if (this._isDisabled) {
            return null;
        }
        return GeneralUtils.clone(this._userInputs);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Sets the maximum time (in ms) a match operation tries to perform a match.
     * @param {int} ms Total number of ms to wait for a match.
     */
    setMatchTimeout(ms) {
        // noinspection MagicNumberJS
        const MIN_MATCH_TIMEOUT = 500;
        if (this._isDisabled) {
            this._logger.verbose("Ignored");
            return;
        }

        this._logger.verbose("Setting match timeout to: " + ms);
        if ((ms !== 0) && (MIN_MATCH_TIMEOUT > ms)) {
            throw new TypeError(`Match timeout must be set in milliseconds, and must be > ${MIN_MATCH_TIMEOUT}`);
        }

        this._matchTimeout = ms;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * @return {int} The maximum time in ms {@link #checkWindowBase(RegionProvider, String, boolean, int)} waits for a match.
     */
    getMatchTimeout() {
        return this._matchTimeout;
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * Set whether or not new tests are saved by default.
     *
     * @param {Boolean} saveNewTests True if new tests should be saved by default. False otherwise.
     */
    setSaveNewTests(saveNewTests) {
        this._saveNewTests = saveNewTests;
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * @return {Boolean} True if new tests are saved by default.
     */
    getSaveNewTests() {
        return this._saveNewTests;
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * Set whether or not failed tests are saved by default.
     *
     * @param {Boolean} saveFailedTests True if failed tests should be saved by default, false otherwise.
     */
    setSaveFailedTests(saveFailedTests) {
        this._saveFailedTests = saveFailedTests;
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * @return {Boolean} True if failed tests are saved by default.
     */
    getSaveFailedTests() {
        return this._saveFailedTests;
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * Sets the batch in which context future tests will run or {@code null} if tests are to run standalone.
     *
     * @param arg1 {string|BatchInfo} - the batch name or batch object
     * @param [batchId] {String} - ID of the batch, should be generated using GeneralUtils.guid()
     * @param [batchDate] {String} - start date of the batch, can be created as new Date().toUTCString()
     */
    setBatch(arg1, batchId, batchDate) {
        if (this._isDisabled) {
            this._logger.verbose("Ignored");
            return;
        }

        if (arg1 instanceof BatchInfo) {
            this._batch = arg1;
        } else {
            this._batch = new BatchInfo(arg1, batchDate, batchId);
        }

        this._logger.verbose(`setBatch(${this._batch})`);
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * @return {BatchInfo} The currently set batch info.
     */
    getBatch() {
        return this._batch;
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * @param {FailureReports} failureReports Use one of the values in FailureReports.
     */
    setFailureReports(failureReports) {
        ArgumentGuard.isValidEnumValue(failureReports, FailureReports);
        this._failureReports = failureReports;
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * @return {FailureReports} The failure reports setting.
     */
    getFailureReports() {
        return this._failureReports;
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * Updates the match settings to be used for the session.
     *
     * @param {ImageMatchSettings} defaultMatchSettings The match settings to be used for the session.
     */
    setDefaultMatchSettings(defaultMatchSettings) {
        ArgumentGuard.notNull(defaultMatchSettings, "defaultMatchSettings");
        this._defaultMatchSettings = defaultMatchSettings;
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * @return {ImageMatchSettings} The match settings used for the session.
     */
    getDefaultMatchSettings() {
        return this._defaultMatchSettings;
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * The test-wide match level to use when checking application screenshot with the expected output.
     *
     * @deprecated This function is deprecated. Please use {@link #setDefaultMatchSettings} instead.
     * @param {MatchLevel} matchLevel The test-wide match level to use when checking application screenshot with the expected output.
     */
    setMatchLevel(matchLevel) {
        ArgumentGuard.isValidEnumValue(matchLevel, MatchLevel);
        this._defaultMatchSettings.setMatchLevel(matchLevel);
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * @deprecated Please use{@link #getDefaultMatchSettings} instead.
     * @return {MatchLevel} The test-wide match level.
     */
    getMatchLevel() {
        return this._defaultMatchSettings.getMatchLevel();
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * @protected
     * @return {String} The full agent id composed of both the base agent id and the user given agent id.
     */
    _getFullAgentId() {
        const agentId = this.getAgentId();
        if (!agentId) {
            return this.getBaseAgentId();
        }
        //noinspection JSUnresolvedFunction
        return `${agentId} [${this.getBaseAgentId()}]`;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * @return {Boolean} Whether a session is open.
     */
    getIsOpen() {
        return this._isOpen;
    }

    // noinspection JSMethodCanBeStatic
    /**
     * @return {String}
     */
    getDefaultServerUrl() {
        return "https://eyesapi.applitools.com";
    }

    /**
     * Sets a handler of log messages generated by this API.
     *
     * @param {Object} logHandler Handles log messages generated by this API.
     */
    setLogHandler(logHandler) {
        this._logger.setLogHandler(logHandler);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * @return {LogHandler} The currently set log handler.
     */
    getLogHandler() {
        return this._logger.getLogHandler();
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * Manually set the the sizes to cut from an image before it's validated.
     *
     * @param {CutProvider} [cutProvider] the provider doing the cut.
     */
    setImageCut(cutProvider) {
        if (cutProvider) {
            this._cutProviderHandler = new ReadOnlyPropertyHandler(this._logger, cutProvider);
        } else {
            this._cutProviderHandler = new SimplePropertyHandler(new NullCutProvider());
        }
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * Manually set the scale ratio for the images being validated.
     *
     * @param {Number} [scaleRatio=1] The scale ratio to use, or {@code null} to reset back to automatic scaling.
     */
    setScaleRatio(scaleRatio) {
        if (scaleRatio) {
            this._scaleProviderHandler = new ReadOnlyPropertyHandler(this._logger, new FixedScaleProvider(scaleRatio));
        } else {
            this._scaleProviderHandler = new SimplePropertyHandler(new NullScaleProvider());
        }
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * @return {Number} The ratio used to scale the images being validated.
     */
    getScaleRatio() {
        return this._scaleProviderHandler.get().getScaleRatio();
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * Adds a property to be sent to the server.
     *
     * @param {String} name The property name.
     * @param {String} value The property value.
     */
    addProperty(name, value) {
        const pd = new PropertyData(name, value);
        return this._properties.push(pd);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Clears the list of custom properties.
     */
    clearProperties() {
        this._properties.length = 0;
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * @param {Boolean} saveDebugScreenshots If true, will save all screenshots to local directory.
     */
    setSaveDebugScreenshots(saveDebugScreenshots) {
        const prev = this._debugScreenshotsProvider;
        if (saveDebugScreenshots) {
            this._debugScreenshotsProvider = new FileDebugScreenshotsProvider();
        } else {
            this._debugScreenshotsProvider = new NullDebugScreenshotProvider();
        }
        this._debugScreenshotsProvider.setPrefix(prev.getPrefix());
        this._debugScreenshotsProvider.setPath(prev.getPath());
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * @return {Boolean}
     */
    getSaveDebugScreenshots() {
        return !(this._debugScreenshotsProvider instanceof NullDebugScreenshotProvider);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * @param {String} pathToSave Path where you want to save the debug screenshots.
     */
    setDebugScreenshotsPath(pathToSave) {
        this._debugScreenshotsProvider.setPath(pathToSave);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * @return {String} The path where you want to save the debug screenshots.
     */
    getDebugScreenshotsPath() {
        return this._debugScreenshotsProvider.getPath();
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * @param {String} prefix The prefix for the screenshots' names.
     */
    setDebugScreenshotsPrefix(prefix) {
        this._debugScreenshotsProvider.setPrefix(prefix);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * @return {String} The prefix for the screenshots' names.
     */
    public getDebugScreenshotsPrefix() {
        return this._debugScreenshotsProvider.getPrefix();
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * @param {DebugScreenshotsProvider} debugScreenshotsProvider
     */
    public setDebugScreenshotsProvider(debugScreenshotsProvider) {
        this._debugScreenshotsProvider = debugScreenshotsProvider;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * @return {DebugScreenshotsProvider}
     */
    public getDebugScreenshotsProvider() {
        return this._debugScreenshotsProvider;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Sets the ignore blinking caret value.
     *
     * @param {Boolean} value The ignore value.
     */
    setIgnoreCaret(value) {
        this._defaultMatchSettings.setIgnoreCaret(value);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * @return {Boolean} Whether to ignore or the blinking caret or not when comparing images.
     */
    getIgnoreCaret() {
        const ignoreCaret = this._defaultMatchSettings.getIgnoreCaret();
        return ignoreCaret || true;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Sets the stitching overlap in pixels.
     *
     * @param {int} pixels The width (in pixels) of the overlap.
     */
    setStitchOverlap(pixels) {
        this._stitchingOverlap = pixels;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * @return {int} the stitching overlap in pixels.
     */
    getStitchOverlap() {
        return this._stitchingOverlap;
    }

    /**
     * Ends the currently running test.
     *
     * @param {Boolean} throwEx If true, then the returned promise will 'reject' for failed/aborted tests.
     * @return {Promise<TestResults>} A promise which resolves/rejects (depending on the value of 'throwEx') to the test results.
     */
    close(throwEx = true) {
        const that = this;

        that._logger.verbose(`"EyesBase.close(${throwEx})`);

        if (that._isDisabled) {
            that._logger.verbose("Eyes close ignored. (disabled)");
            that._finallyClose();
            return that._promiseFactory.resolve(new TestResults());
        }

        if (!that._isOpen) {
            that._logger.log(`Close called with Eyes not open`);
            that._finallyClose();
            return that._promiseFactory.reject(`Close called with Eyes not open`);
        }

        return that._endSession(false, throwEx);
    }

    /**
     * If a test is running, aborts it. Otherwise, does nothing.
     *
     * @return {Promise<void>} A promise which resolves to the test results.
     */
    abortIfNotClosed() {
        const that = this;

        that._logger.verbose(`"EyesBase.abortIfNotClosed()`);

        if (that._isDisabled) {
            that._logger.verbose("Eyes abortIfNotClosed ignored. (disabled)");
            that._finallyClose();
            return this._promiseFactory.resolve(new TestResults());
        }

        if (!that._isOpen) {
            that._logger.log(`Session not open, nothing to do.`);
            that._finallyClose();
            return that._promiseFactory.resolve();
        }

        return this._endSession(true, false).catch(() => {});
    }

    /**
     * Utility function for ending a session on the server.
     *
     * @private
     * @param {Boolean} isAborted Whether or not the test was aborted.
     * @param {Boolean} throwEx Whether 'reject' should be called if the results returned from the server indicate a test failure.
     * @return {Promise} A promise which resolves (or rejected, dependeing on 'throwEx' and the test result) after ending the session.
     */
    _endSession(isAborted, throwEx) {
        const that = this;
        return that._promiseFactory.makePromise((resolve, reject) => {
            that._logger.verbose(`${isAborted ? 'Aborting' : 'Closing'} server session...`);

            that._isOpen = false;

            that._lastScreenshot = null;
            that.clearUserInputs();

            // If a session wasn't started, use empty results.
            if (!that._runningSession) {
                that._logger.verbose("Server session was not started");
                that._logger.log("--- Empty test ended.");

                const testResults = new TestResults();

                if (that._autSessionId) {
                    return that._notifyEvent('testEnded', that._autSessionId, null).then(() => {
                        that._finallyClose();
                        return testResults;
                    });
                } else {
                    that._finallyClose();
                    return that._promiseFactory.resolve(testResults);
                }
            }

            const isNewSession = that._runningSession.getIsNewSession();
            const sessionResultsUrl = that._runningSession.getUrl();

            that._logger.verbose("Ending server session...");
            const save = !isAborted && ((isNewSession && that._saveNewTests) || (!isNewSession && that._saveFailedTests));
            that._logger.verbose(`Automatically save test? ${save}`);

            // Session was started, call the server to end the session.
            let serverResults;
            return that._serverConnector.stopSession(that._runningSession, isAborted, save).then(results => {
                results.setIsNew(isNewSession);
                results.setUrl(sessionResultsUrl);
                serverResults = results;
                that._logger.verbose(`Results: ${results}`);

                if (!isNewSession && (results.getMismatches() > 0 || results.getMissing() > 0)) {
                    let instructions = `See details at ${sessionResultsUrl}`;
                    that._logger.log(`--- Failed test ended. ${instructions}`);

                    if (throwEx) {
                        that._finallyClose();
                        const message = `Test '${that._sessionStartInfo.getScenarioIdOrName()}' of '${that._sessionStartInfo.getAppIdOrName()}' detected differences! ${instructions}`;
                        return reject(new DiffsFoundError(results, message));
                    }
                    return resolve(results);
                }

                if (isNewSession) {
                    let instructions = "Please approve the new baseline at " + sessionResultsUrl;
                    that._logger.log(`--- New test ended. ${instructions}`);

                    if (throwEx && !that._saveNewTests) {
                        that._finallyClose();
                        const message = `'${that._sessionStartInfo.getScenarioIdOrName()}' of '${that._sessionStartInfo.getAppIdOrName()}'. ${instructions}`;
                        return that._promiseFactory.reject(new NewTestError(results, message));
                    }
                    return resolve(results);
                }

                that._logger.log(`--- Test passed. See details at ${sessionResultsUrl}`);
                return resolve(results);
            }, err => {
                serverResults = null;
                that._logger.log(err);
                return reject(err);
            }).then(() => that._notifyEvent('testEnded', that._autSessionId, serverResults)).then(() => {
                that._finallyClose();
            });
        });
    }

    /**
     * @private
     */
    _finallyClose() {
        this._matchWindowTask = null;
        this._autSessionId = null;
        this._runningSession = null;
        this._currentAppName = null;
        this._logger.getLogHandler().close();
    }

    /**
     * Notifies all handlers of an event.
     *
     * @private
     * @param {String} eventName The event to notify
     * @param {...Object} [param1] The first of what may be a list of "hidden" parameters, to be passed to the event notification function. May also be undefined.
     * @return {Promise} A promise which resolves when the event was delivered/failed to all handlers.
     */
    _notifyEvent(eventName, ...param1) {
        const that = this;
        return that._promiseFactory.makePromise(resolve => {
            that._logger.verbose("Notifying event: ", eventName);
            const notificationPromises = [];

            that._sessionEventHandlers.forEach(function (handler) {
                // Call the event with the rest of the (hidden) parameters supplied to this function.
                const promise = handler[eventName](...param1).then(null, err => {
                    that._logger.verbose(`'${eventName}' notification handler returned an error: ${err}`);
                });
                notificationPromises.push(promise)
            });

            that._promiseFactory.all(notificationPromises).then(() => {
                resolve();
            });
        });
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * Sets the host OS name - overrides the one in the agent string.
     *
     * @param {String} hostOS The host OS running the AUT.
     */
    setHostOS(hostOS) {
        this._logger.log(`Host OS: ${hostOS}`);

        if (!hostOS) {
            this._hostOS = null;
        } else {
            this._hostOS = hostOS.trim();
        }
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * @return {String} The host OS as set by the user.
     */
    getHostOS() {
        return this._hostOS;
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * Sets the host application - overrides the one in the agent string.
     *
     * @param {String} hostApp The application running the AUT (e.g., Chrome).
     */
    setHostApp(hostApp) {
        this._logger.log(`Host OS: ${hostApp}`);

        if (!hostApp) {
            this._hostApp = null;
        } else {
            this._hostApp = hostApp.trim();
        }
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * @return {String} The application name running the AUT.
     */
    getHostApp() {
        return this._hostApp;
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * @deprecated Only available for backward compatibility. See {@link #setBaselineEnvName(String)}.
     * @param baselineName {String} If specified, determines the baseline to compare with and disables automatic baseline inference.
     */
    setBaselineName(baselineName) {
        this._logger.log(`Baseline environment name: ${baselineName}`);

        if(!baselineName) {
            this._baselineEnvName = null;
        } else {
            this._baselineEnvName = baselineName.trim();
        }
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * @deprecated Only available for backward compatibility. See {@link #getBaselineEnvName()}.
     * @return {String} The baseline name, if it was specified.
     */
    getBaselineName() {
        return this._baselineEnvName;
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * If not {@code null}, determines the name of the environment of the baseline.
     *
     * @param baselineEnvName {String} The name of the baseline's environment.
     */
    setBaselineEnvName(baselineEnvName) {
        this._logger.log(`Baseline environment name: ${baselineEnvName}`);

        if(!baselineEnvName) {
            this._baselineEnvName = null;
        } else {
            this._baselineEnvName = baselineEnvName.trim();
        }
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * If not {@code null}, determines the name of the environment of the baseline.
     *
     * @return {String} The name of the baseline's environment, or {@code null} if no such name was set.
     */
    getBaselineEnvName() {
        return this._baselineEnvName;
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * If not {@code null} specifies a name for the environment in which the application under test is running.
     *
     * @param envName {String} The name of the environment of the baseline.
     */
    setEnvName(envName) {
        this._logger.log(`Environment name: ${envName}`);

        if(!envName) {
            this._environmentName = null;
        } else {
            this._environmentName = envName.trim();
        }
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * If not {@code null} specifies a name for the environment in which the application under test is running.
     *
     * @return {String} The name of the environment of the baseline, or {@code null} if no such name was set.
     */
    getEnvName() {
        return this._environmentName;
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * @return {PositionProvider} The currently set position provider.
     */
    getPositionProvider() {
        return this._positionProvider;
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * @param {PositionProvider} positionProvider The position provider to be used.
     */
    setPositionProvider(positionProvider) {
        this._positionProvider = positionProvider;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Takes a snapshot of the application under test and matches it with the expected output.
     *
     * @protected
     * @param {RegionProvider} regionProvider Returns the region to check or the empty rectangle to check the entire window.
     * @param {String} tag An optional tag to be associated with the snapshot.
     * @param {Boolean} ignoreMismatch Whether to ignore this check if a mismatch is found.
     * @param {CheckSettings} [checkSettings]  The settings to use.
     * @return {Promise<MatchResult>} The result of matching the output with the expected output.
     * @throws DiffsFoundError Thrown if a mismatch is detected and immediate failure reports are enabled.
     */
    checkWindowBase(regionProvider, tag = "", ignoreMismatch, checkSettings = new CheckSettings(EyesBase.USE_DEFAULT_TIMEOUT)) {
        if (this._isDisabled) {
            this._logger.verbose("Ignored");
            const result = new MatchResult();
            result.setAsExpected(true);
            return this._promiseFactory.resolve(result);
        }

        try {
            ArgumentGuard.isValidState(this._isOpen, "Eyes not open");
            ArgumentGuard.notNull(regionProvider, "regionProvider");
        } catch (err) {
            return this._promiseFactory.reject(err);
        }

        const that = this;
        let validationInfo, validationResult, matchResult;
        return this._ensureRunningSession().then(() => {
            validationInfo = new SessionEventHandler.ValidationInfo();
            // noinspection IncrementDecrementResultUsedJS
            validationInfo.setValidationId(++that._validationId);
            validationInfo.setTag(tag);

            // default result
            validationResult = new SessionEventHandler.ValidationResult();

            return that._notifyEvent('validationWillStart', that._autSessionId, validationInfo);
        }).then(() => {
            return that._matchWindow(regionProvider, tag, ignoreMismatch, checkSettings);
        }).then(result => {
            matchResult = result;
            that._logger.verbose("MatchWindow Done!");

            validationResult.setAsExpected(matchResult.getAsExpected());

            if (!ignoreMismatch) {
                that.clearUserInputs();
                that._lastScreenshot = matchResult.getScreenshot();
            }

            that._validateResult(tag, matchResult);

            that._logger.verbose("Done!");
            return that._notifyEvent('validationEnded', that._autSessionId, validationInfo.getValidationId(), validationResult);
        }).then(() => {
            return matchResult;
        });
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Replaces an actual image in the current running session.
     *
     * @param {Number} stepIndex The zero based index of the step in which to replace the actual image.
     * @param {Buffer} screenshot The PNG bytes of the updated screenshot.
     * @param {string} [tag] The updated tag for the step.
     * @param {string} [title] The updated title for the step.
     * @param {Array} [userInputs] The updated userInputs for the step.
     * @return {Promise<MatchResult>} A promise which resolves when replacing is done, or rejects on error.
     */
    replaceWindow(stepIndex, screenshot, tag = "", title = "", userInputs = []) {
        this._logger.verbose('EyesBase.replaceWindow - running');

        if (this._isDisabled) {
            this._logger.verbose("Ignored");
            const result = new MatchResult();
            result.setAsExpected(true);
            return this._promiseFactory.resolve(result);
        }

        try {
            ArgumentGuard.isValidState(this._isOpen, "Eyes not open");
        } catch (err) {
            return this._promiseFactory.reject(err);
        }

        this._logger.verbose("EyesBase.replaceWindow - calling serverConnector.replaceWindow");

        const that = this;
        return this._promiseFactory.makePromise((resolve, reject) => {
            const replaceWindowData = new MatchWindowData(userInputs, new AppOutput(title, screenshot), tag, null, null);
            return that._serverConnector.replaceWindow(that._runningSession, stepIndex, replaceWindowData).then(result => {
                that._logger.verbose("EyesBase.replaceWindow done");
                resolve(result);
            }, err => {
                that._logger.log(err);
                reject(err);
            });
        });
    }

    /**
     * @private
     * @param {RegionProvider} regionProvider
     * @param {String} tag
     * @param {Boolean} ignoreMismatch
     * @param {CheckSettings} checkSettings
     * @return {Promise.<MatchResult>}
     */
     _matchWindow(regionProvider, tag, ignoreMismatch, checkSettings) {
        const checkSettingsInternal = (checkSettings instanceof CheckSettings) ? checkSettings : null;

        let retryTimeout = -1;
        let imageMatchSettings = null;
        if (checkSettingsInternal) {
            retryTimeout = checkSettingsInternal.getTimeout();

            let matchLevel = checkSettingsInternal.getMatchLevel();
            matchLevel = !matchLevel ? this.getDefaultMatchSettings().getMatchLevel() : matchLevel;

            imageMatchSettings = new ImageMatchSettings(matchLevel, null);

            this._collectIgnoreRegions(checkSettingsInternal, imageMatchSettings);
            this._collectFloatingRegions(checkSettingsInternal, imageMatchSettings);

            let ignoreCaret = checkSettingsInternal.getIgnoreCaret();
            imageMatchSettings.setIgnoreCaret(!ignoreCaret ? this.getDefaultMatchSettings().getIgnoreCaret() : ignoreCaret);
        }

        // noinspection JSUnresolvedVariable
        this._logger.verbose(`CheckWindowBase(${regionProvider.constructor.name}, '${tag}', ${ignoreMismatch}, ${retryTimeout})`);

        this._logger.verbose("Calling match window...");
        return this._matchWindowTask.matchWindow(
            this.getUserInputs(), regionProvider.getRegion(),
            tag, this._shouldMatchWindowRunOnceOnTimeout,
            ignoreMismatch, imageMatchSettings,
            retryTimeout
        );
    }

    // noinspection JSMethodCanBeStatic
    /**
     * @private
     * @param {CheckSettings} checkSettings
     * @param {ImageMatchSettings} imageMatchSettings
     */
    _collectIgnoreRegions(checkSettings, imageMatchSettings) {
        /**
         * @type {Array<Region>}
         */
        const ignoreRegions = [];
        for (const ignoreRegionProvider in checkSettings.getIgnoreRegions()) {
            ignoreRegions.push(ignoreRegionProvider.getRegion());
        }
        imageMatchSettings.setIgnoreRegions(ignoreRegions);
    }

    // noinspection JSMethodCanBeStatic
    /**
     * @private
     * @param {CheckSettings} checkSettings
     * @param {ImageMatchSettings} imageMatchSettings
     */
    _collectFloatingRegions(checkSettings, imageMatchSettings) {
        /**
         * @type {Array<FloatingMatchSettings>}
         */
        const floatingRegions = [];
        for (const floatingRegionProvider in checkSettings.getFloatingRegions()) {
            floatingRegions.push(floatingRegionProvider.getRegion());
        }
        imageMatchSettings.setFloatingRegions(floatingRegions);
    }

    /**
     * @private
     * @param {String} tag
     * @param {MatchResult} result
     */
    _validateResult(tag, result) {
        if (result.getAsExpected()) {
            return;
        }

        this._shouldMatchWindowRunOnceOnTimeout = true;

        if (!this._runningSession.getIsNewSession()) {
            this._logger.log(`Mismatch! (${tag})`);
        }

        if (this.getFailureReports() === FailureReports.IMMEDIATE) {
            throw new TestFailedError(null, `Mismatch found in '${this._sessionStartInfo.getScenarioIdOrName()}' of '${this._sessionStartInfo.getAppIdOrName()}'`);
        }
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Starts a test.
     *
     * @protected
     * @param {String} appName      The name of the application under test.
     * @param {String} testName     The test name.
     * @param {RectangleSize} viewportSize The client's viewport size (i.e., the visible part
     *                     of the document's body) or {@code null} to allow
     *                     any viewport size.
     * @param {SessionType} sessionType  The type of test (e.g., Progression for timing
     *                     tests), or {@code null} to use the default.
     * @return {Promise}
     */
    openBase(appName, testName, viewportSize, sessionType) {
        this._logger.getLogHandler().open();

        try {
            if (this._isDisabled) {
                this._logger.verbose("Eyes Open ignored - disabled");
                return this._promiseFactory.resolve();
            }

            // If there's no default application name, one must be provided for the current test.
            if (!this._appName) {
                ArgumentGuard.notNull(appName, "appName");
            }

            ArgumentGuard.notNull(testName, "testName");

            this._logger.log(`Agent = ${this._getFullAgentId()}`);
            this._logger.verbose(`openBase('${appName}', '${testName}', '${viewportSize}')`);

            this._validateApiKey();
            this._logOpenBase();
            const that = this;
            return this._validateSessionOpen().then(() => {
                that._isViewportSizeSet = false;

                that._currentAppName = appName || that._appName;
                that._testName = testName;
                that._viewportSizeHandler.set(viewportSize);
                that._sessionType = sessionType || SessionType.SEQUENTIAL;
                that._scaleProviderHandler.set(new NullScaleProvider());
                that._validationId = -1;

                return that._ensureRunningSession();
            }).then(() => {
                return that.getAUTSessionId();
            }).then(autSessionId => {
                that._autSessionId = autSessionId;
                that._isOpen = true;
            });
        } catch (err) {
            this._logger.log(err);
            this._logger.getLogHandler().close();
            return this._promiseFactory.reject(err);
        }
    }

    /**
     * @private
     * @return {Promise}
     */
    _ensureRunningSession() {
        if (this._runningSession) {
            return this._promiseFactory.resolve();
        }

        const that =this;
        that._logger.log("No running session, calling start session...");
        return that.startSession().then(() => {
            that._logger.log("Done!");

            const outputProvider = new AppOutputProvider();
            // A callback which will call getAppOutput
            // noinspection AnonymousFunctionJS
            outputProvider.getAppOutput = (region, lastScreenshot) => {
                return that._getAppOutputWithScreenshot(region, lastScreenshot);
            };

            that._matchWindowTask = new MatchWindowTask(
                that._promiseFactory,
                that._logger,
                that._serverConnector,
                that._runningSession,
                that._matchTimeout,
                outputProvider
            );
        });
    }

    /**
     * @private
     */
    _validateApiKey() {
        if (!this.getApiKey()) {
            const errMsg = "API key is missing! Please set it using setApiKey()";
            this._logger.log(errMsg);
            throw new Error(errMsg);
        }
    }

    /**
     * @private
     */
    _logOpenBase() {
        this._logger.log(`Eyes server URL is '${this._serverConnector.getServerUrl()}'`);
        this._logger.verbose(`Timeout = '${this._serverConnector.getTimeout()}'`);
        this._logger.log(`matchTimeout = '${this._matchTimeout}'`);
        this._logger.log(`Default match settings = '${this._defaultMatchSettings}'`);
        this._logger.log(`FailureReports = '${this._failureReports}' `);
    }

    /**
     * @private
     * @return {Promise}
     */
    _validateSessionOpen() {
        if (this._isOpen) {
            return this.abortIfNotClosed().then(() => {
                const errMsg = "A test is already running";
                this._logger.log(errMsg);
                throw new Error(errMsg);
            });
        }

        return this._promiseFactory.resolve();
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Define the viewport size as {@code size} without doing any actual action on the
     *
     * @param {RectangleSize} explicitViewportSize The size of the viewport. {@code null} disables the explicit size.
     */
    setExplicitViewportSize(explicitViewportSize) {
        if(!explicitViewportSize) {
            this._viewportSizeHandler = new SimplePropertyHandler();
            this._viewportSizeHandler.set(null);
            this._isViewportSizeSet = false;
            return;
        }

        this._logger.verbose("Viewport size explicitly set to " + explicitViewportSize);
        this._viewportSizeHandler = new ReadOnlyPropertyHandler(logger, new RectangleSize(explicitViewportSize.getWidth(), explicitViewportSize.getHeight()));
        this._isViewportSizeSet = true;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Adds a trigger to the current list of user inputs.
     *
     * @protected
     * @param {Trigger} trigger The trigger to add to the user inputs list.
     */
    addUserInput(trigger) {
        if (this._isDisabled) {
            return;
        }

        ArgumentGuard.notNull(trigger, "trigger");
        this._userInputs.push(trigger);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Adds a text trigger.
     *
     * @protected
     * @param {Region} control The control's position relative to the window.
     * @param {String} text The trigger's text.
     */
    addTextTriggerBase(control, text) {
        if (this._isDisabled) {
            this._logger.verbose(`Ignoring '${text}' (disabled)`);
            return;
        }

        ArgumentGuard.notNull(control, "control");
        ArgumentGuard.notNull(text, "text");

        // We don't want to change the objects we received.
        control = Region.fromRegion(control);

        if (!this._lastScreenshot) {
            this._logger.verbose(`Ignoring '${text}' (no screenshot)`);
            return;
        }

        control = this._lastScreenshot.getIntersectedRegion(control, CoordinatesType.CONTEXT_RELATIVE, CoordinatesType.SCREENSHOT_AS_IS);
        if (control.isEmpty()) {
            this._logger.verbose(`Ignoring '${text}' (out of bounds)`);
            return;
        }

        const trigger = new TextTrigger(control, text);
        this._userInputs.push(trigger);

        this._logger.verbose(`Added ${trigger}`);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Adds a mouse trigger.
     *
     * @protected
     * @param {MouseTrigger.MouseAction} action  Mouse action.
     * @param {Region} control The control on which the trigger is activated (location is relative to the window).
     * @param {Location} cursor The cursor's position relative to the control.
     */
    addMouseTriggerBase(action, control, cursor) {
        if (this._isDisabled) {
            this._logger.verbose(`Ignoring ${action} (disabled)`);
            return;
        }

        ArgumentGuard.notNull(action, "action");
        ArgumentGuard.notNull(control, "control");
        ArgumentGuard.notNull(cursor, "cursor");

        // Triggers are actually performed on the previous window.
        if (!this._lastScreenshot) {
            this._logger.verbose(`Ignoring ${action} (no screenshot)`);
            return;
        }

        // Getting the location of the cursor in the screenshot
        let cursorInScreenshot = Location.fromLocation(cursor);
        // First we need to getting the cursor's coordinates relative to the context (and not to the control).
        cursorInScreenshot.offset(control.getLocation());
        try {
            cursorInScreenshot = this._lastScreenshot.getLocationInScreenshot(cursorInScreenshot, CoordinatesType.CONTEXT_RELATIVE);
        } catch (ignore) {
            this._logger.verbose(`"Ignoring ${action} (out of bounds)`);
            return;
        }

        const controlScreenshotIntersect = this._lastScreenshot.getIntersectedRegion(control, CoordinatesType.CONTEXT_RELATIVE, CoordinatesType.SCREENSHOT_AS_IS);

        // If the region is NOT empty, we'll give the coordinates relative to
        // the control.
        if (!controlScreenshotIntersect.isEmpty()) {
            const l = controlScreenshotIntersect.location;
            cursorInScreenshot.offset(-l.x, -l.y);
        }

        const trigger = new MouseTrigger(action, controlScreenshotIntersect, cursorInScreenshot);
        this._userInputs.push(trigger);
    }

    /**
     * Application environment is the environment (e.g., the host OS) which runs the application under test.
     *
     * @protected
     * @return {Promise.<AppEnvironment>} The current application environment.
     */
    getAppEnvironment() {
        const appEnv = new AppEnvironment();

        // If hostOS isn't set, we'll try and extract and OS ourselves.
        if (this._hostOS) {
            appEnv.setOs(this._hostOS);
        }

        if (this._hostApp) {
            appEnv.setHostingApp(this._hostApp);
        }

        const that = this;
        return this.getInferredEnvironment().then((inferred) => {
            appEnv.setInferred(inferred);
            appEnv.setDisplaySize(that._viewportSizeHandler.get());
            return appEnv;
        });
    }

    /**
     * Start eyes session on the eyes server.
     *
     * @protected
     * @return {Promise}
     */
    startSession() {
        this._logger.verbose("startSession()");

        if (this._runningSession) {
            return this._promiseFactory.resolve();
        }

        const that = this;
        let testBatch, appEnvironment;
        if (that._batch) {
            that._logger.verbose(`Batch is ${that._batch}`);
            testBatch = that._batch;
        } else {
            that._logger.verbose("No batch set");
            testBatch = new BatchInfo();
        }

        return that.getAUTSessionId().then(autSessionId => {
            that._autSessionId = autSessionId;
        }).then(() => {
            return that._notifyEvent('testStarted', that._autSessionId);
        }).then(() => {
            return that._notifyEvent('setSizeWillStart', that._autSessionId, that._viewportSize)
        }).then(() => {
            return that._ensureViewportSize()
        }).then(() => {
            return that._notifyEvent('setSizeEnded', that._autSessionId);
        }, err => {
            that._logger.log(err);
            return that._notifyEvent('setSizeEnded', that._autSessionId).then(() => {
                // Throw to skip execution of all consecutive "then" blocks.
                throw new Error('Failed to set/get viewport size.');
            });
        }).then(() => {
            return that._notifyEvent('initStarted', that._autSessionId);
        }).then(() => {
            return that.getAppEnvironment();
        }).then(appEnv => {
            appEnvironment = appEnv;
            that._logger.verbose(`Application environment is ${appEnvironment}`);
            return that._notifyEvent('initEnded', that._autSessionId);
        }).then(() => {
            that._sessionStartInfo = new SessionStartInfo(that.getBaseAgentId(), that._sessionType,
                that.getAppName(), null, that._testName, testBatch, that._baselineEnvName, that._environmentName, appEnvironment,
                that._defaultMatchSettings, that._branchName, that._parentBranchName, that._properties);

            that._logger.verbose("Starting server session...");
            return that._serverConnector.startSession(that._sessionStartInfo);
        }).then(runningSession => {
            that._runningSession = runningSession;
            that._logger.verbose(`Server session ID is ${that._runningSession.getId()}`);

            const testInfo = `'${testName}' of '${that.getAppName()}' "${appEnvironment}`;
            if (that._runningSession.getIsNewSession()) {
                that._logger.log(`--- New test started - ${testInfo}`);
                that._shouldMatchWindowRunOnceOnTimeout = true;
            } else {
                that._logger.log(`--- Test started - ${testInfo}`);
                that._shouldMatchWindowRunOnceOnTimeout = false;
            }
        });
    }

    /**
     * @private
     * @return {Promise}
     */
    _ensureViewportSize() {
        if (!this._isViewportSizeSet) {
            try {
                if (this._viewportSizeHandler.get()) {
                    return this.setViewportSize(this._viewportSizeHandler.get());
                } else {
                    const that = this;
                    // If it's read-only, no point in making the getViewportSize() call..
                    if (!(this._viewportSizeHandler instanceof ReadOnlyPropertyHandler)) {
                        return this.getViewportSize().then(viewportSize => {
                            that._viewportSizeHandler.set(viewportSize);
                        });
                    }
                }

                this._isViewportSizeSet = true;
            } catch (ignored) {
                this._isViewportSizeSet = false;
            }
        }

        return this._promiseFactory.resolve();
    }

    /**
     * @private
     * @param {Region} region A callback for getting the region of the screenshot which will be set in the application output.
     * @param {EyesScreenshot} lastScreenshot Previous application screenshot (used for compression) or {@code null} if not available.
     * @return {Promise<AppOutputWithScreenshot>} The updated app output and screenshot.
     */
     _getAppOutputWithScreenshot(region, lastScreenshot) {
        const that = this;
        that._logger.verbose("getting screenshot...");
        // Getting the screenshot (abstract function implemented by each SDK).
        let scr, compressedScr;
        return that.getScreenshot().then(screenshot => {
            that._logger.verbose("Done getting screenshot!");

            // Cropping by region if necessary
            if (!region.isEmpty()) {
                return screenshot.getSubScreenshot(region, false);
            }
            return screenshot;
        }).then(screenshot => {
            scr = screenshot;
            return that._debugScreenshotsProvider.save(screenshot.getImage(), "SUB_SCREENSHOT");
        }).then(() => {
            that._logger.verbose("Compressing screenshot...");
            return that._compressScreenshot64(scr, lastScreenshot);
        }).then(compressedScreenshot => {
            compressedScr = compressedScreenshot;
            that._logger.verbose("Done! Getting title...");
            return that.getTitle();
        }).then(title => {
            that._logger.verbose("Done!");
            const result = new AppOutputWithScreenshot(new AppOutput(title, compressedScr), scr);
            that._logger.verbose("Done!");
            return result;
        });
    }

    /**
     * Compresses a given screenshot.
     *
     * @private
     * @param {EyesScreenshot} screenshot The screenshot to compress.
     * @param {EyesScreenshot} lastScreenshot The previous screenshot, or null.
     * @return {Promise<Buffer>} A base64 encoded compressed screenshot.
     */
    _compressScreenshot64(screenshot, lastScreenshot) {
        ArgumentGuard.notNull(screenshot, "screenshot");

        let targetData, sourceData;
        return this._promiseFactory.makePromise(resolve => {
            if (lastScreenshot) {
                return lastScreenshot.getImage().getImageData().then(imageData => {
                    sourceData = imageData;
                    return screenshot.getImage().getImageData();
                }).then(imageData => {
                    targetData = imageData;
                    resolve();
                });
            } else {
                resolve();
            }
        }).then(() => {
            return screenshot.getImage().getImageBuffer();
        }).then(targetBuffer => {
            try {
                return ImageDeltaCompressor.compressByRawBlocks(targetData, targetBuffer, sourceData);
            } catch (err) {
                throw new Error(`Failed to compress screenshot! ${err}`);
            }
        });
    }

    // noinspection JSUnusedGlobalSymbols
    addSessionEventHandler(eventHandler) {
        eventHandler.promiseFactory = this._promiseFactory;
        this._sessionEventHandlers.push(eventHandler);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Whether sessions are removed immediately after they are finished.
     *
     * @param shouldRemove {Boolean}
     */
    setRemoveSession(shouldRemove) {
        this._serverConnector.setRemoveSession(shouldRemove);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * @return {Boolean} Whether sessions are removed immediately after they are finished.
     */
    getRemoveSession() {
        return this._serverConnector.getRemoveSession();
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Activate/Deactivate HTTP client debugging.
     *
     * @param {Boolean} isDebug Whether or not debug mode is active.
     */
    setDebugMode(isDebug) {
        this._serverConnector.setDebugMode(isDebug);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * @return {Boolean} Whether or not HTTP client debugging mode is active.
     */
    getIsDebugMode() {
        return this._serverConnector.getIsDebugMode();
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * @return {?String} The name of the currently running test.
     */
    getTestName() {
        return this._testName;
    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * @return {RunningSession} An object containing data about the currently running session.
     */
    getRunningSession() {
        return this._runningSession;
    }

    // noinspection JSMethodCanBeStatic
    /**
     * @protected
     * @abstract
     * @return {String} The base agent id of the SDK.
     */
    getBaseAgentId() {
        throw new TypeError('getBaseAgentId method is not implemented!');
    }

    // noinspection JSMethodCanBeStatic
    /**
     * @protected
     * @abstract
     * Get the session id.
     * @return {Promise<String>} A promise which resolves to the webdriver's session ID.
     */
    getAUTSessionId() {
        throw new TypeError('getAUTSessionId method is not implemented!');
    }

    // noinspection JSMethodCanBeStatic
    /**
     * The viewport size of the AUT.
     *
     * @protected
     * @abstract
     * @return {Promise.<RectangleSize>}
     */
    getViewportSize() {
        throw new TypeError('getViewportSize method is not implemented!');
    }

    // noinspection JSMethodCanBeStatic
    /**
     * @protected
     * @abstract
     * @param {RectangleSize} size The required viewport size.
     * @return {Promise.<void>}
     */
    setViewportSize(size) {
        throw new TypeError('setViewportSize method is not implemented!');
    }

    // noinspection JSMethodCanBeStatic
    /**
     * @protected
     * @abstract
     * @return {Promise.<String>} The inferred environment string or {@code null} if none is available.
     * The inferred string is in the format "source:info" where source is either "useragent" or "pos".
     * Information associated with a "useragent" source is a valid browser user agent string. Information
     * associated with a "pos" source is a string of the format "process-name;os-name" where "process-name"
     * is the name of the main module of the executed process and "os-name" is the OS name.
     */
    getInferredEnvironment() {
        throw new TypeError('getInferredEnvironment method is not implemented!');
    }

    // noinspection JSMethodCanBeStatic
    /**
     * An updated screenshot.
     *
     * @protected
     * @abstract
     * @return {Promise.<EyesScreenshot>}
     */
    getScreenshot() {
        throw new TypeError('getScreenshot method is not implemented!');
    }

    // noinspection JSMethodCanBeStatic
    /**
     * The current title of of the AUT.
     *
     * @protected
     * @abstract
     * @return {Promise.<String>}
     */
    getTitle() {
        throw new TypeError('getTitle method is not implemented!');
    }

}

module.exports = EyesBase;
