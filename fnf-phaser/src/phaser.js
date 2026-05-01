import * as PhaserModule from 'phaser';

/** @typedef {typeof import('phaser')} PhaserNamespace */

// Phaser 4's ESM build exposes named exports only, while the test suite
// still mocks a default export shape. Normalize both behind one adapter.
const Phaser =
  /** @type {PhaserNamespace} */ (
    /** @type {unknown} */ (
      new Proxy(PhaserModule, {
        get(target, property, receiver) {
          if (Reflect.has(target, property)) {
            return Reflect.get(target, property, receiver);
          }

          const legacyDefault = Reflect.get(target, 'default');

          if (legacyDefault && Reflect.has(legacyDefault, property)) {
            return Reflect.get(legacyDefault, property, receiver);
          }

          return undefined;
        }
      })
    )
  );

export default Phaser;
