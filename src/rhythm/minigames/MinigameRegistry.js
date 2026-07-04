/**
 * @fileoverview MinigameRegistry - maps a Minigame_Definition `id` to its
 * Minigame_Controller class and validates data-driven Minigame_Definition JSON
 * documents before they are used by the Rhythm_Framework.
 *
 * See `.kiro/specs/rhythm-minigame-prototype/design.md`
 * (MinigameRegistry + Cue_Action_Dispatch section) for the interface contract.
 * Satisfies Requirement 11:
 *  - R11.1 validate id, name, bpm|song reference, allowed gestures, timeline;
 *  - R11.2 reject invalid definitions with a descriptive field-level error;
 *  - R11.3 map a valid definition's id to its Minigame_Controller class;
 *  - R11.6 {@link dispatchCueAction} throws a descriptive error naming the
 *    missing controller method (and cue) for an unresolved action string.
 */

/**
 * @typedef {import('../../types.js').MinigameDefinition} MinigameDefinition
 * @typedef {import('../../types.js').MinigameInputConfig} MinigameInputConfig
 */

/**
 * Outcome of validating a Minigame_Definition.
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether the definition passed validation.
 * @property {string[]} errors - Field-level error messages (empty when valid).
 */

/**
 * Test whether a value is a non-empty string.
 * @param {*} value - Value to test.
 * @returns {boolean} True when `value` is a string with length > 0.
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Registry mapping Minigame_Definition ids to controller classes, plus JSON
 * definition loading + validation. Intentionally simpler than the config-driven
 * {@link createRegistry}: it is an id -> class map with schema validation.
 */
class MinigameRegistry {
  constructor() {
    /**
     * Map of minigame id -> Minigame_Controller class.
     * @type {Map<string, Function>}
     * @private
     */
    this._controllers = new Map();

    /**
     * Map of minigame id -> validated Minigame_Definition.
     * @type {Map<string, MinigameDefinition>}
     * @private
     */
    this._definitions = new Map();
  }

  /**
   * Register a Minigame_Controller class under a minigame id (R11.3).
   * @param {string} id - Unique minigame identifier.
   * @param {Function} controllerClass - The Minigame_Controller class constructor.
   * @returns {void}
   * @throws {Error} When `id` is not a non-empty string or `controllerClass` is not a function.
   */
  register(id, controllerClass) {
    if (!isNonEmptyString(id)) {
      throw new Error('MinigameRegistry.register: id must be a non-empty string');
    }
    if (typeof controllerClass !== 'function') {
      throw new Error(
        `MinigameRegistry.register: controllerClass for "${id}" must be a class/function`
      );
    }
    this._controllers.set(id, controllerClass);
  }

  /**
   * Return the Minigame_Controller class registered for an id (R11.3).
   * @param {string} id - Minigame identifier.
   * @returns {Function|undefined} The registered controller class, or undefined when none.
   */
  getControllerClass(id) {
    return this._controllers.get(id);
  }

  /**
   * Return a previously loaded + validated Minigame_Definition for an id.
   * @param {string} id - Minigame identifier.
   * @returns {MinigameDefinition|undefined} The stored definition, or undefined when none.
   */
  getDefinition(id) {
    return this._definitions.get(id);
  }

