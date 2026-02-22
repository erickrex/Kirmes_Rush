# Song Testing Checklist

This document provides a comprehensive checklist for testing all songs across all weeks in the FNF Phaser migration.

## Testing Approach

Due to Phaser's dependency on browser APIs (Canvas, WebGL, Web Audio), manual testing is the recommended approach for full song playthroughs. This checklist ensures consistent testing across all songs.

## Prerequisites

1. Start the development server:
   ```bash
   cd fnf-phaser
   npm run dev
   ```

2. Open the game in a browser at `http://localhost:3000`

3. Ensure you have a working keyboard for input testing

## Test Categories

### 1. Asset Loading Test
**Purpose**: Verify all song assets load correctly

For each song:
- [ ] Chart JSON loads without errors
- [ ] Metadata JSON loads without errors
- [ ] Instrumental audio loads
- [ ] Vocal tracks load (player and opponent)
- [ ] Character sprites load
- [ ] Stage background loads
- [ ] Note style assets load

### 2. Gameplay Test
**Purpose**: Verify core gameplay mechanics work correctly

For each song:
- [ ] Countdown displays correctly (3, 2, 1, GO)
- [ ] Notes scroll at correct speed
- [ ] Player notes appear on correct strumline
- [ ] Opponent notes appear on correct strumline
- [ ] Hit detection works (notes can be hit)
- [ ] Judgements display correctly (SICK, GOOD, BAD, SHIT)
- [ ] Combo counter updates correctly
- [ ] Score increases on hits
- [ ] Health bar updates correctly
- [ ] Health icons display and animate
- [ ] Song plays to completion

### 3. Character Animation Test
**Purpose**: Verify character animations sync correctly

For each song:
- [ ] Player character animates on note hits
- [ ] Opponent character animates on note hits
- [ ] Girlfriend character bops to beat
- [ ] Characters return to idle after singing
- [ ] Miss animations play correctly

### 4. Audio Sync Test
**Purpose**: Verify audio stays in sync with visuals

For each song:
- [ ] Instrumental plays at correct time
- [ ] Vocals sync with instrumental
- [ ] Notes appear at correct timing
- [ ] No audio drift during playthrough
- [ ] Audio resumes correctly after pause

### 5. Performance Test
**Purpose**: Verify game maintains acceptable performance

For each song:
- [ ] Maintains 60 FPS throughout
- [ ] No visible lag or stuttering
- [ ] No memory leaks (check browser dev tools)
- [ ] Smooth camera movements

## Song-by-Song Testing

### Tutorial
- **Week**: Tutorial
- **Songs**: Tutorial
- **Difficulty**: Normal
- **Special Notes**: Simple pattern, good for initial testing

**Test Results**:
- [ ] Asset Loading: PASS / FAIL
- [ ] Gameplay: PASS / FAIL
- [ ] Character Animation: PASS / FAIL
- [ ] Audio Sync: PASS / FAIL
- [ ] Performance: PASS / FAIL
- **Notes**: _____________________

---

### Week 1: Daddy Dearest
**Stage**: stage
**Characters**: bf (player), dad (opponent), gf (girlfriend)

#### Bopeebo
- **Difficulties**: Easy, Normal, Hard
- **BPM**: 100
- **Special Notes**: First song, simple pattern

**Test Results**:
- [ ] Asset Loading: PASS / FAIL
- [ ] Gameplay: PASS / FAIL
- [ ] Character Animation: PASS / FAIL
- [ ] Audio Sync: PASS / FAIL
- [ ] Performance: PASS / FAIL
- **Notes**: _____________________

#### Fresh
- **Difficulties**: Easy, Normal, Hard
- **BPM**: 100
- **Special Notes**: Moderate difficulty

**Test Results**:
- [ ] Asset Loading: PASS / FAIL
- [ ] Gameplay: PASS / FAIL
- [ ] Character Animation: PASS / FAIL
- [ ] Audio Sync: PASS / FAIL
- [ ] Performance: PASS / FAIL
- **Notes**: _____________________

#### Dad Battle
- **Difficulties**: Easy, Normal, Hard
- **BPM**: 100
- **Special Notes**: Harder patterns

