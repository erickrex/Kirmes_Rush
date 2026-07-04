/**
 * @fileoverview Unit tests for {@link RhythmInputManager}.
 *
 * Verifies the single Input_Time -> Song_Position mapping (with the SaveManager
 * input-delay offset), that buffering preserves BOTH the original Input_Time and
 * the mapped Song_Position, and that the mapping is computed in exactly one place
 * (`mapInputTimeToSongPosition`) so `onGesture` and `consume` route through it.
 *
 * A lightweight fake SaveManager is injected (the constructor takes `saveManager`)
 * so no singleton/localStorage init is required.
 *
 * Feature: rhythm-minigame-prototype
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
 */

import { describe, it, expect, vi } from 'vitest';
import RhythmInputManager from '../src/rhythm/input/RhythmInputManager.js';

/**
 * Build a fake SaveManager exposing only the input-delay calibration getter used
 * by RhythmInputManager.
 * @param {number} offset - The input-delay compensation value to report (ms).
 */
function makeFakeSaveManager(offset = 0) {
  return {
    getInputDelayCompensation: () => offset
  };
}

/**
 * Build a minimal Gesture with the given gesture-start timestamp.
 * @param {number} startTime - The pointerdown Input_Time (performance.now() ms).
 * @param {Partial<import('../src/types.js').Gesture>} [overrides]
 * @returns {import('../src/types.js').Gesture}
 */
function makeGesture(startTime, overrides = {}) {
  return {
    type: 'tap',
    startTime,
    timestamp: startTime,
    position: { x: 0, y: 0 },
    startPosition: { x: 0, y: 0 },
    durationMs: 0,
    distancePx: 0,
    velocityPxPerMs: 0,
    direction: null,
    ...overrides
  };
}

describe('RhythmInputManager - mapping (R8.1, R8.2, R8.3)', () => {
  it('maps Input_Time to Song_Position from the per-frame anchor', () => {
    const manager = new RhythmInputManager({ saveManager: makeFakeSaveManager(0) });

    // Anchor: at frame input time 1000ms, the song is at 5000ms.
    manager.syncClock(5000, 1000);

    // An input 30ms after the anchor frame maps 30ms further into the song.
    expect(manager.mapInputTimeToSongPosition(1030)).toBe(5030);
    // An input before the anchor frame maps earlier.
    expect(manager.mapInputTimeToSongPosition(980)).toBe(4980);
    // The anchor instant itself maps exactly to the anchor Song_Position.
    expect(manager.mapInputTimeToSongPosition(1000)).toBe(5000);
  });

  it('adds the SaveManager input-delay offset to the mapping (R8.2)', () => {
    const manager = new RhythmInputManager({ saveManager: makeFakeSaveManager(20) });
    manager.syncClock(5000, 1000);

    // +20ms calibration shifts every mapped Song_Position later by 20ms.
    expect(manager.mapInputTimeToSongPosition(1000)).toBe(5020);
    expect(manager.mapInputTimeToSongPosition(1030)).toBe(5050);

    const negative = new RhythmInputManager({ saveManager: makeFakeSaveManager(-15) });
    negative.syncClock(5000, 1000);
    expect(negative.mapInputTimeToSongPosition(1000)).toBe(4985);
  });

  it('reads the offset live so recalibration mid-run takes effect', () => {
    let offset = 0;
    const manager = new RhythmInputManager({
      saveManager: { getInputDelayCompensation: () => offset }
    });
    manager.syncClock(0, 0);

    expect(manager.mapInputTimeToSongPosition(100)).toBe(100);
    offset = 40;
    expect(manager.mapInputTimeToSongPosition(100)).toBe(140);
  });

  it('re-anchors on each syncClock so the latest frame wins', () => {
    const manager = new RhythmInputManager({ saveManager: makeFakeSaveManager(0) });
    manager.syncClock(1000, 200);
    expect(manager.mapInputTimeToSongPosition(250)).toBe(1050);

    manager.syncClock(2000, 400);
    expect(manager.mapInputTimeToSongPosition(450)).toBe(2050);
  });
});

