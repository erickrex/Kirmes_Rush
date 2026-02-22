# Tutorial Song - Test Report Template

## Test Information

- **Date:** [Fill in]
- **Tester:** [Fill in]
- **Browser:** [Fill in] (e.g., Chrome 120, Firefox 121, Safari 17)
- **OS:** [Fill in] (e.g., Windows 11, macOS 14, Ubuntu 22.04)
- **Build/Commit:** [Fill in]

## Test Execution Summary

| Category | Tests Passed | Tests Failed | Notes |
|----------|--------------|--------------|-------|
| Initial Load | / | / | |
| Song Selection | / | / | |
| Countdown | / | / | |
| Note Hitting | / | / | |
| Character Animations | / | / | |
| Health System | / | / | |
| Missed Notes | / | / | |
| Hold Notes | / | / | |
| Camera System | / | / | |
| Song End | / | / | |
| **TOTAL** | **/ 10** | **/ 10** | |

## Detailed Test Results

### 1. Initial Load ✅ / ❌

- [ ] Game loads without console errors
- [ ] Title screen displays
- [ ] Can proceed to main menu

**Notes:**
```
[Add any observations or issues]
```

### 2. Song Selection ✅ / ❌

- [ ] Main menu displays correctly
- [ ] Can navigate to Freeplay
- [ ] Tutorial song is visible
- [ ] Can select difficulty

**Notes:**
```
[Add any observations or issues]
```

### 3. Countdown ✅ / ❌

- [ ] Countdown displays (3, 2, 1, GO)
- [ ] Countdown timing is correct
- [ ] Characters visible
- [ ] Stage visible
- [ ] Strumlines visible

**Notes:**
```
[Add any observations or issues]
```

### 4. Note Hitting ✅ / ❌

- [ ] Notes scroll correctly
- [ ] Player can hit notes with arrow keys
- [ ] Hit notes disappear
- [ ] Receptors light up on press
- [ ] Judgement text appears
- [ ] Combo increases
- [ ] Score increases

**Notes:**
```
[Add any observations or issues]
```

### 5. Character Animations ✅ / ❌

- [ ] Player sings on note hit
- [ ] Opponent sings automatically
- [ ] Characters return to idle
- [ ] Characters bop to beat

**Notes:**
```
[Add any observations or issues]
```

### 6. Health System ✅ / ❌

- [ ] Health bar visible
- [ ] Health increases on hits
- [ ] Health decreases on misses
- [ ] Health icons visible
- [ ] Health icons animate

**Notes:**
```
[Add any observations or issues]
```

### 7. Missed Notes ✅ / ❌

- [ ] Missing notes triggers miss
- [ ] Combo resets on miss
- [ ] Health decreases on miss
- [ ] Miss animation plays
- [ ] Vocals mute on miss (if audio implemented)

**Notes:**
```
[Add any observations or issues]
```

### 8. Hold Notes ✅ / ❌

- [ ] Hold notes visible
- [ ] Can hold notes
- [ ] Early release penalty works
- [ ] Continuous scoring while held

**Notes:**
```
[Add any observations or issues]
```

### 9. Camera System ✅ / ❌

- [ ] Camera focuses on opponent
- [ ] Camera focuses on player
- [ ] Camera zooms on beats
- [ ] Transitions are smooth

**Notes:**
```
[Add any observations or issues]
```

### 10. Song End ✅ / ❌

- [ ] Song completes
- [ ] Final score calculated
- [ ] Rank displayed
- [ ] Results screen shows all stats
- [ ] Can return to menu

**Notes:**
```
[Add any observations or issues]
```

## Performance Metrics

| Metric | Target | Actual | Pass/Fail |
|--------|--------|--------|-----------|
| Frame Rate | 60 FPS | [Fill in] | ✅ / ❌ |
| Load Time | < 5s | [Fill in] | ✅ / ❌ |
| Memory Usage | Stable | [Fill in] | ✅ / ❌ |
| Audio Sync | ±5ms | [Fill in] | ✅ / ❌ |

## Test Scenarios

### Scenario 1: Perfect Playthrough
**Objective:** Hit all notes with SICK judgement

**Steps:**
1. Start Tutorial song
2. Hit all 8 player notes perfectly (0ms timing)
3. Complete song

**Expected Results:**
- Score: ~4000
- Rank: PERFECT GOLD
- Health: Near maximum
- Tallies: 8 SICK, 0 GOOD, 0 BAD, 0 SHIT, 0 MISS

**Actual Results:**
```
Score: [Fill in]
Rank: [Fill in]
Health: [Fill in]
Tallies: [Fill in]
```

**Status:** ✅ PASS / ❌ FAIL

---

### Scenario 2: Mixed Performance
**Objective:** Hit notes with varying timing

**Steps:**
1. Start Tutorial song
2. Hit notes with different timing offsets
3. Complete song

**Expected Results:**
- Score: 2000-3500
- Rank: EXCELLENT or GREAT
- Health: 1.0-1.8
- Tallies: Mix of SICK, GOOD, BAD

**Actual Results:**
```
Score: [Fill in]
Rank: [Fill in]
Health: [Fill in]
Tallies: [Fill in]
```

**Status:** ✅ PASS / ❌ FAIL

---

### Scenario 3: Missed Notes
**Objective:** Test miss detection and combo breaks

**Steps:**
1. Start Tutorial song
2. Hit first note
3. Intentionally miss second note
4. Hit remaining notes

**Expected Results:**
- Combo resets to 0 after miss
- Health decreases on miss
- Miss count increases
- Player plays miss animation

**Actual Results:**
```
[Fill in observations]
```

**Status:** ✅ PASS / ❌ FAIL

---

### Scenario 4: Hold Notes
**Objective:** Test hold note mechanics

**Steps:**
1. Start Tutorial song
2. Find hold note (note #5 at 2400ms)
3. Hold key for full duration
4. Try releasing early on another hold

**Expected Results:**
- Holding full duration grants continuous score
- Early release triggers penalty
- Hold trail renders correctly

**Actual Results:**
```
[Fill in observations]
```

**Status:** ✅ PASS / ❌ FAIL

## Issues Found

### Issue #1
**Severity:** Critical / High / Medium / Low
**Description:**
```
[Describe the issue]
```
**Steps to Reproduce:**
```
1. [Step 1]
2. [Step 2]
3. [Step 3]
```
**Expected Behavior:**
```
[What should happen]
```
**Actual Behavior:**
```
[What actually happens]
```
**Screenshots/Video:**
```
[Link or attach]
```

---

### Issue #2
[Repeat format for additional issues]

---

## Browser Compatibility

| Browser | Version | Status | Notes |
|---------|---------|--------|-------|
| Chrome | [Fill in] | ✅ / ❌ | |
| Firefox | [Fill in] | ✅ / ❌ | |
| Safari | [Fill in] | ✅ / ❌ | |
| Edge | [Fill in] | ✅ / ❌ | |

## Recommendations

### Critical Issues
```
[List any critical issues that must be fixed before release]
```

### Improvements
```
[List suggested improvements or enhancements]
```

### Next Steps
```
[Outline what should be tested next or what needs to be implemented]
```

## Sign-off

**Tester Signature:** _____________________ **Date:** _____________________

**Reviewer Signature:** _____________________ **Date:** _____________________

---

## Appendix: Console Logs

```
[Paste any relevant console logs or error messages]
```

## Appendix: Screenshots

[Attach screenshots of key moments: countdown, gameplay, results screen, any errors]