**Test Results**:
- [ ] Asset Loading: PASS / FAIL
- [ ] Gameplay: PASS / FAIL
- [ ] Character Animation: PASS / FAIL
- [ ] Audio Sync: PASS / FAIL
- [ ] Performance: PASS / FAIL
- **Notes**: _____________________

---

### Week 2: Spooky Month
**Stage**: spookyMansion
**Characters**: bf (player), spooky (opponent), gf (girlfriend)

#### Spookeez
- **Difficulties**: Easy, Normal, Hard
- **BPM**: 120
- **Special Notes**: Faster tempo

**Test Results**:
- [ ] Asset Loading: PASS / FAIL
- [ ] Gameplay: PASS / FAIL
- [ ] Character Animation: PASS / FAIL
- [ ] Audio Sync: PASS / FAIL
- [ ] Performance: PASS / FAIL
- **Notes**: _____________________

#### South
- **Difficulties**: Easy, Normal, Hard
- **BPM**: 120
- **Special Notes**: Moderate difficulty

**Test Results**:
- [ ] Asset Loading: PASS / FAIL
- [ ] Gameplay: PASS / FAIL
- [ ] Character Animation: PASS / FAIL
- [ ] Audio Sync: PASS / FAIL
- [ ] Performance: PASS / FAIL
- **Notes**: _____________________

#### Monster
- **Difficulties**: Easy, Normal, Hard
- **BPM**: 120
- **Special Notes**: Different opponent character

**Test Results**:
- [ ] Asset Loading: PASS / FAIL
- [ ] Gameplay: PASS / FAIL
- [ ] Character Animation: PASS / FAIL
- [ ] Audio Sync: PASS / FAIL
- [ ] Performance: PASS / FAIL
- **Notes**: _____________________

---

### Week 3: Pico
**Stage**: phillyStreets
**Characters**: bf (player), pico (opponent), gf (girlfriend)

#### Pico
- **Difficulties**: Easy, Normal, Hard
- **BPM**: 140
- **Special Notes**: Fast tempo

**Test Results**:
- [ ] Asset Loading: PASS / FAIL
- [ ] Gameplay: PASS / FAIL
- [ ] Character Animation: PASS / FAIL
- [ ] Audio Sync: PASS / FAIL
- [ ] Performance: PASS / FAIL
- **Notes**: _____________________

#### Philly Nice
- **Difficulties**: Easy, Normal, Hard
- **BPM**: 140
- **Special Notes**: Complex patterns

**Test Results**:
- [ ] Asset Loading: PASS / FAIL
- [ ] Gameplay: PASS / FAIL
- [ ] Character Animation: PASS / FAIL
- [ ] Audio Sync: PASS / FAIL
- [ ] Performance: PASS / FAIL
- **Notes**: _____________________

#### Blammed
- **Difficulties**: Easy, Normal, Hard
- **BPM**: 140
- **Special Notes**: Very fast patterns

**Test Results**:
- [ ] Asset Loading: PASS / FAIL
- [ ] Gameplay: PASS / FAIL
- [ ] Character Animation: PASS / FAIL
- [ ] Audio Sync: PASS / FAIL
- [ ] Performance: PASS / FAIL
- **Notes**: _____________________

---

### Week 4: Mommy Mearest
**Stage**: limoRide
**Characters**: bf (player), mom (opponent), gf (girlfriend)

#### Satin Panties
- **Difficulties**: Easy, Normal, Hard
- **BPM**: 130
- **Special Notes**: Moderate tempo

**Test Results**:
- [ ] Asset Loading: PASS / FAIL
- [ ] Gameplay: PASS / FAIL
- [ ] Character Animation: PASS / FAIL
- [ ] Audio Sync: PASS / FAIL
- [ ] Performance: PASS / FAIL
- **Notes**: _____________________

#### High
- **Difficulties**: Easy, Normal, Hard
- **BPM**: 130
- **Special Notes**: Complex patterns

**Test Results**:
- [ ] Asset Loading: PASS / FAIL
- [ ] Gameplay: PASS / FAIL
- [ ] Character Animation: PASS / FAIL
- [ ] Audio Sync: PASS / FAIL
- [ ] Performance: PASS / FAIL
- **Notes**: _____________________

#### MILF
- **Difficulties**: Easy, Normal, Hard
- **BPM**: 130
- **Special Notes**: Very complex patterns

