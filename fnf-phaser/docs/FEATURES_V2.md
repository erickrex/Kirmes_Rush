# FNF Phaser Migration - Kade Engine Features Analysis

## Overview

This document analyzes the current FNF Phaser implementation against Kade Engine's competitive features, identifying what's implemented, what's missing, and recommendations for future enhancements.

**Analysis Date**: December 24, 2025
**Implementation Status**: Phase 9 Complete (Testing & Optimization)

---

## Feature Comparison Matrix

| Feature | Kade Engine | FNF Phaser | Status | Priority |
|---------|-------------|------------|--------|----------|
| Custom Keybinds | ✅ Full | ✅ Full | ✅ Complete | High |
| Replay System | ✅ Full | ❌ None | 🔴 Missing | Medium |
| Competitive Input | ✅ Full | ⚠️ Partial | 🟡 Needs Enhancement | High |
| Expanded HUD Stats | ✅ Full | ⚠️ Partial | 🟡 Needs Enhancement | Medium |
| Upscroll Support | ✅ Full | ⚠️ Partial | 🟡 Needs Enhancement | Low |

---

## 1. Custom Keybinds (Fully Remappable Controls)

### Kade Engine Implementation
- Fully customizable keybinds for all 4 note directions
- Multiple keys per direction support
- UI keybind configuration
- Persistent storage of custom binds
- Real-time keybind capture

### FNF Phaser Implementation ✅

**Status**: ✅ **FULLY IMPLEMENTED**

**Files**:
- `src/input/Controls.js` - Keybind management system
- `src/ui/OptionsState.js` - UI for keybind configuration

**Features Implemented**:
- ✅ Fully remappable controls for all 4 directions
- ✅ Multiple keys per direction (primary + alt bindings)
- ✅ UI keybind configuration with capture mode
- ✅ Persistent storage via localStorage
- ✅ Real-time keybind capture ("Press any key...")
- ✅ Default keybinds: WASD + Arrow keys
- ✅ Separate UI keybinds for menu navigation
- ✅ Reset to defaults functionality

**Code Evidence**:
```javascript
// Controls.js - Full keybind management
const DEFAULT_NOTE_KEYBINDS = {
  left: ['ArrowLeft', 'KeyA', 'KeyD'],
  down: ['ArrowDown', 'KeyS', 'KeyF'],
  up: ['ArrowUp', 'KeyW', 'KeyJ'],
  right: ['ArrowRight', 'KeyE', 'KeyK']
};

// OptionsState.js - UI configuration
{
  name: 'Controls',
  items: [
    { name: 'Left', key: 'keyLeft', type: 'keybind', value: 'A' },
    { name: 'Down', key: 'keyDown', type: 'keybind', value: 'S' },
    { name: 'Up', key: 'keyUp', type: 'keybind', value: 'W' },
    { name: 'Right', key: 'keyRight', type: 'keybind', value: 'D' },
    // Alt bindings
    { name: 'Alt Left', key: 'keyLeftAlt', type: 'keybind', value: 'LEFT' },
    // ...
  ]
}
```

**Comparison**: ✅ **Matches Kade Engine**

---

## 2. Replay System (Record/Playback of Inputs)

### Kade Engine Implementation
- Auto-saves replays after each song
- Replay playback in-game
- Replay file management
- Input recording with timestamps
- Deterministic playback

### FNF Phaser Implementation ❌

**Status**: 🔴 **NOT IMPLEMENTED**

**Current State**:
- No replay recording system
- No replay playback system
- No replay file management
- Input system supports timestamps (foundation exists)

**What Exists (Foundation)**:
- ✅ `PreciseInput.js` - Timestamped input queue
- ✅ `Conductor.js` - Precise timing system
- ✅ `SaveManager.js` - File persistence system
- ✅ Input events have timestamps via `performance.now()`

**What's Missing**:
- ❌ Replay recording system
- ❌ Replay data structure
- ❌ Replay file format
- ❌ Replay playback engine
- ❌ Replay UI (save/load/manage)
- ❌ Replay validation/verification

**Recommended Implementation**:

