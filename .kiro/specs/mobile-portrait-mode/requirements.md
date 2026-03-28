# Requirements Document

## Introduction

This feature converts the Friday Night Funkin' Phaser.js web game from its current landscape 1280x720 layout to a universal portrait (vertical) 720x1280 layout (9:16 aspect ratio). The portrait layout is the only layout — it applies on both desktop and mobile browsers. On desktop, the portrait canvas is centered in the browser window with black letterboxing on the left and right sides, and the player uses keyboard input. On mobile, the same portrait canvas is displayed with touch controls visible at the bottom of the screen. The game remains a browser-based Phaser 3 application.

## Glossary

- **Game**: The Friday Night Funkin' Phaser.js web application
- **Portrait_Canvas**: The 720x1280 (9:16 aspect ratio) Phaser canvas used as the sole game viewport on all platforms
- **Layout_Manager**: The module responsible for configuring the portrait canvas, scaling it to fit the browser window, and applying black letterboxing on desktop
- **Touch_Device_Detector**: The module that detects whether the device supports touch input, used solely to determine whether to show or hide touch controls
- **Touch_Input_Controller**: The module that renders touch input zones on screen and translates touch/pointer events into directional note inputs (left, down, up, right)
- **Player_Strumline**: The note lane displaying the player's receptor arrows and scrolling notes in downscroll orientation
- **Opponent_Indicator**: A compact visual element in the top-left corner that shows small arrow icons and flashes briefly when the opponent hits notes
- **HUD_Manager**: The system responsible for positioning and rendering the health bar, score display, and other gameplay UI elements within the Portrait_Canvas
- **Touch_Zone**: A rectangular interactive region at the bottom of the screen mapped to one of the four arrow directions
- **Letterbox**: Black bars rendered on the left and right sides of the browser window when the window aspect ratio is wider than 9:16

## Requirements

### Requirement 1: Universal Portrait Canvas Configuration

**User Story:** As a player, I want the game to always display in a 720x1280 portrait layout, so that the experience is consistent regardless of whether I play on desktop or mobile.

#### Acceptance Criteria

1. THE Layout_Manager SHALL configure the Phaser canvas to a fixed 9:16 aspect ratio with a base resolution of 720x1280
2. THE Layout_Manager SHALL scale the Portrait_Canvas to fit the browser window while preserving the 9:16 aspect ratio
3. WHEN the browser window is resized, THE Layout_Manager SHALL recalculate the canvas scale to maintain the 9:16 aspect ratio without cropping gameplay elements
4. THE Layout_Manager SHALL set the Phaser Scale Manager mode to FIT with center alignment for both horizontal and vertical axes

### Requirement 2: Desktop Letterboxing

**User Story:** As a desktop player, I want the portrait canvas centered in my browser window with black space on the sides, so that the game looks clean and intentional on a wide screen.

#### Acceptance Criteria

1. WHEN the browser window aspect ratio is wider than 9:16, THE Layout_Manager SHALL render black Letterbox bars on the left and right sides of the Portrait_Canvas
2. THE Layout_Manager SHALL center the Portrait_Canvas horizontally within the browser window
3. THE Layout_Manager SHALL set the page background color to black so that the Letterbox areas appear as solid black
4. WHEN the browser window aspect ratio is narrower than 9:16, THE Layout_Manager SHALL render black bars on the top and bottom instead, maintaining the 9:16 aspect ratio

### Requirement 3: Touch Device Detection

**User Story:** As a player, I want the game to detect whether my device supports touch input, so that touch controls are shown only when appropriate.

#### Acceptance Criteria

1. WHEN the Game initializes, THE Touch_Device_Detector SHALL detect whether the device supports touch input using touch capability detection and pointer type analysis
2. WHEN a touch-capable device is detected, THE Touch_Device_Detector SHALL signal the Touch_Input_Controller to display touch controls
3. WHEN a non-touch device is detected, THE Touch_Device_Detector SHALL signal the Touch_Input_Controller to remain hidden
4. THE Touch_Device_Detector SHALL re-evaluate touch capability when a touch event or pointer event is first received, to handle hybrid devices (laptops with touchscreens)


### Requirement 4: Player-Focused Strumline Layout

**User Story:** As a player, I want the note arrows centered on the portrait screen scrolling from top to bottom, so that I can focus on hitting notes without distraction.

#### Acceptance Criteria

1. THE Player_Strumline SHALL be centered horizontally within the Portrait_Canvas
2. THE Player_Strumline SHALL use downscroll orientation with notes moving from top to bottom
3. THE Player_Strumline SHALL position its receptor arrows above the Touch_Zone area, leaving sufficient space for touch input on touch devices
4. THE Player_Strumline SHALL occupy the full available width between the left and right edges of the Portrait_Canvas, with equal padding on each side

### Requirement 5: Opponent Note Indicators

**User Story:** As a player, I want to see a visual cue when the opponent hits notes, so that I can follow the song rhythm without a full opponent strumline consuming screen space.

#### Acceptance Criteria

1. THE Opponent_Indicator SHALL display four small arrow icons in the top-left corner of the Portrait_Canvas
2. WHEN the opponent hits a note, THE Opponent_Indicator SHALL briefly highlight the corresponding arrow icon for 150 milliseconds
3. THE Opponent_Indicator SHALL render each arrow icon at a size no larger than 32x32 pixels at the base 720x1280 resolution
4. THE Game SHALL hide the full opponent Strumline and display only the Opponent_Indicator