**Test Results**:
- [ ] Asset Loading: PASS / FAIL
- [ ] Gameplay: PASS / FAIL
- [ ] Character Animation: PASS / FAIL
- [ ] Audio Sync: PASS / FAIL
- [ ] Performance: PASS / FAIL
- **Notes**: _____________________

---

### Week 5: Christmas
**Stage**: mall / mall-evil
**Characters**: bf (player), parents-christmas / monster (opponent), gf (girlfriend)

#### Cocoa
- **Difficulties**: Easy, Normal, Hard
- **BPM**: 110
- **Special Notes**: Christmas theme

**Test Results**:
- [ ] Asset Loading: PASS / FAIL
- [ ] Gameplay: PASS / FAIL
- [ ] Character Animation: PASS / FAIL
- [ ] Audio Sync: PASS / FAIL
- [ ] Performance: PASS / FAIL
- **Notes**: _____________________

#### Eggnog
- **Difficulties**: Easy, Normal, Hard
- **BPM**: 110
- **Special Notes**: Moderate difficulty

**Test Results**:
- [ ] Asset Loading: PASS / FAIL
- [ ] Gameplay: PASS / FAIL
- [ ] Character Animation: PASS / FAIL
- [ ] Audio Sync: PASS / FAIL
- [ ] Performance: PASS / FAIL
- **Notes**: _____________________

#### Winter Horrorland
- **Difficulties**: Easy, Normal, Hard
- **BPM**: 110
- **Special Notes**: Stage changes, different opponent

**Test Results**:
- [ ] Asset Loading: PASS / FAIL
- [ ] Gameplay: PASS / FAIL
- [ ] Character Animation: PASS / FAIL
- [ ] Audio Sync: PASS / FAIL
- [ ] Performance: PASS / FAIL
- **Notes**: _____________________

---

### Week 6: Hating Simulator
**Stage**: school / school-evil
**Characters**: bf-pixel (player), senpai / spirit (opponent), gf-pixel (girlfriend)

**Special Notes**: Pixel art style, different scaling

#### Senpai
- **Difficulties**: Easy, Normal, Hard
- **BPM**: 120
- **Special Notes**: Pixel art, dialogue cutscene

**Test Results**:
- [ ] Asset Loading: PASS / FAIL
- [ ] Gameplay: PASS / FAIL
- [ ] Character Animation: PASS / FAIL
- [ ] Audio Sync: PASS / FAIL
- [ ] Performance: PASS / FAIL
- [ ] Pixel scaling correct: PASS / FAIL
- **Notes**: _____________________

#### Roses
- **Difficulties**: Easy, Normal, Hard
- **BPM**: 120
- **Special Notes**: Pixel art, dialogue cutscene

**Test Results**:
- [ ] Asset Loading: PASS / FAIL
- [ ] Gameplay: PASS / FAIL
- [ ] Character Animation: PASS / FAIL
- [ ] Audio Sync: PASS / FAIL
- [ ] Performance: PASS / FAIL
- [ ] Pixel scaling correct: PASS / FAIL
- **Notes**: _____________________

#### Thorns
- **Difficulties**: Easy, Normal, Hard
- **BPM**: 120
- **Special Notes**: Pixel art, stage changes, different opponent

**Test Results**:
- [ ] Asset Loading: PASS / FAIL
- [ ] Gameplay: PASS / FAIL
- [ ] Character Animation: PASS / FAIL
- [ ] Audio Sync: PASS / FAIL
- [ ] Performance: PASS / FAIL
- [ ] Pixel scaling correct: PASS / FAIL
- **Notes**: _____________________

---

### Week 7: Tankman
**Stage**: tankmanBattlefield
**Characters**: bf (player), tankman (opponent), gf-tankmen (girlfriend)

#### Ugh
- **Difficulties**: Easy, Normal, Hard
- **BPM**: 120
- **Special Notes**: Cutscene

**Test Results**:
- [ ] Asset Loading: PASS / FAIL
- [ ] Gameplay: PASS / FAIL
- [ ] Character Animation: PASS / FAIL
- [ ] Audio Sync: PASS / FAIL
- [ ] Performance: PASS / FAIL
- **Notes**: _____________________

#### Guns
- **Difficulties**: Easy, Normal, Hard
- **BPM**: 120
- **Special Notes**: Complex patterns