### Replay Data Structure
```javascript
/**
 * @typedef {Object} ReplayData
 * @property {string} version - Replay format version
 * @property {string} songId - Song identifier
 * @property {string} difficulty - Difficulty level
 * @property {number} timestamp - Recording timestamp
 * @property {number} score - Final score
 * @property {Object} tallies - Final tallies
 * @property {number} seed - Random seed for determinism
 * @property {InputEvent[]} inputs - Recorded inputs
 * @property {Object} metadata - Additional metadata
 */

/**
 * @typedef {Object} InputEvent
 * @property {number} time - Time in ms from song start
 * @property {string} type - 'press' or 'release'
 * @property {number} direction - Direction (0-3)
 * @property {string} keyCode - Key code used
 */
```

### Replay Recorder
```javascript
class ReplayRecorder {
  constructor() {
    this.recording = false;
    this.inputs = [];
    this.startTime = 0;
    this.metadata = {};
  }

  start(songId, difficulty) {
    this.recording = true;
    this.inputs = [];
    this.startTime = performance.now();
    this.metadata = { songId, difficulty, timestamp: Date.now() };
  }

  recordInput(type, direction, keyCode, timestamp) {
    if (!this.recording) return;

    this.inputs.push({
      time: timestamp - this.startTime,
      type,
      direction,
      keyCode
    });
  }

  stop(score, tallies) {
    this.recording = false;

    return {
      version: '1.0.0',
      ...this.metadata,
      score,
      tallies,
      seed: Math.random(), // For deterministic playback
      inputs: this.inputs
    };
  }

  save(replayData) {
    const filename = `replay_${replayData.songId}_${replayData.timestamp}.json`;
    SaveManager.saveReplay(filename, replayData);
  }
}
```

### Replay Player
```javascript
class ReplayPlayer {
  constructor(replayData) {
    this.replayData = replayData;
    this.inputIndex = 0;
    this.playing = false;
  }

  start() {
    this.playing = true;
    this.inputIndex = 0;
  }

  update(songPosition) {
    if (!this.playing) return [];

    const inputs = [];

    while (this.inputIndex < this.replayData.inputs.length) {
      const input = this.replayData.inputs[this.inputIndex];

      if (input.time <= songPosition) {
        inputs.push(input);
        this.inputIndex++;
      } else {
        break;
      }
    }

    return inputs;
  }

  stop() {
    this.playing = false;
  }
}
```

**Priority**: 🟡 **MEDIUM** - Nice competitive feature, not critical for core gameplay

---

## 3. Competitive Input Handling (Reduced Delay / Fewer Dropped Inputs)

### Kade Engine Implementation
- Quaver/Etterna-inspired input system
- Reduced input delay
- Fewer dropped inputs
- Better timing accuracy
- Input buffering

### FNF Phaser Implementation ⚠️

**Status**: 🟡 **PARTIALLY IMPLEMENTED** - Good foundation, needs optimization

**Files**:
- `src/input/PreciseInput.js` - Timestamped input system
- `src/play/PlayState.js` - Input processing

**Features Implemented**:
- ✅ Precise timestamps via `performance.now()` (sub-millisecond accuracy)
- ✅ Input queue system (prevents dropped inputs)
- ✅ Direct DOM event listeners (bypasses Phaser input lag)
- ✅ Key repeat prevention
- ✅ Window blur handling (releases all keys)
- ✅ Held key tracking
- ✅ Sub-frame timing accuracy (±2ms measured)

**Code Evidence**:
```javascript
// PreciseInput.js - Direct DOM events for minimal latency
_onKeyDown(event) {
  if (!this.enabled) return;
  if (event.repeat) return; // Prevent key repeat

  const keyCode = event.code;
  const direction = this.controls.getDirectionForKey(keyCode);

  if (direction !== -1 && !this.heldKeys.has(keyCode)) {
    this.heldKeys.add(keyCode);
    this.heldDirections[direction] = true;

    this.pressQueue.push({
      direction,
      timestamp: performance.now(), // High-precision timestamp
      keyCode
    });
  }
}

// PlayState.js - Queue processing
processInputQueue() {
  if (this.preciseInput) {
    const presses = this.preciseInput.consumePresses();
    const releases = this.preciseInput.consumeReleases();

    this.inputPressQueue.push(...presses);
    this.inputReleaseQueue.push(...releases);
  }

  // Process all queued inputs (no drops)
  while (this.inputPressQueue.length > 0) {
    const input = this.inputPressQueue.shift();
    this.handleNoteInput(input.direction, input.timestamp);
  }
}
```

