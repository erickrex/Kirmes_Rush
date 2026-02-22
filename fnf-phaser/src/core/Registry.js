/**
 * @fileoverview Registry - Base class for data registries in Friday Night Funkin'
 * A generic registry pattern for loading and caching game data from JSON files.
 *
 * Ported from source/funkin/data/BaseRegistry.hx
 */

/**
 * @typedef {Object} RegistryEntry
 * @property {string} id - Unique identifier for the entry
 * @property {function(): void} [destroy] - Optional cleanup function
 */

/**
 * @typedef {Object} JsonFile
 * @property {string} fileName - Path to the JSON file
 * @property {string} contents - Raw JSON string contents
 */

/**
 * Base class for all data registries.
 * Provides common functionality for loading, caching, and retrieving game data.
 *
 * Subclasses should implement:
 * - `parseEntryData(id)` - Parse JSON and create entry object
 * - `createEntry(id, data)` - Create entry instance from parsed data
 *
 * @template T - The entry type (must have an `id` property)
 * @template J - The JSON data type
 */
class Registry {
  /**
   * The ID of the registry. Used when logging.
   * @type {string}
   */
  registryId;

  /**
   * The path (relative to assets/data) to search for JSON files.
   * @type {string}
   */
  dataFilePath;

  /**
   * A map of entry IDs to entries.
   * @type {Map<string, T>}
   */
  entries;

  /**
   * Whether the registry has been loaded.
   * @type {boolean}
   */
  loaded;

  /**
   * The version rule to use when loading entries.
   * @type {string}
   */
  versionRule;

  /**
   * Create a new Registry instance.
   * @param {string} registryId - A readable ID for this registry, used when logging
   * @param {string} dataFilePath - The path (relative to assets/data) to search for JSON files
   * @param {string} [versionRule='1.0.x'] - The version rule for data validation
   */
  constructor(registryId, dataFilePath, versionRule = '1.0.x') {
    this.registryId = registryId;
    this.dataFilePath = dataFilePath;
    this.versionRule = versionRule;
    this.entries = new Map();
    this.loaded = false;
  }

  // ========================================
  // LOADING METHODS
  // ========================================

  /**
   * Load all entries from the data path.
   * This is a synchronous version that expects data to already be available.
   * @param {string[]} entryIds - List of entry IDs to load
   */
  loadEntries(entryIds) {
    this.clearEntries();

    this._log(`Parsing ${entryIds.length} entries...`);

    for (const entryId of entryIds) {
      try {
        const data = this.parseEntryData(entryId);
        if (data !== null) {
          const entry = this.createEntry(entryId, data);
          if (entry !== null) {
            this.entries.set(entry.id, entry);
            this._log(`  Loaded entry: ${entry.id}`);
          }
        }
      } catch (e) {
        console.error(`[${this.registryId}] Failed to load entry: ${entryId}`, e);
      }
    }

    this.loaded = true;
    this._log(`Loaded ${this.entries.size} entries`);
  }

  /**
   * Load all entries asynchronously using Phaser's loader.
   * @param {Phaser.Scene} scene - The Phaser scene to use for loading
   * @param {string[]} entryIds - List of entry IDs to load
   * @returns {Promise<void>}
   */
  async loadEntriesAsync(scene, entryIds) {
    this.clearEntries();

    this._log(`Loading ${entryIds.length} entries asynchronously...`);

    const loadPromises = entryIds.map(async (entryId) => {
      try {
        const data = await this.loadEntryDataAsync(scene, entryId);
        if (data !== null) {
          const entry = this.createEntry(entryId, data);
          if (entry !== null) {
            this.entries.set(entry.id, entry);
            this._log(`  Loaded entry: ${entry.id}`);
          }
        }
      } catch (e) {
        console.error(`[${this.registryId}] Failed to load entry: ${entryId}`, e);
      }
    });

    await Promise.all(loadPromises);

    this.loaded = true;
    this._log(`Loaded ${this.entries.size} entries`);
  }

  /**
   * Load entry data asynchronously.
   * @param {Phaser.Scene} scene - The Phaser scene to use for loading
   * @param {string} id - The entry ID
   * @returns {Promise<J | null>}
   */
  async loadEntryDataAsync(scene, id) {
    const filePath = `${this.dataFilePath}/${id}.json`;

    return new Promise((resolve, reject) => {
      // Check if already loaded in cache
      if (scene.cache.json.exists(filePath)) {
        const data = scene.cache.json.get(filePath);
        resolve(this.parseEntryDataRaw(data, filePath));
        return;
      }

      // Load the JSON file
      scene.load.json(filePath, filePath);

      scene.load.once('filecomplete-json-' + filePath, () => {
        const data = scene.cache.json.get(filePath);
        resolve(this.parseEntryDataRaw(data, filePath));
      });

      scene.load.once('loaderror', (file) => {
        if (file.key === filePath) {
          reject(new Error(`Failed to load: ${filePath}`));
        }
      });

      scene.load.start();
    });
  }

