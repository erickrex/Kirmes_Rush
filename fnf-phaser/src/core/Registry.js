/**
 * @fileoverview Registry - Base class and factory for data registries in Friday Night Funkin'
 * A generic registry pattern for loading and caching game data from JSON files.
 *
 * Supports two modes:
 * 1. Config-driven: Pass a config object with clean/create/validate functions
 * 2. Subclass: Extend Registry and override abstract methods (legacy)
 *
 * Ported from source/funkin/data/BaseRegistry.hx
 */

/** @import { RegistryConfig, RegistryEntryBase } from '../types.js' */

/**
 * @typedef {Object} JsonFile
 * @property {string} fileName - Path to the JSON file
 * @property {string} contents - Raw JSON string contents
 */

/**
 * Base class for all data registries.
 * Provides common functionality for loading, caching, and retrieving game data.
 *
 * Can be used directly with a config object (config-driven) or subclassed (legacy).
 *
 * @template {RegistryEntryBase} T - The entry type (must have an `id` property)
 * @template {Record<string, any>} J - The JSON data type
 */
class Registry {
  /** @type {string} */
  registryId;

  /** @type {string} */
  dataFilePath;

  /** @type {Map<string, T>} */
  entries;

  /** @type {boolean} */
  loaded;

  /** @type {string} */
  versionRule;

  /**
   * Optional config for config-driven registries.
   * @type {RegistryConfig | null}
   * @private
   */
  _config = null;

  /**
   * Create a new Registry instance.
   * @param {string | RegistryConfig} registryIdOrConfig - A readable ID or a config object
   * @param {string} [dataFilePath] - The path (relative to assets/data) to search for JSON files
   * @param {string} [versionRule='1.0.x'] - The version rule for data validation
   */
  constructor(registryIdOrConfig, dataFilePath, versionRule = '1.0.x') {
    if (typeof registryIdOrConfig === 'object' && registryIdOrConfig !== null) {
      // Config-driven mode
      const config = registryIdOrConfig;
      this.registryId = config.registryId;
      this.dataFilePath = config.dataFilePath;
      this.versionRule = config.versionRule || '1.0.x';
      this._config = config;
    } else {
      // Legacy subclass mode
      this.registryId = registryIdOrConfig;
      this.dataFilePath = dataFilePath || '';
      this.versionRule = versionRule;
    }
    this.entries = new Map();
    this.loaded = false;
  }

  // ========================================
  // LOADING METHODS
  // ========================================

  /**
   * Load all entries from the data path.
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
          if (entry !== null && entry !== undefined && entry.id) {
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

    const missingEntryIds = entryIds.filter((entryId) => {
      const filePath = `${this.dataFilePath}/${entryId}.json`;
      return !scene.cache.json.exists(filePath);
    });
    const loadPromises = entryIds.map((entryId) =>
      this.loadEntryDataAsync(scene, entryId, { startLoader: false })
    );

    if (missingEntryIds.length > 0) {
      scene.load.start();
    }

    const results = await Promise.allSettled(loadPromises);
    results.forEach((result, index) => {
      const entryId = entryIds[index];
      if (!entryId) {
        return;
      }

      try {
        if (result.status === 'rejected') {
          throw result.reason;
        }

        const data = result.value;
        if (data !== null) {
          const entry = this.createEntry(entryId, data);
          if (entry !== null && entry !== undefined && entry.id) {
            this.entries.set(entry.id, entry);
            this._log(`  Loaded entry: ${entry.id}`);
          }
        }
      } catch (e) {
        console.error(`[${this.registryId}] Failed to load entry: ${entryId}`, e);
      }
    });

    this.loaded = true;
    this._log(`Loaded ${this.entries.size} entries`);
  }

  /**
   * Load entry data asynchronously.
   * @param {Phaser.Scene} scene - The Phaser scene to use for loading
   * @param {string} id - The entry ID
   * @param {{ startLoader?: boolean }} [options]
   * @returns {Promise<J | null>}
   */
  async loadEntryDataAsync(scene, id, options = {}) {
    const { startLoader = true } = options;
    const filePath = `${this.dataFilePath}/${id}.json`;

    return new Promise((resolve, reject) => {
      if (scene.cache.json.exists(filePath)) {
        const data = scene.cache.json.get(filePath);
        resolve(this.parseEntryDataRaw(data, filePath));
        return;
      }

      const cleanup = () => {
        scene.load.off('filecomplete-json-' + filePath, onComplete);
        scene.load.off('loaderror', onError);
      };

      const onComplete = () => {
        cleanup();
        try {
          const data = scene.cache.json.get(filePath);
          resolve(this.parseEntryDataRaw(data, filePath));
        } catch (error) {
          reject(error);
        }
      };

      const onError = (/** @type {Phaser.Loader.File} */ file) => {
        if (file.key !== filePath) {
          return;
        }

        cleanup();
        reject(new Error(`Failed to load: ${filePath}`));
      };

      scene.load.json(filePath, filePath);

      scene.load.once('filecomplete-json-' + filePath, onComplete);
      scene.load.on('loaderror', onError);

      if (startLoader) {
        scene.load.start();
      }
    });
  }