**What's Good**:
- ✅ Direct DOM events (lower latency than Phaser input)
- ✅ High-precision timestamps
- ✅ Input queue prevents drops
- ✅ Tested at ±2ms accuracy (exceeds ±5ms target)

**What Could Be Better**:
- ⚠️ No explicit input buffering window
- ⚠️ No input prediction/anticipation
- ⚠️ No input smoothing for jitter
- ⚠️ No configurable input delay compensation

**Recommended Enhancements**:

### Input Buffer System
```javascript
class InputBuffer {
  constructor(bufferWindowMs = 50) {
    this.bufferWindowMs = bufferWindowMs;
    this.bufferedInputs = [];
  }

  addInput(input, songPosition) {
    // Buffer inputs slightly ahead of notes
    this.bufferedInputs.push({
      ...input,
      validUntil: songPosition + this.bufferWindowMs
    });
  }

  getValidInputs(songPosition) {
    // Return inputs that are still valid
    return this.bufferedInputs.filter(input =>
      input.validUntil >= songPosition
    );
  }

  clearExpired(songPosition) {
    this.bufferedInputs = this.bufferedInputs.filter(input =>
      input.validUntil >= songPosition
    );
  }
}
```

### Input Delay Compensation
```javascript
// In OptionsState.js - Add input delay setting
{
  name: 'Input Delay',
  key: 'inputDelay',
  type: 'slider',
  value: 0,
  defaultValue: 0,
  min: -50,
  max: 50,
  step: 1
}

// In PlayState.js - Apply delay compensation
handleNoteInput(direction, timestamp) {
  const inputDelay = this.getOption('inputDelay', 0);
  const adjustedTimestamp = timestamp + inputDelay;

  // Use adjusted timestamp for hit detection
  const note = this.playerStrumline.getClosestNote(direction, this.songPosition);
  if (note) {
    const timing = note.strumTime - (this.songPosition + inputDelay);
    // ...
  }
}
```

**Comparison**: 🟡 **Good foundation, could match Kade with enhancements**

**Priority**: 🟠 **HIGH** - Competitive players care about input accuracy

---

## 4. Expanded Gameplay HUD Stats (Accuracy, Combo Breaks, NPS, Grade/Rating)

### Kade Engine Implementation
- Real-time accuracy display
- Combo break counter
- Notes-per-second (NPS) meter
- Grade/rating during play
- Miss counter
- Always visible stats

### FNF Phaser Implementation ⚠️

**Status**: 🟡 **PARTIALLY IMPLEMENTED** - Basic stats, missing advanced features

**Files**:
- `src/play/ScoreDisplay.js` - Score and stats display
- `src/play/PlayState.js` - Stat tracking

**Features Implemented**:
- ✅ Score display with lerping animation
- ✅ Combo counter
- ✅ Accuracy percentage (weighted by judgement)
- ✅ Miss counter (optional, hidden by default)
- ✅ Configurable visibility options
- ✅ Tallies tracking (sick, good, bad, shit, missed)

**Code Evidence**:
```javascript
// ScoreDisplay.js - Basic stats
buildText() {
  const parts = [];
  parts.push(`Score: ${this.formatNumber(this.score)}`);

  if (this.showCombo && this.combo > 0) {
    parts.push(`Combo: ${this.combo}`);
  }

  if (this.showAccuracy) {
    parts.push(`Accuracy: ${this.accuracy.toFixed(2)}%`);
  }

  if (this.showMisses) {
    parts.push(`Misses: ${this.misses}`);
  }

  return parts.join(' | ');
}

// Weighted accuracy calculation
static calculateAccuracy(tallies) {
  const sick = tallies.sick ?? 0;
  const good = tallies.good ?? 0;
  const bad = tallies.bad ?? 0;
  const shit = tallies.shit ?? 0;

  // Weighted: sick=100%, good=75%, bad=50%, shit=25%
  const weightedHits = sick * 1.0 + good * 0.75 + bad * 0.5 + shit * 0.25;
  const maxPossible = totalHit;

  return (weightedHits / maxPossible) * 100;
}
```

