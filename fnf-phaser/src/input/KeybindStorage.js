/**
 * @fileoverview Shared conversion helpers between stored key labels and DOM key codes.
 */

const STORED_TO_CODE = {
  LEFT: 'ArrowLeft',
  DOWN: 'ArrowDown',
  UP: 'ArrowUp',
  RIGHT: 'ArrowRight',
  ENTER: 'Enter',
  SPACE: 'Space',
  ESCAPE: 'Escape',
  BACKSPACE: 'Backspace'
};

const CODE_TO_STORED = Object.fromEntries(
  Object.entries(STORED_TO_CODE).map(([stored, code]) => [code, stored])
);

export const ARROW_STORED_KEYS = new Set(['LEFT', 'DOWN', 'UP', 'RIGHT']);

export function storedKeyToCode(value) {
  if (!value) {
    return null;
  }

  const normalized = String(value).trim().toUpperCase();
  if (STORED_TO_CODE[normalized]) {
    return STORED_TO_CODE[normalized];
  }

  if (/^[A-Z]$/.test(normalized)) {
    return `Key${normalized}`;
  }

  if (/^\d$/.test(normalized)) {
    return `Digit${normalized}`;
  }

  return value;
}

export function codeToStoredKey(code) {
  if (!code) {
    return '';
  }

  const normalized = String(code).trim();
  if (CODE_TO_STORED[normalized]) {
    return CODE_TO_STORED[normalized];
  }

  if (/^Key[A-Z]$/.test(normalized)) {
    return normalized.slice(3);
  }

  if (/^Digit\d$/.test(normalized)) {
    return normalized.slice(5);
  }

  return normalized.toUpperCase();
}
