/**
 * @fileoverview SparrowParser - Parser for Sparrow/Starling XML texture atlas format
 * Parses XML atlas files exported from Adobe Animate into usable frame and animation data.
 *
 * The Sparrow format is commonly used in Flash/Animate exports and consists of:
 * - A PNG spritesheet image
 * - An XML file describing frame positions and animation sequences
 *
 * Frame naming convention: "animationName0000", "animationName0001", etc.
 * Or: "animation name instance 10000", "animation name instance 10001", etc.
 */

/**
 * @typedef {Object} SparrowFrame
 * @property {string} name - Full frame name from XML
 * @property {number} x - X position in spritesheet
 * @property {number} y - Y position in spritesheet
 * @property {number} width - Frame width in spritesheet
 * @property {number} height - Frame height in spritesheet
 * @property {number} [frameX=0] - X offset for trimmed sprites
 * @property {number} [frameY=0] - Y offset for trimmed sprites
 * @property {number} [frameWidth] - Original frame width before trimming
 * @property {number} [frameHeight] - Original frame height before trimming
 * @property {boolean} [rotated=false] - Whether the frame is rotated 90° in the atlas
 */

/**
 * @typedef {Object} SparrowAnimation
 * @property {string} name - Animation name (prefix)
 * @property {string} prefix - The prefix used to match frames
 * @property {SparrowFrame[]} frames - Frames in this animation
 * @property {number[]} indices - Frame indices in order
 * @property {boolean} looped - Whether animation should loop
 */

/**
 * @typedef {Object} PhaserAnimationConfig
 * @property {string} key - Animation key for Phaser
 * @property {Array<{key: string, frame: string}>} frames - Frame configuration
 * @property {number} frameRate - Frames per second
 * @property {number} repeat - Repeat count (-1 for infinite)
 * @property {boolean} [yoyo=false] - Whether to reverse on completion
 */

/**
 * @typedef {Object} ParsedAtlas
 * @property {string} imagePath - Path to the spritesheet image
 * @property {SparrowFrame[]} frames - All frames in the atlas
 * @property {Map<string, SparrowAnimation>} animations - Detected animations by prefix
 * @property {Map<string, SparrowFrame>} frameMap - Quick lookup by frame name
 */

/**
 * Parser for Sparrow/Starling XML texture atlas format.
 * Handles frame extraction and animation sequence detection.
 */