**What's Good**:
- ✅ Score, combo, accuracy, misses
- ✅ Weighted accuracy calculation
- ✅ Configurable visibility
- ✅ Smooth score lerping

**What's Missing**:
- ❌ Combo break counter (separate from misses)
- ❌ Notes-per-second (NPS) meter
- ❌ Real-time grade/rating display
- ❌ Judgement breakdown (sick/good/bad/shit counts)
- ❌ Peak NPS tracking
- ❌ Average NPS display

**Recommended Enhancements**:

### Expanded Stats Display
```javascript
class ExpandedStatsDisplay extends ScoreDisplay {
  constructor(scene, config = {}) {
    super(scene, config);

    // Additional stats
    this.comboBreaks = 0;
    this.currentNPS = 0;
    this.peakNPS = 0;
    this.averageNPS = 0;
    this.currentGrade = 'N/A';

    // Judgement counts
    this.judgements = {
      sick: 0,
      good: 0,
      bad: 0,
      shit: 0
    };

    // NPS calculation
    this.recentNotes = [];
    this.npsWindow = 1000; // 1 second window
  }

  updateNPS(timestamp) {
    // Add current note
    this.recentNotes.push(timestamp);

    // Remove notes outside window
    const cutoff = timestamp - this.npsWindow;
    this.recentNotes = this.recentNotes.filter(t => t >= cutoff);

    // Calculate NPS
    this.currentNPS = this.recentNotes.length;
    this.peakNPS = Math.max(this.peakNPS, this.currentNPS);

    // Calculate average
    const totalTime = timestamp / 1000; // seconds
    const totalNotes = this.judgements.sick + this.judgements.good +
                       this.judgements.bad + this.judgements.shit;
    this.averageNPS = totalNotes / totalTime;
  }

  updateGrade(accuracy, misses) {
    // Calculate grade based on accuracy and misses
    if (accuracy >= 100 && misses === 0) {
      this.currentGrade = 'S++';
    } else if (accuracy >= 95 && misses === 0) {
      this.currentGrade = 'S+';
    } else if (accuracy >= 90) {
      this.currentGrade = 'S';
    } else if (accuracy >= 85) {
      this.currentGrade = 'A';
    } else if (accuracy >= 80) {
      this.currentGrade = 'B';
    } else if (accuracy >= 70) {
      this.currentGrade = 'C';
    } else if (accuracy >= 60) {
      this.currentGrade = 'D';
    } else {
      this.currentGrade = 'F';
    }
  }

  buildText() {
    const parts = [];

    // Score and combo
    parts.push(`Score: ${this.formatNumber(this.score)}`);
    if (this.combo > 0) {
      parts.push(`Combo: ${this.combo}`);
    }

    // Accuracy and grade
    parts.push(`Accuracy: ${this.accuracy.toFixed(2)}% [${this.currentGrade}]`);

    // Misses and combo breaks
    if (this.showMisses) {
      parts.push(`Misses: ${this.misses} | Breaks: ${this.comboBreaks}`);
    }

    // NPS
    if (this.showNPS) {
      parts.push(`NPS: ${this.currentNPS} (Peak: ${this.peakNPS})`);
    }

    // Judgements
    if (this.showJudgements) {
      parts.push(`[${this.judgements.sick}/${this.judgements.good}/${this.judgements.bad}/${this.judgements.shit}]`);
    }

    return parts.join('\n');
  }
}
```

### Options for Stats Display
```javascript
// In OptionsState.js
{
  name: 'HUD Stats',
  items: [
    { name: 'Show Accuracy', key: 'showAccuracy', type: 'toggle', value: true },
    { name: 'Show Misses', key: 'showMisses', type: 'toggle', value: true },
    { name: 'Show Combo Breaks', key: 'showComboBreaks', type: 'toggle', value: true },
    { name: 'Show NPS', key: 'showNPS', type: 'toggle', value: true },
    { name: 'Show Grade', key: 'showGrade', type: 'toggle', value: true },
    { name: 'Show Judgements', key: 'showJudgements', type: 'toggle', value: false }
  ]
}
```

