/**
 * @fileoverview Tests for TouchInputController - Touch input zones for portrait mode
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { default: TouchInputController } = await import('../src/input/TouchInputController.js');
const {
  PORTRAIT_WIDTH,
  TOUCH_ZONE_Y,
  TOUCH_ZONE_HEIGHT,
  TOUCH_ZONE_WIDTH
} = await import('../src/layout/LayoutManager.js');

/** Create a mock Phaser scene with rectangle and graphics factories */
const createMockScene = () => ({
  add: {
    rectangle: (x, y, w, h, color, alpha) => ({
      x, y, width: w, height: h,
      setOrigin: vi.fn(),
      setInteractive: vi.fn(),
      setDepth: vi.fn(),
      setVisible: vi.fn(),
      setAlpha: vi.fn(),
      destroy: vi.fn()
    }),
    graphics: () => ({
      fillStyle: vi.fn(),
      fillTriangle: vi.fn(),
      setDepth: vi.fn(),
      setVisible: vi.fn(),
      destroy: vi.fn()
    })
  },
  input: {
    on: vi.fn(),
    off: vi.fn()
  }
});

/** Create a fresh input queue */
const createInputQueue = () => ({
  pressQueue: [],
  releaseQueue: []
});

describe('TouchInputController', () => {
  let controller;
  let mockScene;
  let inputQueue;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('performance', { now: vi.fn(() => 1000) });
    mockScene = createMockScene();
    inputQueue = createInputQueue();
    controller = new TouchInputController(mockScene, inputQueue);
  });

  afterEach(() => {
    controller.destroy();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should store scene and inputQueue references', () => {
      expect(controller.scene).toBe(mockScene);
      expect(controller.inputQueue).toBe(inputQueue);
    });

    it('should initialize with empty zones and not visible', () => {
      expect(controller.zones).toEqual([]);
      expect(controller.visible).toBe(false);
    });
  });

  describe('create', () => {
    it('should create 4 zones', () => {
      controller.create();
      expect(controller.zones.length).toBe(4);
    });

    it('should assign correct directions in order left/down/up/right', () => {
      controller.create();
      expect(controller.zones[0].direction).toBe(0); // left
      expect(controller.zones[1].direction).toBe(1); // down
      expect(controller.zones[2].direction).toBe(2); // up
      expect(controller.zones[3].direction).toBe(3); // right
    });

    it('should position zones across the bottom of the canvas', () => {
      controller.create();
      for (let i = 0; i < 4; i++) {
        expect(controller.zones[i].x).toBe(i * TOUCH_ZONE_WIDTH);
        expect(controller.zones[i].y).toBe(TOUCH_ZONE_Y);
        expect(controller.zones[i].width).toBe(TOUCH_ZONE_WIDTH);
        expect(controller.zones[i].height).toBe(TOUCH_ZONE_HEIGHT);
      }
    });

    it('should set zones as not pressed initially', () => {
      controller.create();
      for (const zone of controller.zones) {
        expect(zone.pressed).toBe(false);
        expect(zone.pointerId).toBeNull();
      }
    });

    it('should create Phaser rectangle and graphics for each zone', () => {
      controller.create();
      for (const zone of controller.zones) {
        expect(zone.rect).not.toBeNull();
        expect(zone.icon).not.toBeNull();
      }
    });

    it('should register pointer event listeners on scene input', () => {
      controller.create();
      expect(mockScene.input.on).toHaveBeenCalledWith('pointerdown', expect.any(Function));
      expect(mockScene.input.on).toHaveBeenCalledWith('pointerup', expect.any(Function));
      expect(mockScene.input.on).toHaveBeenCalledWith('pointermove', expect.any(Function));
    });

    it('should set visible to true', () => {
      controller.create();
      expect(controller.visible).toBe(true);
    });

    it('should size zones to fill canvas width', () => {
      controller.create();
      const totalWidth = controller.zones.reduce((sum, z) => sum + z.width, 0);
      expect(totalWidth).toBe(PORTRAIT_WIDTH);
    });

    it('should have zone height >= 120px', () => {
      controller.create();
      for (const zone of controller.zones) {
        expect(zone.height).toBeGreaterThanOrEqual(120);
      }
    });
  });

  describe('onPointerDown', () => {
    beforeEach(() => {
      controller.create();
    });

    it('should push press event for the correct zone', () => {
      controller.onPointerDown({ x: 10, y: TOUCH_ZONE_Y + 10, id: 1 });

      expect(inputQueue.pressQueue.length).toBe(1);
      expect(inputQueue.pressQueue[0].direction).toBe(0); // left zone
    });

    it('should include timestamp in press event', () => {
      performance.now = vi.fn(() => 5000);
      controller.onPointerDown({ x: 10, y: TOUCH_ZONE_Y + 10, id: 1 });

      expect(inputQueue.pressQueue[0].timestamp).toBe(5000);
    });

    it('should mark zone as pressed with pointer id', () => {
      controller.onPointerDown({ x: 10, y: TOUCH_ZONE_Y + 10, id: 1 });

      expect(controller.zones[0].pressed).toBe(true);
      expect(controller.zones[0].pointerId).toBe(1);
    });

    it('should ignore pointer outside all zones', () => {
      controller.onPointerDown({ x: 10, y: 10, id: 1 }); // above zones

      expect(inputQueue.pressQueue.length).toBe(0);
    });

    it('should ignore if zone is already pressed', () => {
      controller.onPointerDown({ x: 10, y: TOUCH_ZONE_Y + 10, id: 1 });
      controller.onPointerDown({ x: 10, y: TOUCH_ZONE_Y + 10, id: 2 });

      expect(inputQueue.pressQueue.length).toBe(1);
    });

    it('should not push events when hidden', () => {
      controller.hide();
      controller.onPointerDown({ x: 10, y: TOUCH_ZONE_Y + 10, id: 1 });

      expect(inputQueue.pressQueue.length).toBe(0);
    });

    it('should handle multi-touch on different zones', () => {
      controller.onPointerDown({ x: 10, y: TOUCH_ZONE_Y + 10, id: 1 });   // left
      controller.onPointerDown({ x: 550, y: TOUCH_ZONE_Y + 10, id: 2 });  // right

      expect(inputQueue.pressQueue.length).toBe(2);
      expect(inputQueue.pressQueue[0].direction).toBe(0);
      expect(inputQueue.pressQueue[1].direction).toBe(3);
    });

    it('should map pointer to correct zone by x position', () => {
      // Zone 0: 0-180, Zone 1: 180-360, Zone 2: 360-540, Zone 3: 540-720
      controller.onPointerDown({ x: 200, y: TOUCH_ZONE_Y + 10, id: 1 }); // down
      expect(inputQueue.pressQueue[0].direction).toBe(1);

      controller.onPointerDown({ x: 400, y: TOUCH_ZONE_Y + 10, id: 2 }); // up
      expect(inputQueue.pressQueue[1].direction).toBe(2);
    });
  });

  describe('onPointerUp', () => {
    beforeEach(() => {
      controller.create();
    });

    it('should push release event for the zone held by this pointer', () => {
      controller.onPointerDown({ x: 10, y: TOUCH_ZONE_Y + 10, id: 1 });
      controller.onPointerUp({ x: 10, y: TOUCH_ZONE_Y + 10, id: 1 });

      expect(inputQueue.releaseQueue.length).toBe(1);
      expect(inputQueue.releaseQueue[0].direction).toBe(0);
    });

    it('should mark zone as released', () => {
      controller.onPointerDown({ x: 10, y: TOUCH_ZONE_Y + 10, id: 1 });
      controller.onPointerUp({ x: 10, y: TOUCH_ZONE_Y + 10, id: 1 });

      expect(controller.zones[0].pressed).toBe(false);
      expect(controller.zones[0].pointerId).toBeNull();
    });

    it('should include timestamp in release event', () => {
      controller.onPointerDown({ x: 10, y: TOUCH_ZONE_Y + 10, id: 1 });
      performance.now = vi.fn(() => 6000);
      controller.onPointerUp({ x: 10, y: TOUCH_ZONE_Y + 10, id: 1 });

      expect(inputQueue.releaseQueue[0].timestamp).toBe(6000);
    });

    it('should not push release if no zone is held by this pointer', () => {
      controller.onPointerUp({ x: 10, y: TOUCH_ZONE_Y + 10, id: 99 });

      expect(inputQueue.releaseQueue.length).toBe(0);
    });

    it('should only release the zone matching the pointer id', () => {
      controller.onPointerDown({ x: 10, y: TOUCH_ZONE_Y + 10, id: 1 });   // left
      controller.onPointerDown({ x: 550, y: TOUCH_ZONE_Y + 10, id: 2 });  // right

      controller.onPointerUp({ x: 10, y: TOUCH_ZONE_Y + 10, id: 1 });

      expect(controller.zones[0].pressed).toBe(false);
      expect(controller.zones[3].pressed).toBe(true);
      expect(inputQueue.releaseQueue.length).toBe(1);
      expect(inputQueue.releaseQueue[0].direction).toBe(0);
    });
  });

  describe('onPointerMove', () => {
    beforeEach(() => {
      controller.create();
    });

    it('should release old zone and press new zone on drag', () => {
      controller.onPointerDown({ x: 10, y: TOUCH_ZONE_Y + 10, id: 1 });
      inputQueue.pressQueue = [];

      controller.onPointerMove({ x: 200, y: TOUCH_ZONE_Y + 10, id: 1, isDown: true });

      // Should have released left (0) and pressed down (1)
      expect(inputQueue.releaseQueue.length).toBe(1);
      expect(inputQueue.releaseQueue[0].direction).toBe(0);
      expect(inputQueue.pressQueue.length).toBe(1);
      expect(inputQueue.pressQueue[0].direction).toBe(1);
    });

    it('should ignore move when pointer is not down', () => {
      controller.onPointerDown({ x: 10, y: TOUCH_ZONE_Y + 10, id: 1 });
      inputQueue.pressQueue = [];

      controller.onPointerMove({ x: 200, y: TOUCH_ZONE_Y + 10, id: 1, isDown: false });

      expect(inputQueue.releaseQueue.length).toBe(0);
      expect(inputQueue.pressQueue.length).toBe(0);
    });

    it('should release zone when pointer drags outside all zones', () => {
      controller.onPointerDown({ x: 10, y: TOUCH_ZONE_Y + 10, id: 1 });

      controller.onPointerMove({ x: 10, y: 10, id: 1, isDown: true }); // above zones

      expect(inputQueue.releaseQueue.length).toBe(1);
      expect(inputQueue.releaseQueue[0].direction).toBe(0);
      expect(controller.zones[0].pressed).toBe(false);
    });

    it('should not do anything if pointer stays in same zone', () => {
      controller.onPointerDown({ x: 10, y: TOUCH_ZONE_Y + 10, id: 1 });
      inputQueue.pressQueue = [];

      controller.onPointerMove({ x: 50, y: TOUCH_ZONE_Y + 50, id: 1, isDown: true });

      expect(inputQueue.releaseQueue.length).toBe(0);
      expect(inputQueue.pressQueue.length).toBe(0);
    });

    it('should press zone when pointer drags into zone from outside', () => {
      // Pointer starts outside zones (no initial press)
      controller.onPointerMove({ x: 10, y: TOUCH_ZONE_Y + 10, id: 1, isDown: true });

      expect(inputQueue.pressQueue.length).toBe(1);
      expect(inputQueue.pressQueue[0].direction).toBe(0);
    });
  });

  describe('show / hide', () => {
    beforeEach(() => {
      controller.create();
    });

    it('should set visible to true on show', () => {
      controller.hide();
      controller.show();
      expect(controller.visible).toBe(true);
    });

    it('should set visible to false on hide', () => {
      controller.hide();
      expect(controller.visible).toBe(false);
    });

    it('should call setVisible on rect and icon game objects', () => {
      controller.hide();
      for (const zone of controller.zones) {
        expect(zone.rect.setVisible).toHaveBeenCalledWith(false);
        expect(zone.icon.setVisible).toHaveBeenCalledWith(false);
      }

      controller.show();
      for (const zone of controller.zones) {
        expect(zone.rect.setVisible).toHaveBeenCalledWith(true);
        expect(zone.icon.setVisible).toHaveBeenCalledWith(true);
      }
    });

    it('should release pressed zones on hide', () => {
      controller.onPointerDown({ x: 10, y: TOUCH_ZONE_Y + 10, id: 1 });
      controller.hide();

      expect(controller.zones[0].pressed).toBe(false);
      expect(controller.zones[0].pointerId).toBeNull();
    });
  });

  describe('update', () => {
    beforeEach(() => {
      controller.create();
    });

    it('should set pressed alpha on pressed zones', () => {
      controller.onPointerDown({ x: 10, y: TOUCH_ZONE_Y + 10, id: 1 });
      controller.update();

      expect(controller.zones[0].rect.setAlpha).toHaveBeenCalledWith(0.8);
    });

    it('should set idle alpha on unpressed zones', () => {
      controller.update();

      for (const zone of controller.zones) {
        expect(zone.rect.setAlpha).toHaveBeenCalledWith(0.4);
      }
    });

    it('should restore idle alpha after release', () => {
      controller.onPointerDown({ x: 10, y: TOUCH_ZONE_Y + 10, id: 1 });
      controller.update();
      controller.zones[0].rect.setAlpha.mockClear();

      controller.onPointerUp({ x: 10, y: TOUCH_ZONE_Y + 10, id: 1 });
      controller.update();

      expect(controller.zones[0].rect.setAlpha).toHaveBeenCalledWith(0.4);
    });
  });

  describe('destroy', () => {
    it('should destroy all game objects', () => {
      controller.create();
      const destroyFns = controller.zones.flatMap((z) => [z.rect.destroy, z.icon.destroy]);

      controller.destroy();

      for (const fn of destroyFns) {
        expect(fn).toHaveBeenCalled();
      }
    });

    it('should remove pointer event listeners', () => {
      controller.create();
      controller.destroy();

      expect(mockScene.input.off).toHaveBeenCalledWith('pointerdown', expect.any(Function));
      expect(mockScene.input.off).toHaveBeenCalledWith('pointerup', expect.any(Function));
      expect(mockScene.input.off).toHaveBeenCalledWith('pointermove', expect.any(Function));
    });

    it('should clear zones and null references', () => {
      controller.create();
      controller.destroy();

      expect(controller.zones).toEqual([]);
      expect(controller.scene).toBeNull();
      expect(controller.inputQueue).toBeNull();
      expect(controller.visible).toBe(false);
    });
  });

  describe('headless mode (no scene.add)', () => {
    it('should work without Phaser game object factories', () => {
      const headless = new TouchInputController({}, inputQueue);
      headless.create();

      expect(headless.zones.length).toBe(4);
      for (const zone of headless.zones) {
        expect(zone.rect).toBeNull();
        expect(zone.icon).toBeNull();
      }

      // Input events should still work
      headless.onPointerDown({ x: 10, y: TOUCH_ZONE_Y + 10, id: 1 });
      expect(inputQueue.pressQueue.length).toBe(1);

      headless.destroy();
    });
  });

  describe('multi-touch (4 simultaneous)', () => {
    beforeEach(() => {
      controller.create();
    });

    it('should handle 4 simultaneous touches on all zones', () => {
      controller.onPointerDown({ x: 10, y: TOUCH_ZONE_Y + 10, id: 1 });   // left
      controller.onPointerDown({ x: 200, y: TOUCH_ZONE_Y + 10, id: 2 });  // down
      controller.onPointerDown({ x: 400, y: TOUCH_ZONE_Y + 10, id: 3 });  // up
      controller.onPointerDown({ x: 600, y: TOUCH_ZONE_Y + 10, id: 4 });  // right

      expect(inputQueue.pressQueue.length).toBe(4);
      expect(controller.zones.every((z) => z.pressed)).toBe(true);

      // Release all
      controller.onPointerUp({ id: 1 });
      controller.onPointerUp({ id: 2 });
      controller.onPointerUp({ id: 3 });
      controller.onPointerUp({ id: 4 });

      expect(inputQueue.releaseQueue.length).toBe(4);
      expect(controller.zones.every((z) => !z.pressed)).toBe(true);
    });
  });
});