  // ========================================
  // ENTRY ACCESS METHODS
  // ========================================

  /**
   * Fetch an entry by its ID.
   * @param {string} id - The ID of the entry to fetch
   * @returns {T | null} The entry, or null if it does not exist
   */
  fetchEntry(id) {
    return this.entries.get(id) ?? null;
  }

  /**
   * Return whether the registry has an entry with the given ID.
   * @param {string} id - The ID of the entry
   * @returns {boolean} True if the entry exists
   */
  hasEntry(id) {
    return this.entries.has(id);
  }

  /**
   * Retrieve a list of all entry IDs in this registry.
   * @returns {string[]} The list of entry IDs
   */
  listEntryIds() {
    return Array.from(this.entries.keys());
  }

  /**
   * Count the number of entries in this registry.
   * @returns {number} The number of entries
   */
  countEntries() {
    return this.entries.size;
  }

  /**
   * Get all entries as an array.
   * @returns {T[]} Array of all entries
   */
  getAllEntries() {
    return Array.from(this.entries.values());
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Clear all entries from the registry.
   */
  clearEntries() {
    for (const entry of this.entries.values()) {
      if (entry && typeof entry.destroy === 'function') {
        entry.destroy();
      }
    }
    this.entries.clear();
    this.loaded = false;
  }

  /**
   * Load a JSON file and return its contents.
   * @param {string} id - The entry ID
   * @returns {JsonFile} The file path and contents
   */
  loadEntryFile(id) {
    const filePath = `${this.dataFilePath}/${id}.json`;
    // In browser context, this would need to be loaded via fetch or Phaser's loader
    // This is a placeholder for synchronous access when data is pre-loaded
    return {
      fileName: filePath,
      contents: ''
    };
  }

  /**
   * Fetch the version from entry data.
   * @param {Object} data - The parsed JSON data
   * @returns {string | null} The version string, or null if not found
   */
  fetchEntryVersion(data) {
    if (data && typeof data.version === 'string') {
      return data.version;
    }
    return null;
  }

  /**
   * Validate a version string against the registry's version rule.
   * Simple semver-like validation.
   * @param {string} version - The version to validate
   * @returns {boolean} True if the version is valid
   */
  validateVersion(version) {
    if (!version || !this.versionRule) {
      return true;
    }

    // Simple version validation (major.minor.x pattern)
    const versionParts = version.split('.');
    const ruleParts = this.versionRule.split('.');

    if (versionParts.length < 2 || ruleParts.length < 2) {
      return false;
    }

    // Check major version
    if (ruleParts[0] !== 'x' && ruleParts[0] !== versionParts[0]) {
      return false;
    }

    // Check minor version
    if (ruleParts[1] !== 'x' && ruleParts[1] !== versionParts[1]) {
      return false;
    }

    return true;
  }

  /**
   * Get a string representation of the registry.
   * @returns {string}
   */
  toString() {
    return `Registry(${this.registryId}, ${this.countEntries()} entries)`;
  }

  // ========================================
  // ABSTRACT METHODS (to be implemented by subclasses)
  // ========================================

  /**
   * Read, parse, and validate the JSON data and produce the corresponding data object.
   * Must be implemented by subclasses.
   * @param {string} _id - The ID of the entry
   * @returns {J | null} The parsed data, or null if parsing failed
   * @abstract
   */
  parseEntryData(_id) {
    throw new Error(`[${this.registryId}] parseEntryData() must be implemented by subclass`);
  }

  /**
   * Parse and validate raw JSON data.
   * Must be implemented by subclasses.
   * @param {Object} _data - The parsed JSON object
   * @param {string} [_fileName] - Optional file name for error reporting
   * @returns {J | null} The validated data, or null if validation failed
   * @abstract
   */
  parseEntryDataRaw(_data, _fileName) {
    throw new Error(`[${this.registryId}] parseEntryDataRaw() must be implemented by subclass`);
  }

  /**
   * Create an entry instance from the parsed data.
   * Must be implemented by subclasses.
   * @param {string} _id - The entry ID
   * @param {J} _data - The parsed data
   * @returns {T | null} The created entry, or null if creation failed
   * @abstract
   */
  createEntry(_id, _data) {
    throw new Error(`[${this.registryId}] createEntry() must be implemented by subclass`);
  }

  // ========================================
  // PRIVATE METHODS
  // ========================================

  /**
   * Log a message with the registry ID prefix.
   * @param {string} message - The message to log
   * @private
   */
  _log(message) {
    // eslint-disable-next-line no-console
    console.log(`[${this.registryId}] ${message}`);
  }
}

export default Registry;