**Comparison**: 🟡 **Basic stats present, missing advanced Kade features**

**Priority**: 🟡 **MEDIUM** - Competitive players want detailed stats

---

## 5. Upscroll Support (First-Class/Visible Option)

### Kade Engine Implementation
- Upscroll as first-class feature
- Visible toggle in options
- Works on all platforms including mobile
- Proper note scrolling direction
- Adjusted UI positioning

### FNF Phaser Implementation ⚠️

**Status**: 🟡 **PARTIALLY IMPLEMENTED** - Option exists, needs testing

**Files**:
- `src/ui/OptionsState.js` - Downscroll toggle
- `src/play/Strumline.js` - Scroll direction support

**Features Implemented**:
- ✅ Downscroll toggle in options
- ✅ Scroll direction parameter in Strumline
- ⚠️ Implementation exists but not fully tested

**Code Evidence**:
```javascript
// OptionsState.js - Downscroll option
{
  name: 'Gameplay',
  items: [
    { name: 'Downscroll', key: 'downscroll', type: 'toggle', value: false, defaultValue: false },
    // ...
  ]
}

// Strumline.js - Scroll direction support
constructor(scene, isPlayer = true, noteStyle = null, scrollSpeed = 1.0, downscroll = false) {
  // ...
  this.downscroll = downscroll;
}
```

**What's Good**:
- ✅ Option exists in settings
- ✅ Strumline supports scroll direction parameter
- ✅ Saved to localStorage

**What's Missing/Uncertain**:
- ⚠️ Not tested on mobile platforms
- ⚠️ UI positioning may need adjustment for upscroll
- ⚠️ Receptor positioning may need adjustment
- ⚠️ Note spawn direction may need verification

**Recommended Enhancements**:

### Complete Upscroll Implementation
```javascript
// In Strumline.js - Ensure proper scroll direction
update(songPosition) {
  const scrollDirection = this.downscroll ? 1 : -1;
  const scrollOffset = (songPosition - note.strumTime) * this.scrollSpeed * scrollDirection;

  note.y = this.receptorY + scrollOffset;

  // Cull notes that are off-screen
  if (this.downscroll) {
    if (note.y > this.scene.cameras.main.height + 100) {
      note.kill();
    }
  } else {
    if (note.y < -100) {
      note.kill();
    }
  }
}

// Adjust receptor positioning
positionReceptors() {
  const baseY = this.downscroll ?
    this.scene.cameras.main.height - 100 : // Bottom for downscroll
    100; // Top for upscroll

  this.receptors.forEach((receptor, i) => {
    receptor.y = baseY;
  });
}
```

### UI Adjustments for Upscroll
```javascript
// In PlayState.js - Adjust HUD positioning
createHUD() {
  const downscroll = this.getOption('downscroll', false);

  // Position score display
  const scoreY = downscroll ? 50 : this.cameras.main.height - 50;
  this.scoreDisplay.setPosition(this.cameras.main.width - 20, scoreY);

  // Position health bar
  const healthY = downscroll ? this.cameras.main.height - 50 : 50;
  this.healthBar.setPosition(this.cameras.main.width / 2, healthY);
}
```

**Comparison**: 🟡 **Option exists, needs full implementation and testing**

**Priority**: 🟢 **LOW** - Nice to have, not critical for most players

---

## Summary & Recommendations

### Implementation Status

| Feature | Status | Effort | Priority | Recommendation |
|---------|--------|--------|----------|----------------|
| Custom Keybinds | ✅ Complete | N/A | High | ✅ No action needed |
| Replay System | 🔴 Missing | High | Medium | 🔵 Implement in Phase 11 |
| Competitive Input | 🟡 Partial | Medium | High | 🟠 Enhance in Phase 11 |
| Expanded HUD Stats | 🟡 Partial | Medium | Medium | 🟡 Enhance in Phase 11 |
| Upscroll Support | 🟡 Partial | Low | Low | 🟢 Complete in Phase 11 |

### Phase 11 Roadmap: Competitive Features

#### Priority 1: Input System Enhancements (High Priority)
**Estimated Time**: 1-2 weeks

