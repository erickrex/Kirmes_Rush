# Manual Testing Guide - Tutorial Song Playthrough

This guide provides instructions for manually testing a full playthrough of the Tutorial song to verify all gameplay systems are working correctly.

## Prerequisites

1. Ensure the development server is running:
   ```bash
   npm run dev
   ```

2. Open the game in a browser at `http://localhost:3000`

## Test Checklist

### Phase 1: Initial Load
- [ ] Game loads without errors in browser console
- [ ] Title screen displays correctly
- [ ] Press Enter to proceed to main menu

### Phase 2: Song Selection
- [ ] Main menu displays with options (Story Mode, Freeplay, Options)
- [ ] Navigate to Freeplay
- [ ] Tutorial song is visible in the song list
- [ ] Select Tutorial song
- [ ] Select Normal difficulty

### Phase 3: Countdown
- [ ] Countdown displays: 3, 2, 1, GO
- [ ] Countdown sounds play (if audio is implemented)
- [ ] Characters are visible and positioned correctly
- [ ] Stage background is visible
- [ ] Strumlines (note receptors) are visible for both player and opponent

### Phase 4: Gameplay - Note Hitting
- [ ] Notes scroll down (or up if downscroll is enabled)
- [ ] Player notes appear on the right strumline
- [ ] Opponent notes appear on the left strumline
- [ ] Pressing arrow keys (or WASD) hits notes
- [ ] Hit notes disappear from the strumline
- [ ] Receptor arrows light up when keys are pressed
- [ ] Judgement text appears (SICK, GOOD, BAD, SHIT)
- [ ] Combo counter increases on successful hits
- [ ] Score increases on successful hits

### Phase 5: Gameplay - Character Animations
- [ ] Player character (Boyfriend) plays sing animations when hitting notes
- [ ] Opponent character (Girlfriend) plays sing animations automatically
- [ ] Characters return to idle animation after singing
- [ ] Characters bop to the beat during idle

### Phase 6: Gameplay - Health System
- [ ] Health bar is visible at the bottom of the screen
- [ ] Health bar fills toward player side on successful hits
- [ ] Health bar drains toward opponent side on misses
- [ ] Health icons are visible on both sides of the health bar
- [ ] Health icons animate/change based on health level

### Phase 7: Gameplay - Missed Notes
- [ ] Missing a note (not pressing key) triggers miss
- [ ] Combo resets to 0 on miss
- [ ] Health decreases on miss
- [ ] Player character plays miss animation
- [ ] Player vocals mute on miss (if audio is implemented)

### Phase 8: Gameplay - Hold Notes
- [ ] Hold notes (sustain trails) are visible
- [ ] Holding the key during a hold note works correctly
- [ ] Releasing early on a hold note triggers appropriate penalty
- [ ] Hold notes grant continuous score while held

### Phase 9: Gameplay - Camera
- [ ] Camera focuses on opponent during opponent's turn
- [ ] Camera focuses on player during player's turn
- [ ] Camera zooms slightly on beats
- [ ] Camera transitions are smooth

### Phase 10: Song End
- [ ] Song plays to completion
- [ ] Final score is calculated
- [ ] Rank is displayed (PERFECT GOLD, PERFECT, EXCELLENT, GREAT, GOOD, SHIT)
- [ ] Results screen shows:
  - Final score
  - Accuracy percentage
  - Combo breakdown (SICK, GOOD, BAD, SHIT, MISS counts)
  - Max combo achieved
- [ ] Can return to song selection or main menu

## Performance Checks

- [ ] Game maintains 60 FPS throughout playthrough
- [ ] No visible lag or stuttering
- [ ] Audio stays in sync with visuals (if audio is implemented)
- [ ] No memory leaks (check browser dev tools)

## Edge Cases to Test

### Input Testing
- [ ] Rapid key presses don't cause issues
- [ ] Pressing wrong direction doesn't hit notes
- [ ] Pressing keys when no notes are present (ghost tapping)
- [ ] Multiple keys pressed simultaneously

### Timing Testing
- [ ] Hitting notes very early (before hit window)
- [ ] Hitting notes very late (after hit window)
- [ ] Hitting notes at different timing offsets (early, perfect, late)

### Pause/Resume
- [ ] Pressing ESC pauses the game
- [ ] Pause menu displays correctly
- [ ] Resuming continues gameplay correctly
- [ ] Audio resumes in sync (if audio is implemented)

## Expected Results

### Perfect Playthrough (All SICK hits)
- Final Score: ~4000+ (8 notes × 500 points each)
- Rank: PERFECT GOLD
- Health: Near maximum (2.0)
- Combo: 8 (all notes hit)
- Tallies:
  - SICK: 8
  - GOOD: 0
  - BAD: 0
  - SHIT: 0
  - MISS: 0

### Mixed Performance
- Final Score: Varies based on judgements
- Rank: EXCELLENT, GREAT, or GOOD depending on accuracy
- Health: Between 0.5 and 2.0
- Combo: Varies (resets on misses)

### Failed Playthrough
- Health reaches 0
- Game Over screen displays
- Option to retry or return to menu

## Reporting Issues

When reporting issues, please include:
1. Browser and version
2. Operating system
3. Console errors (if any)
4. Steps to reproduce
5. Expected vs actual behavior
6. Screenshots or video if possible

## Automated Testing Note

Due to Phaser's dependency on browser APIs (Canvas, WebGL, Web Audio), automated integration tests require a complex setup with canvas mocking. For now, manual testing is the recommended approach for full playthrough validation.

Future improvements could include:
- Headless browser testing with Puppeteer or Playwright
- Canvas mocking with node-canvas
- Separate logic tests that don't require rendering