  // ========================================
  // ENTRY ACCESS METHODS
  // ========================================

  /**
   * Fetch an entry by its ID.
   * @param {string} id
   * @returns {T | null}
   */
  fetchEntry(id) {
    return this.entries.get(id) ?? null;
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  hasEntry(id) {
    return this.entries.has(id);
  }

  /** @returns {string[]} */
  listEntryIds() {
    return Array.from(this.entries.keys());
  }

  /** @returns {number} */
  countEntries() {
    return this.entries.size;
  }

  /** @returns {T[]} */
  getAllEntries() {
    return Array.from(this.entries.values());
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

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
   * @param {string} id
   * @returns {JsonFile}
   */
  loadEntryFile(id) {
    const filePath = `${this.dataFilePath}/${id}.json`;
    return { fileName: filePath, contents: '' };
  }

  /**
   * @param {Record<string, any>} data
   * @returns {string | null}
   */
  fetchEntryVersion(data) {
    if (data && typeof data.version === 'string') {
      return data.version;
    }
    return null;
  }

  /**
   * Validate a version string against the registry's version rule.
   * @param {string} version
   * @returns {boolean}
   */
  validateVersion(version) {
    if (!version || !this.versionRule) {
      return true;
    }

    const versionParts = version.split('.');
    const ruleParts = this.versionRule.split('.');

    if (versionParts.length < 2 || ruleParts.length < 2) {
      return false;
    }

    if (ruleParts[0] !== 'x' && ruleParts[0] !== versionParts[0]) {
      return false;
    }

    if (ruleParts[1] !== 'x' && ruleParts[1] !== versionParts[1]) {
      return false;
    }

    return true;
  }

  /** @returns {string} */
  toString() {
    return `Registry(${this.registryId}, ${this.countEntries()} entries)`;
  }

  // ========================================
  // ABSTRACT / CONFIG-DRIVEN METHODS
  // ========================================

  /**
   * Parse entry data by ID. Config-driven registries return null (use parseEntryDataRaw).
   * @param {string} _id
   * @returns {J | null}
   */
  parseEntryData(_id) {
    if (this._config) {
      console.warn(`[${this.registryId}] parseEntryData called without data for: ${_id}`);
      return null;
    }
    throw new Error(`[${this.registryId}] parseEntryData() must be implemented by subclass`);
  }

  /**
   * Parse and validate raw JSON data.
   * Config-driven registries use the config's validateData + cleanData functions.
   * @param {Record<string, any>} _data
   * @param {string} [_fileName]
   * @returns {J | null}
   */
  parseEntryDataRaw(_data, _fileName) {
    if (this._config) {
      if (!_data || typeof _data !== 'object') {
        console.error(`[${this.registryId}] Invalid data for: ${_fileName}`);
        return null;
      }

      // Version validation
      const version = _data.version;
      if (version && !this.validateVersion(version)) {
        console.error(`[${this.registryId}] Incompatible version ${version} for: ${_fileName}`);
        return null;
      }

      // Custom validation
      if (this._config.validateData && !this._config.validateData.call(this, _data, _fileName)) {
        return null;
      }

      // Clean data
      return this._config.cleanData.call(this, _data, _fileName);
    }
    throw new Error(`[${this.registryId}] parseEntryDataRaw() must be implemented by subclass`);
  }

  /**
   * Create an entry from parsed data.
   * Config-driven registries use the config's createEntry function.
   * @param {string} _id
   * @param {J} _data
   * @returns {T | null}
   */
  createEntry(_id, _data) {
    if (this._config) {
      if (!_data) {
        return null;
      }
      return this._config.createEntry.call(this, _id, _data);
    }
    throw new Error(`[${this.registryId}] createEntry() must be implemented by subclass`);
  }

  // ========================================
  // PRIVATE METHODS
  // ========================================

  /**
   * @param {string} message
   * @private
   */
  _log(message) {
    // eslint-disable-next-line no-console
    console.log(`[${this.registryId}] ${message}`);
  }
}

/**
 * Create a config-driven registry instance with singleton support.
 * Returns a class with getInstance() and any extra methods/statics attached.
 *
 * @param {RegistryConfig} config - Registry configuration
 * @param {{ statics?: Record<string, any>, methods?: Record<string, Function> }} [options] - Additional options
 * @returns {typeof Registry<RegistryEntryBase, Record<string, any>> & { new(): Registry<RegistryEntryBase, Record<string, any>>, getInstance(): Registry<RegistryEntryBase, Record<string, any>> }} A Registry subclass with getInstance()
 */
export function createRegistry(config, options = {}) {
  /** @type {ConfigRegistry | null} */
  let instance = null;

  /** @extends {Registry<RegistryEntryBase, Record<string, any>>} */
  class ConfigRegistry extends Registry {
    constructor() {
      super(config);
    }

    /**
     * Get or create the singleton instance.
     * @returns {ConfigRegistry}
     */
    static getInstance() {
      if (!instance) {
        instance = new ConfigRegistry();
      }
      return instance;
    }
  }

  // Reset singleton for testing
  Object.defineProperty(ConfigRegistry, 'instance', {
    get() {
      return instance;
    },
    set(v) {
      instance = v;
    },
    configurable: true
  });

  // Attach static properties
  if (options.statics) {
    const /** @type {Record<string, any>} */ staticTarget = /** @type {any} */ (ConfigRegistry);
    for (const [key, value] of Object.entries(options.statics)) {
      staticTarget[key] = value;
    }
  }

  // Use a typed reference for dynamic prototype assignments
  const /** @type {Record<string, any>} */ proto = /** @type {any} */ (ConfigRegistry.prototype);

  // Generate common methods from entityName config (BEFORE custom methods so custom wins)
  if ('entityName' in config) {
    const entityName = config.entityName;
    if (typeof entityName === 'string' && entityName.length > 0) {
      const dataFilePath = config.dataFilePath;
      const displayInfoFields = config.displayInfoFields || [];

      /** @type {function(string): any} */
      proto[`get${entityName}Data`] = function (/** @type {string} */ id) {
        return this.fetchEntry(id)?.data ?? null;
      };

      /** @type {function(string): string} */
      proto[`get${entityName}Name`] = function (/** @type {string} */ id) {
        return this.fetchEntry(id)?.name ?? id;
      };

      /** @type {function(): string[]} */
      proto[`list${entityName}Ids`] = function () {
        return this.listEntryIds();
      };

      /** @type {function(string): string} */
      proto[`get${entityName}Path`] = function (/** @type {string} */ id) {
        return `${dataFilePath}/${id}.json`;
      };

      /** @type {function(string): Record<string, any> | null} */
      proto[`get${entityName}DisplayInfo`] = function (/** @type {string} */ id) {
        const entry = this.fetchEntry(id);
        if (!entry) {
          return null;
        }
        /** @type {Record<string, any>} */
        const info = { id: entry.id };
        for (const field of displayInfoFields) {
          if (field in entry) {
            info[field] = /** @type {Record<string, any>} */ (entry)[field];
          } else if (entry.data && field in entry.data) {
            info[field] = /** @type {Record<string, any>} */ (entry.data)[field];
          }
        }
        return info;
      };

      proto.toString = function () {
        return `${config.registryId}Registry(${this.countEntries()} ${entityName}s)`;
      };
    } else {
      console.warn(
        `[${config.registryId}] entityName must be a non-empty string, skipping method generation`
      );
    }
  }

  // Attach instance methods (custom methods override generated ones)
  if (options.methods) {
    for (const [key, fn] of Object.entries(options.methods)) {
      proto[key] = fn;
    }
  }

  return ConfigRegistry;
}

export default Registry;