1. **Input Buffer System**
   - Implement 50ms input buffer window
   - Add buffer configuration option
   - Test with various timing windows

2. **Input Delay Compensation**
   - Add input delay slider (-50ms to +50ms)
   - Apply delay to hit detection
   - Save to user preferences

3. **Input Statistics**
   - Track input timing distribution
   - Display average timing offset
   - Show early/late hit ratio

**Files to Create/Modify**:
- `src/input/InputBuffer.js` (new)
- `src/input/PreciseInput.js` (enhance)
- `src/ui/OptionsState.js` (add options)
- `src/play/PlayState.js` (integrate buffer)

#### Priority 2: Expanded HUD Stats (Medium Priority)
**Estimated Time**: 1 week

1. **NPS Meter**
   - Real-time NPS calculation
   - Peak NPS tracking
   - Average NPS display

2. **Grade Display**
   - Real-time grade calculation
   - Grade thresholds configuration
   - Visual grade indicator

3. **Combo Break Counter**
   - Track combo breaks separately from misses
   - Display combo break count
   - Combo break history

4. **Judgement Breakdown**
   - Display sick/good/bad/shit counts
   - Configurable visibility
   - Compact display format

**Files to Create/Modify**:
- `src/play/ExpandedStatsDisplay.js` (new, extends ScoreDisplay)
- `src/play/ScoreDisplay.js` (enhance)
- `src/ui/OptionsState.js` (add HUD options)

#### Priority 3: Replay System (Medium Priority)
**Estimated Time**: 2-3 weeks

1. **Replay Recording**
   - Record all inputs with timestamps
   - Save replay data to file
   - Auto-save after each song

2. **Replay Playback**
   - Load replay data
   - Deterministic playback
   - Visual replay indicator

3. **Replay Management**
   - Replay browser UI
   - Replay deletion
   - Replay metadata display

**Files to Create/Modify**:
- `src/replay/ReplayRecorder.js` (new)
- `src/replay/ReplayPlayer.js` (new)
- `src/replay/ReplayManager.js` (new)
- `src/ui/ReplayBrowserState.js` (new)
- `src/data/SaveManager.js` (add replay methods)
- `src/play/PlayState.js` (integrate recording/playback)

#### Priority 4: Upscroll Completion (Low Priority)
**Estimated Time**: 3-5 days

1. **Complete Upscroll Implementation**
   - Verify note scrolling direction
   - Adjust receptor positioning
   - Test on all platforms

2. **UI Adjustments**
   - Reposition HUD elements for upscroll
   - Adjust health bar position
   - Adjust score display position

3. **Mobile Testing**
   - Test upscroll on mobile browsers
   - Verify touch controls work
   - Fix any platform-specific issues

**Files to Modify**:
- `src/play/Strumline.js` (verify scroll direction)
- `src/play/PlayState.js` (adjust HUD positioning)
- `src/ui/OptionsState.js` (ensure option works)

### Testing Requirements

Each feature enhancement requires:
- Unit tests for new functionality
- Integration tests for gameplay impact
- Performance testing (ensure 60 FPS maintained)
- Cross-browser testing
- User acceptance testing

### Estimated Total Effort

**Phase 11: Competitive Features**
- Input Enhancements: 1-2 weeks
- Expanded HUD Stats: 1 week
- Replay System: 2-3 weeks
- Upscroll Completion: 3-5 days

**Total**: 5-7 weeks for all competitive features

### Conclusion

The FNF Phaser implementation has a **strong foundation** with custom keybinds fully implemented and competitive input handling partially complete. The main gaps are:

1. **Replay System** - Completely missing, would require new implementation
2. **Expanded HUD Stats** - Basic stats present, needs NPS, grade, and breakdown
3. **Competitive Input** - Good foundation, needs buffer and delay compensation
4. **Upscroll** - Option exists, needs completion and testing

With focused development in Phase 11, the FNF Phaser implementation can **match or exceed** Kade Engine's competitive features while maintaining the clean architecture and excellent performance already achieved.

---

*Last Updated*: December 24, 2025
*Current Phase*: Phase 9 Complete
*Next Phase*: Phase 10 (Deployment) → Phase 11 (Competitive Features)