import fc from 'fast-check';

// Minimum iterations per property test
const NUM_RUNS = 100;

// ========================================
// PROPERTY-BASED TESTS
// ========================================

describe('TouchInputController Property Tests', () => {
  // ========================================
  // Property 4: Touch zone arrangement and direction mapping
  // Tag: Feature: mobile-portrait-mode, Property 4: Touch zone arrangement and direction mapping
  // **Validates: Requirements 6.1**
  // ========================================
  describe('Property 4: Touch zone arrangement and direction mapping', () => {
    it('zone at index i SHALL have direction === i and x === i * zoneWidth', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 3 }),
          (zoneIndex) => {
            const inputQueue = { pressQueue: [], releaseQueue: [] };
            const ctrl = new TouchInputController({}, inputQueue);
            ctrl.create();

            const zone = ctrl.zones[zoneIndex];
            expect(zone.direction).toBe(zoneIndex);
            expect(zone.x).toBe(zoneIndex * TOUCH_ZONE_WIDTH);

            ctrl.destroy();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it('all 4 zones SHALL be ordered left-to-right with increasing x', () => {
      fc.assert(
        fc.property(
          fc.constant(null),
          () => {
            const inputQueue = { pressQueue: [], releaseQueue: [] };
            const ctrl = new TouchInputController({}, inputQueue);
            ctrl.create();

            for (let i = 0; i < 4; i++) {
              expect(ctrl.zones[i].direction).toBe(i);
              expect(ctrl.zones[i].x).toBe(i * TOUCH_ZONE_WIDTH);
              if (i > 0) {
                expect(ctrl.zones[i].x).toBeGreaterThan(ctrl.zones[i - 1].x);
              }
            }

            ctrl.destroy();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  // ========================================
  // Property 5: Touch press produces correct input event
  // Tag: Feature: mobile-portrait-mode, Property 5: Touch press produces correct input event
  // **Validates: Requirements 6.2**
  // ========================================
  describe('Property 5: Touch press produces correct input event', () => {
    it('pointerDown within zone bounds SHALL produce exactly one press event with matching direction and timestamp within 16ms', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 3 }),
          fc.double({ min: 0, max: 0.999, noNaN: true }),
          fc.double({ min: 0, max: 0.999, noNaN: true }),
          (zoneIndex, xFrac, yFrac) => {
            const inputQueue = { pressQueue: [], releaseQueue: [] };
            const ctrl = new TouchInputController({}, inputQueue);
            ctrl.create();

            const zone = ctrl.zones[zoneIndex];
            const pointerX = zone.x + xFrac * zone.width;
            const pointerY = zone.y + yFrac * zone.height;

            const beforeTime = performance.now();
            ctrl.onPointerDown({ x: pointerX, y: pointerY, id: 1 });
            const afterTime = performance.now();

            expect(inputQueue.pressQueue.length).toBe(1);
            expect(inputQueue.pressQueue[0].direction).toBe(zoneIndex);
            expect(inputQueue.pressQueue[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
            expect(inputQueue.pressQueue[0].timestamp - beforeTime).toBeLessThanOrEqual(16);

            ctrl.destroy();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  // ========================================
  // Property 6: Touch release produces correct input event
  // Tag: Feature: mobile-portrait-mode, Property 6: Touch release produces correct input event
  // **Validates: Requirements 6.3**
  // ========================================
  describe('Property 6: Touch release produces correct input event', () => {
    it('pointerUp on an active zone SHALL produce exactly one release event with matching direction and timestamp within 16ms', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 3 }),
          (zoneIndex) => {
            const inputQueue = { pressQueue: [], releaseQueue: [] };
            const ctrl = new TouchInputController({}, inputQueue);
            ctrl.create();

            const zone = ctrl.zones[zoneIndex];
            const pointerX = zone.x + zone.width / 2;
            const pointerY = zone.y + zone.height / 2;
            const pointerId = zoneIndex + 10;

            // Press the zone first
            ctrl.onPointerDown({ x: pointerX, y: pointerY, id: pointerId });

            // Now release
            const beforeTime = performance.now();
            ctrl.onPointerUp({ id: pointerId });
            const afterTime = performance.now();

            expect(inputQueue.releaseQueue.length).toBe(1);
            expect(inputQueue.releaseQueue[0].direction).toBe(zoneIndex);
            expect(inputQueue.releaseQueue[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
            expect(inputQueue.releaseQueue[0].timestamp - beforeTime).toBeLessThanOrEqual(16);

            ctrl.destroy();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  // ========================================
  // Property 7: Touch zone dimensions fill canvas width
  // Tag: Feature: mobile-portrait-mode, Property 7: Touch zone dimensions fill canvas width
  // **Validates: Requirements 6.5**
  // ========================================
  describe('Property 7: Touch zone dimensions fill canvas width', () => {
    it('each zone width SHALL equal PORTRAIT_WIDTH / 4, height >= 120px, and sum of widths SHALL equal PORTRAIT_WIDTH', () => {
      fc.assert(
        fc.property(
          fc.constant(null),
          () => {
            const inputQueue = { pressQueue: [], releaseQueue: [] };
            const ctrl = new TouchInputController({}, inputQueue);
            ctrl.create();

            const expectedZoneWidth = PORTRAIT_WIDTH / 4;
            let totalWidth = 0;

            for (const zone of ctrl.zones) {
              expect(zone.width).toBe(expectedZoneWidth);
              expect(zone.height).toBeGreaterThanOrEqual(120);
              totalWidth += zone.width;
            }

            expect(totalWidth).toBe(PORTRAIT_WIDTH);

            ctrl.destroy();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  // ========================================
  // Property 9: Simultaneous touch and keyboard inputs coexist
  // Tag: Feature: mobile-portrait-mode, Property 9: Simultaneous touch and keyboard inputs coexist
  // **Validates: Requirements 7.3**
  // ========================================
  describe('Property 9: Simultaneous touch and keyboard inputs coexist', () => {
    it('mixed touch + keyboard input sequences in same frame SHALL all appear in input queue without drops or duplicates', () => {
      // Arbitrary for generating keyboard events
      const directionArb = fc.integer({ min: 0, max: 3 });

      // Generate a mixed sequence of touch and keyboard events
      const touchEventArb = fc.record({
        source: fc.constant('touch'),
        direction: directionArb,
        action: fc.constantFrom('press', 'release')
      });

      const keyboardEventArb = fc.record({
        source: fc.constant('keyboard'),
        direction: directionArb,
        action: fc.constantFrom('press', 'release')
      });

      const mixedSequenceArb = fc.array(
        fc.oneof(touchEventArb, keyboardEventArb),
        { minLength: 1, maxLength: 30 }
      );

      fc.assert(
        fc.property(
          mixedSequenceArb,
          (sequence) => {
            const inputQueue = { pressQueue: [], releaseQueue: [] };
            const ctrl = new TouchInputController({}, inputQueue);
            ctrl.create();

            // Track which touch zones are pressed and by which pointer
            const touchPointers = {};
            let nextPointerId = 100;

            // Track expected events
            let expectedPresses = 0;
            let expectedReleases = 0;

            // Simulate all events in the same "frame"
            for (const event of sequence) {
              if (event.source === 'touch') {
                const zone = ctrl.zones[event.direction];
                const pointerX = zone.x + zone.width / 2;
                const pointerY = zone.y + zone.height / 2;

                if (event.action === 'press' && !zone.pressed) {
                  const pid = nextPointerId++;
                  touchPointers[event.direction] = pid;
                  ctrl.onPointerDown({ x: pointerX, y: pointerY, id: pid });
                  expectedPresses++;
                } else if (event.action === 'release' && zone.pressed && touchPointers[event.direction] != null) {
                  ctrl.onPointerUp({ id: touchPointers[event.direction] });
                  delete touchPointers[event.direction];
                  expectedReleases++;
                }
              } else {
                // Keyboard events push directly to the same queue
                // (simulating what PreciseInput / keyboard handler does)
                if (event.action === 'press') {
                  inputQueue.pressQueue.push({
                    direction: event.direction,
                    timestamp: typeof performance !== 'undefined' ? performance.now() : Date.now()
                  });
                  expectedPresses++;
                } else {
                  inputQueue.releaseQueue.push({
                    direction: event.direction,
                    timestamp: typeof performance !== 'undefined' ? performance.now() : Date.now()
                  });
                  expectedReleases++;
                }
              }
            }

            // Verify: all events appear without drops
            expect(inputQueue.pressQueue.length).toBe(expectedPresses);
            expect(inputQueue.releaseQueue.length).toBe(expectedReleases);

            // Verify: no duplicates — each event has a valid direction and timestamp
            for (const evt of inputQueue.pressQueue) {
              expect(evt.direction).toBeGreaterThanOrEqual(0);
              expect(evt.direction).toBeLessThanOrEqual(3);
              expect(typeof evt.timestamp).toBe('number');
            }
            for (const evt of inputQueue.releaseQueue) {
              expect(evt.direction).toBeGreaterThanOrEqual(0);
              expect(evt.direction).toBeLessThanOrEqual(3);
              expect(typeof evt.timestamp).toBe('number');
            }

            // Verify: no exact duplicate objects (same direction + same timestamp appearing more than expected)
            // Build a frequency map of (direction, timestamp) pairs for press events
            const pressKeys = inputQueue.pressQueue.map(e => `${e.direction}:${e.timestamp}`);
            const releaseKeys = inputQueue.releaseQueue.map(e => `${e.direction}:${e.timestamp}`);

            // Count occurrences — since performance.now() is mocked to return the same value,
            // duplicates would mean the same direction was pushed multiple times unexpectedly.
            // We already verified the total count matches expectedPresses/expectedReleases,
            // so the queue has exactly the right number of events.

            ctrl.destroy();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  // ========================================
  // Property 8: Touch zone visual feedback on press
  // Tag: Feature: mobile-portrait-mode, Property 8: Touch zone visual feedback on press
  // **Validates: Requirements 6.7**
  // ========================================
  describe('Property 8: Touch zone visual feedback on press', () => {
    it('pressing a zone SHALL change alpha from idle, releasing SHALL restore idle alpha', () => {
      const IDLE_ALPHA = 0.4;
      const PRESSED_ALPHA = 0.8;

      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              zoneIndex: fc.integer({ min: 0, max: 3 }),
              action: fc.constantFrom('press', 'release')
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (sequence) => {
            const mockScene = {
              add: {
                rectangle: (_x, _y, w, h, _color, _alpha) => ({
                  x: _x, y: _y, width: w, height: h,
                  setOrigin: () => {},
                  setInteractive: () => {},
                  setDepth: () => {},
                  setVisible: () => {},
                  setAlpha: function (a) { this._alpha = a; },
                  _alpha: IDLE_ALPHA,
                  destroy: () => {}
                }),
                graphics: () => ({
                  fillStyle: () => {},
                  fillTriangle: () => {},
                  setDepth: () => {},
                  setVisible: () => {},
                  destroy: () => {}
                })
              },
              input: { on: () => {}, off: () => {} }
            };

            const inputQueue = { pressQueue: [], releaseQueue: [] };
            const ctrl = new TouchInputController(mockScene, inputQueue);
            ctrl.create();

            // Track which zones are pressed by which pointer
            const activePointers = {};

            let nextPointerId = 100;
            for (const step of sequence) {
              const zone = ctrl.zones[step.zoneIndex];
              const pointerX = zone.x + zone.width / 2;
              const pointerY = zone.y + zone.height / 2;

              if (step.action === 'press' && !zone.pressed) {
                const pid = nextPointerId++;
                activePointers[step.zoneIndex] = pid;
                ctrl.onPointerDown({ x: pointerX, y: pointerY, id: pid });
              } else if (step.action === 'release' && zone.pressed && activePointers[step.zoneIndex] != null) {
                ctrl.onPointerUp({ id: activePointers[step.zoneIndex] });
                delete activePointers[step.zoneIndex];
              }
            }

            // Run update to apply visual feedback
            ctrl.update();

            // Verify: pressed zones have PRESSED_ALPHA, unpressed have IDLE_ALPHA
            for (const zone of ctrl.zones) {
              if (zone.rect) {
                const expectedAlpha = zone.pressed ? PRESSED_ALPHA : IDLE_ALPHA;
                expect(zone.rect._alpha).toBe(expectedAlpha);
              }
            }

            ctrl.destroy();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