class SparrowParser {
  /**
   * Parse a Sparrow XML string into frame and animation data.
   * Works in both browser (DOMParser) and Node.js (regex-based) environments.
   * @param {string} xmlString - The XML content as a string
   * @returns {ParsedAtlas | null} Parsed atlas data or null if invalid
   */
  static parse(xmlString) {
    if (!xmlString || typeof xmlString !== 'string') {
      console.error('[SparrowParser] Invalid XML string');
      return null;
    }

    try {
      // Check if DOMParser is available (browser environment)
      if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlString, 'text/xml');

        // Check for parsing errors
        const parseError = doc.querySelector('parsererror');
        if (parseError) {
          console.error('[SparrowParser] XML parsing error:', parseError.textContent);
          return null;
        }

        return SparrowParser.parseDocument(doc);
      } else {
        // Node.js environment - use regex-based parsing
        return SparrowParser.parseWithRegex(xmlString);
      }
    } catch (error) {
      console.error('[SparrowParser] Failed to parse XML:', error);
      return null;
    }
  }

  /**
   * Parse XML using regex (for Node.js environment without DOMParser).
   * @param {string} xmlString - The XML content as a string
   * @returns {ParsedAtlas | null} Parsed atlas data or null if invalid
   */
  static parseWithRegex(xmlString) {
    // Extract imagePath from TextureAtlas element
    const atlasMatch = xmlString.match(/<TextureAtlas[^>]*imagePath\s*=\s*["']([^"']*)["'][^>]*>/i);
    if (!atlasMatch) {
      // Try alternate format where imagePath might come after other attributes
      const altMatch = xmlString.match(/<TextureAtlas[^>]*>/i);
      if (!altMatch) {
        console.error('[SparrowParser] No TextureAtlas element found');
        return null;
      }
    }

    const imagePath = atlasMatch ? atlasMatch[1] : '';

    // Extract all SubTexture elements
    const subTextureRegex = /<SubTexture\s+([^>]+)\/?\s*>/gi;
    const frames = [];
    const frameMap = new Map();

    let match;
    while ((match = subTextureRegex.exec(xmlString)) !== null) {
      const attrString = match[1];
      const frame = SparrowParser.parseSubTextureFromString(attrString);
      if (frame) {
        frames.push(frame);
        frameMap.set(frame.name, frame);
      }
    }

    // Detect animations from frame names
    const animations = SparrowParser.detectAnimations(frames);

    return {
      imagePath,
      frames,
      animations,
      frameMap
    };
  }

  /**
   * Parse SubTexture attributes from a string.
   * @param {string} attrString - The attribute string from the SubTexture element
   * @returns {SparrowFrame | null} Parsed frame or null if invalid
   */
  static parseSubTextureFromString(attrString) {
    const getAttr = (name) => {
      const match = attrString.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'));
      return match ? match[1] : null;
    };

    const name = getAttr('name');
    if (!name) {
      console.warn('[SparrowParser] SubTexture missing name attribute');
      return null;
    }

    const x = parseInt(getAttr('x') || '0', 10);
    const y = parseInt(getAttr('y') || '0', 10);
    const width = parseInt(getAttr('width') || '0', 10);
    const height = parseInt(getAttr('height') || '0', 10);

    // Optional frame offset attributes (for trimmed sprites)
    const frameXStr = getAttr('frameX');
    const frameYStr = getAttr('frameY');
    const frameWidthStr = getAttr('frameWidth');
    const frameHeightStr = getAttr('frameHeight');

    const frameX = frameXStr !== null ? parseInt(frameXStr, 10) : 0;
    const frameY = frameYStr !== null ? parseInt(frameYStr, 10) : 0;
    const frameWidth = frameWidthStr !== null ? parseInt(frameWidthStr, 10) : width;
    const frameHeight = frameHeightStr !== null ? parseInt(frameHeightStr, 10) : height;

    // Check for rotated attribute
    const rotated = getAttr('rotated') === 'true';

    return {
      name,
      x,
      y,
      width,
      height,
      frameX,
      frameY,
      frameWidth,
      frameHeight,
      rotated
    };
  }

  /**
   * Parse a DOM Document into atlas data.
   * @param {Document} doc - The parsed XML document
   * @returns {ParsedAtlas | null} Parsed atlas data or null if invalid
   */
  static parseDocument(doc) {
    const textureAtlas = doc.querySelector('TextureAtlas');
    if (!textureAtlas) {
      console.error('[SparrowParser] No TextureAtlas element found');
      return null;
    }

    const imagePath = textureAtlas.getAttribute('imagePath') || '';
    const subTextures = textureAtlas.querySelectorAll('SubTexture');

    if (subTextures.length === 0) {
      console.warn('[SparrowParser] No SubTexture elements found');
    }

    const frames = [];
    const frameMap = new Map();

    for (const subTexture of subTextures) {
      const frame = SparrowParser.parseSubTexture(subTexture);
      if (frame) {
        frames.push(frame);
        frameMap.set(frame.name, frame);
      }
    }

    // Detect animations from frame names
    const animations = SparrowParser.detectAnimations(frames);

    return {
      imagePath,
      frames,
      animations,
      frameMap
    };
  }

  /**
   * Parse a single SubTexture element into frame data.
   * @param {Element} element - The SubTexture XML element
   * @returns {SparrowFrame | null} Parsed frame or null if invalid
   */
  static parseSubTexture(element) {
    const name = element.getAttribute('name');
    if (!name) {
      console.warn('[SparrowParser] SubTexture missing name attribute');
      return null;
    }

    const x = SparrowParser.parseIntAttr(element, 'x', 0);
    const y = SparrowParser.parseIntAttr(element, 'y', 0);
    const width = SparrowParser.parseIntAttr(element, 'width', 0);
    const height = SparrowParser.parseIntAttr(element, 'height', 0);

    // Optional frame offset attributes (for trimmed sprites)
    const frameX = SparrowParser.parseIntAttr(element, 'frameX', 0);
    const frameY = SparrowParser.parseIntAttr(element, 'frameY', 0);
    const frameWidth = SparrowParser.parseIntAttr(element, 'frameWidth', width);
    const frameHeight = SparrowParser.parseIntAttr(element, 'frameHeight', height);

    // Check for rotated attribute (some atlases use this)
    const rotated = element.getAttribute('rotated') === 'true';

    return {
      name,
      x,
      y,
      width,
      height,
      frameX,
      frameY,
      frameWidth,
      frameHeight,
      rotated
    };
  }

  /**
   * Parse an integer attribute from an element.
   * @param {Element} element - The XML element
   * @param {string} attr - Attribute name
   * @param {number} defaultValue - Default value if not found
   * @returns {number} Parsed integer value
   */
  static parseIntAttr(element, attr, defaultValue) {
    const value = element.getAttribute(attr);
    if (value === null) {
      return defaultValue;
    }
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Detect animations from frame names.
   * Frames are grouped by their prefix (everything before the frame number).
   * @param {SparrowFrame[]} frames - All frames in the atlas
   * @returns {Map<string, SparrowAnimation>} Map of animation prefix to animation data
   */
  static detectAnimations(frames) {
    const animations = new Map();
    const framesByPrefix = new Map();

    for (const frame of frames) {
      const { prefix, index } = SparrowParser.parseFrameName(frame.name);

      if (!framesByPrefix.has(prefix)) {
        framesByPrefix.set(prefix, []);
      }
      framesByPrefix.get(prefix).push({ frame, index });
    }

    // Convert grouped frames into animations
    for (const [prefix, frameData] of framesByPrefix) {
      // Sort by index
      frameData.sort((a, b) => a.index - b.index);

      const animFrames = frameData.map((fd) => fd.frame);
      const indices = frameData.map((fd) => fd.index);

      animations.set(prefix, {
        name: prefix,
        prefix,
        frames: animFrames,
        indices,
        looped: true // Default to looped, can be overridden
      });
    }

    return animations;
  }

  /**
   * Parse a frame name to extract the animation prefix and frame index.
   * Handles multiple naming conventions:
   * - "animName0000" -> prefix: "animName", index: 0
   * - "anim name instance 10000" -> prefix: "anim name instance 1", index: 0
   * - "idle" -> prefix: "idle", index: 0
   * @param {string} name - The frame name
   * @returns {{prefix: string, index: number}} Parsed prefix and index
   */
  static parseFrameName(name) {
    // Try to match trailing digits (4+ digits for frame number)
    const match = name.match(/^(.+?)(\d{4,})$/);

    if (match) {
      let prefix = match[1];
      const indexStr = match[2];

      // For "instance 10000" style naming, the format is:
      // prefix + instance_number + frame_number (4 digits)
      // e.g., "down confirm instance 10002" -> prefix: "down confirm instance 1", frame: 0002
      // The last 4 digits are always the frame index
      const frameIndex = parseInt(indexStr.slice(-4), 10);

      // If there are more than 4 digits, the leading digits are part of the prefix
      if (indexStr.length > 4) {
        prefix = prefix + indexStr.slice(0, -4);
      }

      return { prefix, index: frameIndex };
    }

    // No frame number found, treat entire name as prefix with index 0
    return { prefix: name, index: 0 };
  }

  /**
   * Get frames matching a specific prefix.
   * @param {ParsedAtlas} atlas - The parsed atlas
   * @param {string} prefix - Animation prefix to match
   * @param {boolean} [exactMatch=false] - If true, prefix must match exactly
   * @returns {SparrowFrame[]} Matching frames sorted by index
   */
  static getFramesByPrefix(atlas, prefix, exactMatch = false) {
    const animation = atlas.animations.get(prefix);
    if (animation) {
      return animation.frames;
    }

    // If no exact match, try to find animations that start with the prefix
    if (!exactMatch) {
      const matchingFrames = [];
      for (const [animPrefix, anim] of atlas.animations) {
        if (
          animPrefix.startsWith(prefix) ||
          animPrefix.toLowerCase().startsWith(prefix.toLowerCase())
        ) {
          matchingFrames.push(...anim.frames);
        }
      }
      return matchingFrames;
    }

    return [];
  }

  /**
   * Get frames by specific indices from an animation.
   * @param {ParsedAtlas} atlas - The parsed atlas
   * @param {string} prefix - Animation prefix
   * @param {number[]} indices - Specific frame indices to get
   * @returns {SparrowFrame[]} Frames at the specified indices
   */
  static getFramesByIndices(atlas, prefix, indices) {
    const animation = atlas.animations.get(prefix);
    if (!animation) {
      return [];
    }

    const result = [];
    for (const index of indices) {
      const frameIndex = animation.indices.indexOf(index);
      if (frameIndex !== -1) {
        result.push(animation.frames[frameIndex]);
      }
    }
    return result;
  }

  /**
   * Convert atlas data to Phaser animation configuration.
   * @param {ParsedAtlas} atlas - The parsed atlas
   * @param {string} textureKey - The Phaser texture key
   * @param {string} prefix - Animation prefix
   * @param {Object} [options={}] - Animation options
   * @param {string} [options.key] - Custom animation key (defaults to prefix)
   * @param {number} [options.frameRate=24] - Frames per second
   * @param {number} [options.repeat=-1] - Repeat count (-1 for infinite)
   * @param {boolean} [options.yoyo=false] - Reverse on completion
   * @param {number[]} [options.indices] - Specific frame indices to use
   * @returns {PhaserAnimationConfig | null} Phaser animation config or null
   */
  static toPhaserAnimation(atlas, textureKey, prefix, options = {}) {
    let frames;

    if (options.indices && options.indices.length > 0) {
      frames = SparrowParser.getFramesByIndices(atlas, prefix, options.indices);
    } else {
      frames = SparrowParser.getFramesByPrefix(atlas, prefix, true);
    }

    if (frames.length === 0) {
      // Try case-insensitive match
      frames = SparrowParser.getFramesByPrefix(atlas, prefix, false);
    }

    if (frames.length === 0) {
      console.warn(`[SparrowParser] No frames found for prefix: ${prefix}`);
      return null;
    }

    return {
      key: options.key || prefix,
      frames: frames.map((frame) => ({
        key: textureKey,
        frame: frame.name
      })),
      frameRate: options.frameRate ?? 24,
      repeat: options.repeat ?? -1,
      yoyo: options.yoyo ?? false
    };
  }

  /**
   * Convert all animations in an atlas to Phaser configurations.
   * @param {ParsedAtlas} atlas - The parsed atlas
   * @param {string} textureKey - The Phaser texture key
   * @param {Object} [defaultOptions={}] - Default options for all animations
   * @returns {PhaserAnimationConfig[]} Array of Phaser animation configs
   */
  static toPhaserAnimations(atlas, textureKey, defaultOptions = {}) {
    const configs = [];

    for (const [prefix] of atlas.animations) {
      const config = SparrowParser.toPhaserAnimation(atlas, textureKey, prefix, defaultOptions);
      if (config) {
        configs.push(config);
      }
    }

    return configs;
  }

  /**
   * Generate Phaser frame data for adding to a texture.
   * This creates the frame configuration needed for Phaser's texture manager.
   * @param {ParsedAtlas} atlas - The parsed atlas
   * @returns {Object} Frame data object for Phaser
   */
  static toPhaserFrameData(atlas) {
    const frameData = {};

    for (const frame of atlas.frames) {
      frameData[frame.name] = {
        frame: {
          x: frame.x,
          y: frame.y,
          w: frame.width,
          h: frame.height
        },
        rotated: frame.rotated,
        trimmed: frame.frameX !== 0 || frame.frameY !== 0,
        spriteSourceSize: {
          x: -frame.frameX,
          y: -frame.frameY,
          w: frame.width,
          h: frame.height
        },
        sourceSize: {
          w: frame.frameWidth,
          h: frame.frameHeight
        }
      };
    }

    return { frames: frameData };
  }

  /**
   * List all unique animation prefixes in an atlas.
   * @param {ParsedAtlas} atlas - The parsed atlas
   * @returns {string[]} Array of animation prefixes
   */
  static listAnimations(atlas) {
    return Array.from(atlas.animations.keys());
  }

  /**
   * Get statistics about an atlas.
   * @param {ParsedAtlas} atlas - The parsed atlas
   * @returns {Object} Atlas statistics
   */
  static getAtlasStats(atlas) {
    let totalFrameArea = 0;
    let minWidth = Infinity;
    let maxWidth = 0;
    let minHeight = Infinity;
    let maxHeight = 0;

    for (const frame of atlas.frames) {
      totalFrameArea += frame.width * frame.height;
      minWidth = Math.min(minWidth, frame.width);
      maxWidth = Math.max(maxWidth, frame.width);
      minHeight = Math.min(minHeight, frame.height);
      maxHeight = Math.max(maxHeight, frame.height);
    }

    return {
      imagePath: atlas.imagePath,
      totalFrames: atlas.frames.length,
      totalAnimations: atlas.animations.size,
      totalFrameArea,
      frameSizeRange: {
        minWidth: minWidth === Infinity ? 0 : minWidth,
        maxWidth,
        minHeight: minHeight === Infinity ? 0 : minHeight,
        maxHeight
      },
      animationNames: SparrowParser.listAnimations(atlas)
    };
  }
}

export default SparrowParser;