**Test Results**:
- [ ] Asset Loading: PASS / FAIL
- [ ] Gameplay: PASS / FAIL
- [ ] Character Animation: PASS / FAIL
- [ ] Audio Sync: PASS / FAIL
- [ ] Performance: PASS / FAIL
- **Notes**: _____________________

#### Stress
- **Difficulties**: Easy, Normal, Hard
- **BPM**: 120
- **Special Notes**: Very complex patterns, cutscenes

**Test Results**:
- [ ] Asset Loading: PASS / FAIL
- [ ] Gameplay: PASS / FAIL
- [ ] Character Animation: PASS / FAIL
- [ ] Audio Sync: PASS / FAIL
- [ ] Performance: PASS / FAIL
- **Notes**: _____________________

---

### Weekend 1: Pico's School
**Stage**: phillyStreets
**Characters**: pico (player), darnell / nene (opponent)

#### Darnell
- **Difficulties**: Easy, Normal, Hard
- **BPM**: 140
- **Special Notes**: Different player character

**Test Results**:
- [ ] Asset Loading: PASS / FAIL
- [ ] Gameplay: PASS / FAIL
- [ ] Character Animation: PASS / FAIL
- [ ] Audio Sync: PASS / FAIL
- [ ] Performance: PASS / FAIL
- **Notes**: _____________________

#### Lit Up
- **Difficulties**: Easy, Normal, Hard
- **BPM**: 140
- **Special Notes**: Moderate difficulty

**Test Results**:
- [ ] Asset Loading: PASS / FAIL
- [ ] Gameplay: PASS / FAIL
- [ ] Character Animation: PASS / FAIL
- [ ] Audio Sync: PASS / FAIL
- [ ] Performance: PASS / FAIL
- **Notes**: _____________________

#### 2hot
- **Difficulties**: Easy, Normal, Hard
- **BPM**: 140
- **Special Notes**: Complex patterns

**Test Results**:
- [ ] Asset Loading: PASS / FAIL
- [ ] Gameplay: PASS / FAIL
- [ ] Character Animation: PASS / FAIL
- [ ] Audio Sync: PASS / FAIL
- [ ] Performance: PASS / FAIL
- **Notes**: _____________________

#### Blazin
- **Difficulties**: Easy, Normal, Hard
- **BPM**: 140
- **Special Notes**: Very complex patterns, different opponent

**Test Results**:
- [ ] Asset Loading: PASS / FAIL
- [ ] Gameplay: PASS / FAIL
- [ ] Character Animation: PASS / FAIL
- [ ] Audio Sync: PASS / FAIL
- [ ] Performance: PASS / FAIL
- **Notes**: _____________________

---

## Summary

### Total Songs to Test
- Tutorial: 1 song
- Week 1: 3 songs
- Week 2: 3 songs
- Week 3: 3 songs
- Week 4: 3 songs
- Week 5: 3 songs
- Week 6: 3 songs
- Week 7: 3 songs
- Weekend 1: 4 songs

**Total: 26 songs**

### Testing Progress
- [ ] Tutorial (1/1)
- [ ] Week 1 (0/3)
- [ ] Week 2 (0/3)
- [ ] Week 3 (0/3)
- [ ] Week 4 (0/3)
- [ ] Week 5 (0/3)
- [ ] Week 6 (0/3)
- [ ] Week 7 (0/3)
- [ ] Weekend 1 (0/4)

**Overall Progress: 0/26 songs tested**

## Known Issues

Document any issues found during testing:

1. **Issue**: _____________________
   - **Song**: _____________________
   - **Severity**: Critical / High / Medium / Low
   - **Description**: _____________________
   - **Steps to Reproduce**: _____________________

## Testing Notes

- Manual testing is required due to Phaser's browser API dependencies
- Each song should be tested on at least Normal difficulty
- Focus on critical functionality first (asset loading, basic gameplay)
- Performance testing should be done on target browsers (Chrome, Firefox, Safari, Edge)
- Audio sync is critical for rhythm game accuracy

## Next Steps

After completing manual testing:
1. Document all issues found
2. Prioritize fixes based on severity
3. Create automated smoke tests for manifest validation
4. Consider headless browser testing for future automation
