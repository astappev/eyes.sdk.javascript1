'use strict';

const ArgumentGuard = require('../ArgumentGuard');
const Trigger = require('./Trigger');

/**
 * Encapsulates a text input by the user.
 */
class MouseTrigger extends Trigger {

    // noinspection JSUnusedGlobalSymbols, LocalVariableNamingConventionJS
    /**
     * @readonly
     * @enum {String}
     */
    static get MouseAction () {
      return {
        None: 'None',
        Click: 'Click',
        RightClick: 'RightClick',
        DoubleClick: 'DoubleClick',
        Move: 'Move',
        Down: 'Down',
        Up: 'Up'
      };
    }

    /**
     *
     * @param {MouseTrigger.MouseAction} mouseAction
     * @param {Region} control
     * @param {Location} location
     */
    constructor(mouseAction, control, location) {
        super();

        ArgumentGuard.notNull(mouseAction, "mouseAction");
        ArgumentGuard.notNull(control, "control");

        this._mouseAction = mouseAction;
        this._control = control;
        this._location = location; // Relative to the top left corner of {@link #control}, or null if unknown.
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * @return {MouseTrigger.MouseAction}
     */
    getMouseAction() {
        return this._mouseAction;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * @return {Region}
     */
    getControl() {
        return this._control;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * @return {Location}
     */
    getLocation() {
        return this._location;
    }

    // noinspection JSMethodCanBeStatic, JSUnusedGlobalSymbols
    /**
     * @return {Trigger.TriggerType}
     */
    getTriggerType() {
        return Trigger.TriggerType.Mouse;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * @return {String}
     */
    toString() {
        return `${this._mouseAction} [${this._control}] ${this._location}`;
    }
}

Object.freeze(MouseTrigger.MouseAction);
module.exports = MouseTrigger;