describe('RhythmInputManager - buffering preserves both times (R8.4)', () => {
  it('buffers the original Input_Time (gesture-start) alongside the mapped Song_Position', () => {
    const manager = new RhythmInputManager({ saveManager: makeFakeSaveManager(10) });
    manager.syncClock(5000, 1000);

    const gesture = makeGesture(1030);
    manager.onGesture(gesture);

    const buffered = manager.consume();
    expect(buffered).toHaveLength(1);
    // Original Input_Time preserved verbatim.
    expect(buffered[0].inputTime).toBe(1030);
    expect(buffered[0].gesture).toBe(gesture);
    expect(buffered[0].gesture.startTime).toBe(1030);
    // Mapped Song_Position = 5000 + (1030 - 1000) + 10 = 5040.
    expect(buffered[0].songPositionMs).toBe(5040);
  });

  it('judges on gesture-start, not the confirmation timestamp (R7.1)', () => {
    const manager = new RhythmInputManager({ saveManager: makeFakeSaveManager(0) });
    manager.syncClock(5000, 1000);

    // startTime (pointerdown) is 1010; timestamp (pointerup) is much later at 1200.
    const gesture = makeGesture(1010, { timestamp: 1200 });
    manager.onGesture(gesture);

    const [entry] = manager.consume();
    // Mapping uses startTime (1010) -> 5010, ignoring the confirmation time.
    expect(entry.inputTime).toBe(1010);
    expect(entry.songPositionMs).toBe(5010);
  });

  it('preserves ordering and maps each gesture against the current anchor', () => {
    const manager = new RhythmInputManager({ saveManager: makeFakeSaveManager(0) });

    manager.syncClock(1000, 100);
    manager.onGesture(makeGesture(110));

    manager.syncClock(2000, 200);
    manager.onGesture(makeGesture(205));

    const buffered = manager.consume();
    expect(buffered.map((b) => b.songPositionMs)).toEqual([1010, 2005]);
  });

  it('consume returns then clears the buffer', () => {
    const manager = new RhythmInputManager({ saveManager: makeFakeSaveManager(0) });
    manager.syncClock(0, 0);
    manager.onGesture(makeGesture(50));

    expect(manager.consume()).toHaveLength(1);
    // Second consume yields nothing - the buffer was cleared.
    expect(manager.consume()).toEqual([]);
  });
});

describe('RhythmInputManager - single mapping location (R8.3, Property 5)', () => {
  it('onGesture computes its Song_Position via mapInputTimeToSongPosition only', () => {
    const manager = new RhythmInputManager({ saveManager: makeFakeSaveManager(7) });
    manager.syncClock(3000, 500);

    const spy = vi.spyOn(manager, 'mapInputTimeToSongPosition');
    manager.onGesture(makeGesture(520));

    // The buffered value is exactly what the single mapping method returns for the
    // gesture-start time - onGesture does no mapping arithmetic of its own.
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(520);
    const [entry] = manager.consume();
    expect(entry.songPositionMs).toBe(manager.mapInputTimeToSongPosition(520));
    spy.mockRestore();
  });

  it('wires onGesture as the recognizer callback when a recognizer is provided', () => {
    const fakeRecognizer = { _onGesture: null };
    const manager = new RhythmInputManager({
      recognizer: /** @type {*} */ (fakeRecognizer),
      saveManager: makeFakeSaveManager(0)
    });
    manager.syncClock(1000, 0);

    // The recognizer's callback is the manager's bound onGesture; emitting through it
    // buffers the gesture.
    expect(typeof fakeRecognizer._onGesture).toBe('function');
    fakeRecognizer._onGesture(makeGesture(50));
    expect(manager.consume()).toHaveLength(1);
  });
});
