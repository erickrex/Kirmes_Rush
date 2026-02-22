# Integration Tests

## Overview

This directory contains integration tests for the Friday Night Funkin' Phaser JS migration. These tests verify complete gameplay flows and system interactions.

## Current Status

⚠️ **Note:** Integration tests in this directory require browser APIs (Canvas, WebGL, Web Audio) that are not available in the Node.js test environment.

### Available Tests

- `TutorialPlaythrough.test.js` - Full playthrough test for Tutorial song

### Running Integration Tests

Due to Phaser's browser dependencies, Canvas/WebGL integration cases cannot run in the standard Node Vitest environment without additional setup.

```bash
cd fnf-phaser
npm run test:integration
```

`ManifestValidation` runs in Node. `TutorialPlaythrough` requires browser/canvas support and is expected to fail in plain Node.

#### Option 1: Manual Testing (Recommended)

Use the comprehensive manual testing guide:

```bash
# Start the dev server
npm run dev

# Open browser and follow the guide
# See: docs/MANUAL_TESTING.md
```

#### Option 2: Headless Browser Testing (Future)

To run these tests automatically, you would need to:

1. Install Puppeteer or Playwright
2. Set up a headless browser environment
3. Load the game in the browser
4. Simulate user interactions
5. Capture results

Example setup (not yet implemented):

```bash
npm install --save-dev puppeteer
# Create test runner that launches browser
# Run tests in browser context
```

#### Option 3: Canvas Mocking (Advanced)

To run in Node.js, you would need to:

1. Install node-canvas and related dependencies
2. Mock Canvas and WebGL APIs
3. Mock Web Audio API
4. Configure Vitest to use these mocks

This is complex and may not provide accurate results for visual/audio testing.

## Test Structure

### TutorialPlaythrough.test.js

This test demonstrates the expected integration test structure:

```javascript
describe('Tutorial Song - Full Playthrough', () => {
  // Setup mock scene and game state
  beforeEach(() => { /* ... */ });

  // Test complete gameplay flow
  it('should complete a full song playthrough with perfect hits', () => {
    // 1. Start countdown
    // 2. Hit all notes
    // 3. Verify score and tallies
    // 4. Check song completion
  });

  // Test various scenarios
  it('should handle mixed judgements', () => { /* ... */ });
  it('should handle missed notes', () => { /* ... */ });
  it('should process opponent notes', () => { /* ... */ });
});
```

## What Gets Tested

### Automated Unit Tests (tests/*.test.js)
✅ Individual component logic
✅ Calculations and algorithms
✅ State management
✅ Data parsing

### Manual Integration Tests (docs/MANUAL_TESTING.md)
✅ Complete gameplay flow
✅ Visual rendering
✅ Audio synchronization
✅ User interactions
✅ Performance metrics

### Integration Tests (this directory)
⚠️ Requires browser environment
⚠️ Currently reference implementation only
⚠️ Can be enabled with proper setup

## Future Improvements

### Short-term
- [ ] Add Puppeteer/Playwright setup
- [ ] Create automated browser test runner
- [ ] Implement screenshot comparison
- [ ] Add performance monitoring

### Long-term
- [ ] Full canvas mocking support
- [ ] Deterministic gameplay replay
- [ ] Automated visual regression testing
- [ ] CI/CD integration

## Contributing

When adding new integration tests:

1. **Document the test scenario** in `docs/MANUAL_TESTING.md`
2. **Create test code** in this directory (even if it can't run yet)
3. **Add to test report template** in `docs/TUTORIAL_TEST_REPORT.md`
4. **Update this README** with new test information

## Resources

- [Manual Testing Guide](../../docs/MANUAL_TESTING.md)
- [Test Report Template](../../docs/TUTORIAL_TEST_REPORT.md)
- [Testing Implementation Summary](../../docs/TESTING_IMPLEMENTATION.md)
- [Phaser Testing Best Practices](https://phaser.io/tutorials/testing)

## Questions?

See `docs/TESTING_IMPLEMENTATION.md` for a comprehensive explanation of our testing approach and the challenges with Phaser integration testing.