  /**
   * Validate a Minigame_Definition (R11.1). A valid definition must contain:
   *  - `id` — non-empty string;
   *  - `name` — non-empty string;
   *  - a tempo source — a numeric `bpm` OR a `song` reference with a non-empty `song.id`;
   *  - `input.allowedGestures` — a non-empty array of gesture strings;
   *  - `timeline` — an array of entries.
   *
   * Each failing check contributes a descriptive, field-level error (R11.2).
   * @param {MinigameDefinition|*} def - Candidate definition object.
   * @returns {ValidationResult} `{ valid, errors }`.
   */
  validate(def) {
    /** @type {string[]} */
    const errors = [];

    if (def === null || typeof def !== 'object') {
      return {
        valid: false,
        errors: ['definition: expected an object']
      };
    }

    if (!isNonEmptyString(def.id)) {
      errors.push('id: required non-empty string');
    }

    if (!isNonEmptyString(def.name)) {
      errors.push('name: required non-empty string');
    }

    // Tempo source: a numeric bpm override OR a song reference resolving BPM.
    const hasBpm = typeof def.bpm === 'number' && Number.isFinite(def.bpm) && def.bpm > 0;
    const hasSong =
      def.song !== null && typeof def.song === 'object' && isNonEmptyString(def.song.id);
    if (!hasBpm && !hasSong) {
      errors.push('bpm|song: require a positive numeric "bpm" or a "song.id" reference');
    }

    // Allowed gestures: input.allowedGestures must be a non-empty string array.
    const input = def.input;
    if (input === null || typeof input !== 'object') {
      errors.push('input: required object with allowedGestures');
    } else if (!Array.isArray(input.allowedGestures)) {
      errors.push('input.allowedGestures: required array of gesture strings');
    } else if (input.allowedGestures.length === 0) {
      errors.push('input.allowedGestures: must list at least one gesture');
    } else if (!input.allowedGestures.every(isNonEmptyString)) {
      errors.push('input.allowedGestures: every entry must be a non-empty string');
    }

    if (!Array.isArray(def.timeline)) {
      errors.push('timeline: required array of cue/expect entries');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Fetch a Minigame_Definition JSON document, validate it (R11.1/R11.2), and
   * store it keyed by its id on success.
   *
   * @param {string} id - Minigame identifier; also selects the JSON document path.
   * @param {typeof fetch} [fetchImpl] - Injectable fetch implementation
   *   (defaults to the global `fetch`); enables testing without a network.
   * @returns {Promise<MinigameDefinition>} The validated definition.
   * @throws {Error} When no fetch implementation is available, the document
   *   cannot be fetched, or validation fails (message lists the field errors).
   */
  async loadDefinition(id, fetchImpl) {
    if (!isNonEmptyString(id)) {
      throw new Error('MinigameRegistry.loadDefinition: id must be a non-empty string');
    }

    const doFetch = fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
    if (typeof doFetch !== 'function') {
      throw new Error(
        `MinigameRegistry.loadDefinition: no fetch implementation available for "${id}"`
      );
    }

    const url = `assets/data/rhythm/minigames/${id}.json`;
    const response = await doFetch(url);
    if (!response || response.ok === false) {
      const status = response ? response.status : 'unknown';
      throw new Error(
        `MinigameRegistry.loadDefinition: failed to fetch "${url}" (status ${status})`
      );
    }

    /** @type {MinigameDefinition} */
    const def = await response.json();

    const { valid, errors } = this.validate(def);
    if (!valid) {
      throw new Error(
        `MinigameRegistry.loadDefinition: invalid definition "${id}": ${errors.join('; ')}`
      );
    }

    this._definitions.set(def.id, def);
    return def;
  }
}

/**
 * Cue_Action_Dispatch (R11.5/R11.6): resolve an `action` / `onPerfect` /
 * `onGood` / `onBarely` / `onMiss` string to a method on the active
 * Minigame_Controller and invoke it with `payload`.
 *
 * @param {Object<string, *>} controller - The active Minigame_Controller instance.
 * @param {string} actionName - The method name to dispatch to.
 * @param {*} [payload] - Argument forwarded to the resolved controller method.
 * @returns {*} The return value of the invoked controller method.
 * @throws {Error} With a descriptive message naming the missing method (and, when
 *   available, the cue via `payload.cueId`/`payload.id`) when the controller has
 *   no matching method (R11.6).
 */
function dispatchCueAction(controller, actionName, payload) {
  if (controller === null || typeof controller !== 'object') {
    throw new Error(`dispatchCueAction: no controller to dispatch action "${actionName}" to`);
  }

  const method = controller[actionName];
  if (typeof method !== 'function') {
    const cueId =
      payload !== null && typeof payload === 'object' ? (payload.cueId ?? payload.id) : undefined;
    const cueSuffix = isNonEmptyString(cueId) ? ` (cue "${cueId}")` : '';
    const controllerName = controller.constructor?.name ?? 'controller';
    throw new Error(
      `dispatchCueAction: ${controllerName} has no method "${actionName}"${cueSuffix}`
    );
  }

  return method.call(controller, payload);
}

export default MinigameRegistry;
export { MinigameRegistry, dispatchCueAction };
