/**
 * @fileoverview Unit tests for the Conductor timing system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Phaser's EventEmitter before importing Conductor
vi.mock('phaser', () => ({
  default: {
    Events: {
      EventEmitter: class MockEventEmitter {
        constructor() {
          this.listeners = new Map();
        }
        on(event, callback) {
          if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
          }
          this.listeners.get(event).push(callback);
          return this;
        }
        emit(event, ...args) {
          const callbacks = this.listeners.get(event) || [];
          callbacks.forEach((cb) => cb(...args));
          return this;
        }
        removeAllListeners() {
          this.listeners.clear();
          return this;
        }
      }
    }
  }
}));

import Conductor from '../src/core/Conductor.js';
import * as Constants from '../src/core/Constants.js';

describe('Conductor', () => {
  let conductor;

  beforeEach(() => {
    // Reset the singleton before each test
    Conductor.reset();
    conductor = Conductor.instance;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    conductor.destroy();
    vi.restoreAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = Conductor.instance;
      const instance2 = Conductor.instance;
      expect(instance1).toBe(instance2);
    });

    it('should create a new instance after reset', () => {
      const instance1 = Conductor.instance;
      Conductor.reset();
      const instance2 = Conductor.instance;
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Default Values', () => {
    it('should have default BPM', () => {
      expect(conductor.bpm).toBe(Constants.DEFAULT_BPM);
    });

    it('should have default time signature', () => {
      expect(conductor.timeSignatureNumerator).toBe(Constants.DEFAULT_TIME_SIGNATURE_NUM);
      expect(conductor.timeSignatureDenominator).toBe(Constants.DEFAULT_TIME_SIGNATURE_DEN);
    });

    it('should start at position 0', () => {
      expect(conductor.songPosition).toBe(0);
      expect(conductor.currentStep).toBe(0);
      expect(conductor.currentBeat).toBe(0);
      expect(conductor.currentMeasure).toBe(0);
    });
  });

  describe('BPM Calculations', () => {
    it('should calculate beat length correctly at 100 BPM', () => {
      conductor.mapTimeChanges([{ timeStamp: 0, bpm: 100 }]);
      // At 100 BPM: 60000ms / 100 = 600ms per beat
      expect(conductor.beatLengthMs).toBe(600);
    });

    it('should calculate step length correctly at 100 BPM', () => {
      conductor.mapTimeChanges([{ timeStamp: 0, bpm: 100 }]);
      // At 100 BPM: 600ms per beat / 4 steps = 150ms per step
      expect(conductor.stepLengthMs).toBe(150);
    });

    it('should calculate beat length correctly at 120 BPM', () => {
      conductor.mapTimeChanges([{ timeStamp: 0, bpm: 120 }]);
      // At 120 BPM: 60000ms / 120 = 500ms per beat
      expect(conductor.beatLengthMs).toBe(500);
    });

    it('should calculate measure length correctly', () => {
      conductor.mapTimeChanges([{ timeStamp: 0, bpm: 100, timeSignatureNum: 4 }]);
      // At 100 BPM, 4/4 time: 600ms * 4 = 2400ms per measure
      expect(conductor.measureLengthMs).toBe(2400);
    });
  });

  describe('Force BPM', () => {
    it('should override BPM when forced', () => {
      conductor.mapTimeChanges([{ timeStamp: 0, bpm: 100 }]);
      conductor.forceBPM(150);
      expect(conductor.bpm).toBe(150);
    });

    it('should reset to time change BPM when force is cleared', () => {
      conductor.mapTimeChanges([{ timeStamp: 0, bpm: 100 }]);
      conductor.forceBPM(150);
      conductor.forceBPM(null);
      expect(conductor.bpm).toBe(100);
    });
  });

  describe('Time Changes', () => {
    it('should map time changes correctly', () => {
      const timeChanges = [
        { timeStamp: 0, bpm: 100 },
        { timeStamp: 2400, bpm: 120 }
      ];
      conductor.mapTimeChanges(timeChanges);
      expect(conductor.timeChanges.length).toBe(2);
    });

    it('should calculate beat times for time changes', () => {
      const timeChanges = [
        { timeStamp: 0, bpm: 100 },
        { timeStamp: 2400, bpm: 120 } // 2400ms at 100 BPM = 4 beats
      ];
      conductor.mapTimeChanges(timeChanges);
      expect(conductor.timeChanges[0].beatTime).toBe(0);
      expect(conductor.timeChanges[1].beatTime).toBe(4);
    });

    it('should switch to correct time change during update', () => {
      const timeChanges = [
        { timeStamp: 0, bpm: 100 },
        { timeStamp: 2400, bpm: 120 }
      ];
      conductor.mapTimeChanges(timeChanges);

      conductor.update(1000, false);
      expect(conductor.bpm).toBe(100);

      conductor.update(3000, false);
      expect(conductor.bpm).toBe(120);
    });
  });

  describe('Position Calculations', () => {
    beforeEach(() => {
      conductor.mapTimeChanges([{ timeStamp: 0, bpm: 100 }]);
    });

    it('should calculate current step correctly', () => {
      // At 100 BPM, step length = 150ms
      conductor.update(150, false);
      expect(conductor.currentStep).toBe(1);

      conductor.update(300, false);
      expect(conductor.currentStep).toBe(2);

      conductor.update(600, false);
      expect(conductor.currentStep).toBe(4);
    });

    it('should calculate current beat correctly', () => {
      // At 100 BPM, beat length = 600ms
      conductor.update(600, false);
      expect(conductor.currentBeat).toBe(1);

      conductor.update(1200, false);
      expect(conductor.currentBeat).toBe(2);
    });

    it('should calculate current measure correctly', () => {
      // At 100 BPM, 4/4 time, measure length = 2400ms
      conductor.update(2400, false);
      expect(conductor.currentMeasure).toBe(1);

      conductor.update(4800, false);
      expect(conductor.currentMeasure).toBe(2);
    });

    it('should calculate fractional step time', () => {
      conductor.update(75, false); // Half a step at 100 BPM
      expect(conductor.currentStepTime).toBeCloseTo(0.5, 1);
    });
  });


  describe('Event Emission', () => {
    beforeEach(() => {
      conductor.mapTimeChanges([{ timeStamp: 0, bpm: 100 }]);
    });

    it('should emit stepHit when step changes', () => {
      const stepCallback = vi.fn();
      conductor.events.on('stepHit', stepCallback);

      conductor.update(150, false); // Move to step 1
      expect(stepCallback).toHaveBeenCalledWith(1);
    });

    it('should emit beatHit when beat changes', () => {
      const beatCallback = vi.fn();
      conductor.events.on('beatHit', beatCallback);

      conductor.update(600, false); // Move to beat 1
      expect(beatCallback).toHaveBeenCalledWith(1);
    });

    it('should emit measureHit when measure changes', () => {
      const measureCallback = vi.fn();
      conductor.events.on('measureHit', measureCallback);

      conductor.update(2400, false); // Move to measure 1
      expect(measureCallback).toHaveBeenCalledWith(1);
    });

    it('should not emit events when position does not change step', () => {
      const stepCallback = vi.fn();
      conductor.events.on('stepHit', stepCallback);

      conductor.update(50, false);
      conductor.update(100, false);
      expect(stepCallback).not.toHaveBeenCalled();
    });
  });

  describe('Time Conversion Utilities', () => {
    beforeEach(() => {
      conductor.mapTimeChanges([{ timeStamp: 0, bpm: 100 }]);
    });

    describe('getTimeInSteps', () => {
      it('should convert milliseconds to steps', () => {
        // At 100 BPM, step = 150ms
        expect(conductor.getTimeInSteps(150)).toBe(1);
        expect(conductor.getTimeInSteps(300)).toBe(2);
        expect(conductor.getTimeInSteps(600)).toBe(4);
      });

      it('should handle fractional steps', () => {
        expect(conductor.getTimeInSteps(75)).toBeCloseTo(0.5, 1);
      });
    });

    describe('getStepTimeInMs', () => {
      it('should convert steps to milliseconds', () => {
        // At 100 BPM, step = 150ms
        expect(conductor.getStepTimeInMs(1)).toBe(150);
        expect(conductor.getStepTimeInMs(4)).toBe(600);
      });

      it('should handle fractional steps', () => {
        expect(conductor.getStepTimeInMs(0.5)).toBe(75);
      });
    });

    describe('getBeatTimeInMs', () => {
      it('should convert beats to milliseconds', () => {
        // At 100 BPM, beat = 600ms
        expect(conductor.getBeatTimeInMs(1)).toBe(600);
        expect(conductor.getBeatTimeInMs(2)).toBe(1200);
      });

      it('should handle fractional beats', () => {
        expect(conductor.getBeatTimeInMs(0.5)).toBe(300);
      });
    });
  });

  describe('Offset Handling', () => {
    beforeEach(() => {
      conductor.mapTimeChanges([{ timeStamp: 0, bpm: 100 }]);
    });

    it('should combine all offsets correctly', () => {
      conductor.instrumentalOffset = 10;
      conductor.formatOffset = 5;
      conductor.globalOffset = 15;
      expect(conductor.combinedOffset).toBe(30);
    });

    it('should apply offsets during update when applyOffsets is true', () => {
      conductor.instrumentalOffset = 150; // One step worth of offset
      conductor.update(0, true);
      expect(conductor.currentStep).toBe(1);
    });

    it('should not apply offsets during update when applyOffsets is false', () => {
      conductor.instrumentalOffset = 150;
      conductor.update(0, false);
      expect(conductor.currentStep).toBe(0);
    });

    it('should calculate instrumental offset in steps', () => {
      conductor.instrumentalOffset = 150; // One step at 100 BPM
      expect(conductor.instrumentalOffsetSteps).toBeCloseTo(1, 1);
    });
  });

  describe('Time Signature Handling', () => {
    it('should handle 3/4 time signature', () => {
      conductor.mapTimeChanges([{ timeStamp: 0, bpm: 100, timeSignatureNum: 3, timeSignatureDen: 4 }]);
      expect(conductor.timeSignatureNumerator).toBe(3);
      expect(conductor.timeSignatureDenominator).toBe(4);
      expect(conductor.beatsPerMeasure).toBe(3);
    });

    it('should calculate steps per measure for different time signatures', () => {
      // 4/4 time: 4 beats * 4 steps = 16 steps per measure
      conductor.mapTimeChanges([{ timeStamp: 0, bpm: 100, timeSignatureNum: 4, timeSignatureDen: 4 }]);
      expect(conductor.stepsPerMeasure).toBe(16);
    });
  });

  describe('Edge Cases', () => {
    it('should handle negative timestamps in time changes', () => {
      conductor.mapTimeChanges([{ timeStamp: -100, bpm: 100 }]);
      expect(conductor.timeChanges[0].timeStamp).toBe(0);
    });

    it('should handle empty time changes array', () => {
      conductor.mapTimeChanges([]);
      expect(conductor.bpm).toBe(Constants.DEFAULT_BPM);
    });

    it('should handle update with no time changes', () => {
      conductor.update(1000, false);
      expect(conductor.songPosition).toBe(1000);
    });

    it('should sort time changes by timestamp', () => {
      conductor.mapTimeChanges([
        { timeStamp: 2400, bpm: 120 },
        { timeStamp: 0, bpm: 100 }
      ]);
      expect(conductor.timeChanges[0].timeStamp).toBe(0);
      expect(conductor.timeChanges[1].timeStamp).toBe(2400);
    });
  });
});