### Requirement 6: Touch Input Controls

**User Story:** As a mobile player, I want large touch buttons at the bottom of the screen for the four arrow directions, so that I can input notes accurately with my thumbs.

#### Acceptance Criteria

1. WHEN a touch-capable device is detected, THE Touch_Input_Controller SHALL display four Touch_Zone buttons at the bottom of the Portrait_Canvas, arranged horizontally in the order: left, down, up, right
2. WHEN the player touches a Touch_Zone, THE Touch_Input_Controller SHALL register a note press for the corresponding direction within 1 frame of the touch event
3. WHEN the player releases a Touch_Zone, THE Touch_Input_Controller SHALL register a note release for the corresponding direction within 1 frame of the release event
4. THE Touch_Input_Controller SHALL support simultaneous multi-touch input for at least 4 concurrent touch points
5. THE Touch_Input_Controller SHALL size each Touch_Zone to fill the available width equally across the bottom of the Portrait_Canvas, with a minimum height of 120 pixels at base 720x1280 resolution
6. THE Touch_Input_Controller SHALL render each Touch_Zone with a visible arrow icon and a semi-transparent background to indicate the input area
7. WHEN a Touch_Zone is pressed, THE Touch_Input_Controller SHALL provide visual feedback by changing the Touch_Zone opacity or color for the duration of the press
8. WHEN a non-touch device is detected, THE Touch_Input_Controller SHALL remain hidden and inactive

### Requirement 7: Desktop Keyboard Input

**User Story:** As a desktop player, I want to use keyboard inputs to play the game in portrait mode, so that the gameplay feels the same as before despite the new layout.

#### Acceptance Criteria

1. WHEN a non-touch device is detected, THE Game SHALL accept keyboard input using the existing key bindings (DFJK or arrow keys) for note input
2. THE Game SHALL process keyboard input identically through the existing input queue and note hit detection systems regardless of the portrait layout
3. WHEN a touch-capable device with a physical keyboard is detected, THE Game SHALL accept both touch and keyboard inputs simultaneously without conflicts

### Requirement 8: HUD Repositioning for Portrait

**User Story:** As a player, I want the health bar, score, and other HUD elements positioned for the narrow vertical screen, so that the information is readable and does not obstruct gameplay.

#### Acceptance Criteria

1. THE HUD_Manager SHALL position the health bar horizontally near the top of the Portrait_Canvas, below the Opponent_Indicator area
2. THE HUD_Manager SHALL scale the health bar width to fit within the Portrait_Canvas width with horizontal padding
3. THE HUD_Manager SHALL position the score display below the health bar, centered horizontally
4. THE HUD_Manager SHALL position the combo popup and judgement text in the center of the Portrait_Canvas between the health bar and the Player_Strumline receptors
5. THE HUD_Manager SHALL scale all HUD text elements to remain legible on small mobile screens, using a minimum font size of 16 pixels at base 720x1280 resolution

### Requirement 9: Stage and Character Display in Portrait

**User Story:** As a player, I want to see the player character and stage background adapted for the vertical screen, so that the game retains its visual identity.

#### Acceptance Criteria

1. THE Game SHALL display the stage background scaled to cover the full Portrait_Canvas without distortion
2. THE Game SHALL position the player character in the center of the visible stage area, between the HUD elements and the Player_Strumline
3. THE Game SHALL position the opponent character to the side or partially off-screen to prioritize the player character visibility
4. THE Game SHALL adjust the camera default zoom to frame the characters appropriately for the taller, narrower Portrait_Canvas

### Requirement 10: Portrait Mode Menu Adaptation

**User Story:** As a player, I want the game menus (title, main menu, freeplay, options) to work in the portrait layout with both touch and keyboard input, so that I can navigate the game on any device.

#### Acceptance Criteria

1. THE Game SHALL render all menu scenes within the Portrait_Canvas dimensions
2. WHEN a touch-capable device is detected, THE Game SHALL make all menu items tappable via touch input with a minimum touch target size of 48x48 pixels
3. THE Game SHALL reposition menu elements vertically to fit the narrower screen width
4. THE Game SHALL support keyboard navigation of menus on non-touch devices using the existing key bindings

### Requirement 11: Mobile Orientation Guidance

**User Story:** As a mobile player holding my phone in landscape, I want the game to prompt me to rotate to portrait, so that I get the intended gameplay experience.

#### Acceptance Criteria

1. WHEN the device is detected as touch-capable and the browser is in landscape orientation, THE Game SHALL display a message prompting the player to rotate the device to portrait
2. WHEN the device orientation changes from landscape to portrait, THE Game SHALL dismiss the rotation prompt and resume normal gameplay within 500 milliseconds
3. IF the device does not support orientation detection, THEN THE Game SHALL proceed with the current viewport dimensions without displaying a rotation prompt

### Requirement 12: Performance on Mobile Devices

**User Story:** As a mobile player, I want the game to run smoothly on my phone, so that note timing and input responsiveness are not degraded.

#### Acceptance Criteria

1. THE Game SHALL maintain a minimum frame rate of 30 frames per second on mid-range mobile devices
2. THE Touch_Input_Controller SHALL process touch events with no more than 16 milliseconds of additional latency compared to keyboard input on the same device
3. WHEN the frame rate drops below 30 frames per second, THE Game SHALL disable or reduce non-essential visual effects (such as camera zoom bops and note splashes)
