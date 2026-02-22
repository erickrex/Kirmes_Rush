#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '0.1.0-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');
const defaultSongsRoot = path.join(repoRoot, 'assets/funkin.assets/preload/data/songs');

function printUsage() {
  console.log('Convert legacy FNF per-difficulty song JSON files into a single song JSON.');
  console.log('');
  console.log('Usage:');
  console.log('  node fnf-phaser/tools/legacy/song-converter.mjs [--root <path>] [--song <name>] [--dry-run]');
  console.log('');
  console.log('Options:');
  console.log(`  --root <path>  Songs folder to scan. Default: ${defaultSongsRoot}`);
  console.log('  --song <name>  Convert only one song directory by name.');
  console.log('  --dry-run      Print actions without writing/deleting files.');
}

function parseArgs(argv) {
  const args = {
    root: defaultSongsRoot,
    song: null,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--root') {
      args.root = argv[i + 1];
      i += 1;
    } else if (token === '--song') {
      args.song = argv[i + 1];
      i += 1;
    } else if (token === '--dry-run') {
      args.dryRun = true;
    } else if (token === '--help' || token === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }

  if (!args.root) throw new Error('--root requires a value');
  if (args.song === '') throw new Error('--song requires a value');

  args.root = path.resolve(process.cwd(), args.root);
  return args;
}

function getStage(songName) {
  switch (songName) {
    case 'spookeez':
    case 'monster':
    case 'south':
      return 'spooky';
    case 'pico':
    case 'blammed':
    case 'philly':
      return 'philly';
    case 'milf':
    case 'satin-panties':
    case 'high':
      return 'limo';
    case 'cocoa':
    case 'eggnog':
      return 'mall';
    case 'winter-horrorland':
      return 'mallEvil';
    case 'senpai':
    case 'roses':
      return 'school';
    case 'thorns':
      return 'schoolEvil';
    case 'guns':
    case 'stress':
    case 'ugh':
      return 'tank';
    default:
      return 'stage';
  }
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function difficultyFromFilename(fileName, songName) {
  if (!fileName.endsWith('.json')) return null;
  if (fileName === `${songName}.json`) return 'normal';

  const prefix = `${songName}-`;
  if (!fileName.startsWith(prefix)) return null;
  return fileName.slice(prefix.length, -'.json'.length);
}

function extractLegacyData(songFileJson, difficulty) {
  if (!songFileJson || typeof songFileJson !== 'object') return null;
  const song = songFileJson.song;
  if (!song || typeof song !== 'object') return null;

  if (difficulty !== 'normal') {
    return {
      notes: song.notes,
      speed: song.speed,
    };
  }

  if (Array.isArray(song.notes)) {
    return {
      notes: song.notes[1],
      speed: Array.isArray(song.speed) ? song.speed[1] : undefined,
    };
  }

  // Match original Haxe behavior: object-shaped normal notes were detected but not written.
  if (song.notes && typeof song.notes === 'object') {
    return null;
  }

  return {
    notes: song.notes,
    speed: song.speed,
  };
}

function formatJson(data) {
  return `${JSON.stringify(data, null, '\t')}\n`;
}

function convertSong(songName, rootDir, dryRun) {
  const songDir = path.join(rootDir, songName);
  const entries = fs.readdirSync(songDir, { withFileTypes: true });
  const songMap = {};
  const speedMap = {};
  let hasLegacyInput = false;

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const difficulty = difficultyFromFilename(entry.name, songName);
    if (!difficulty) continue;

    const filePath = path.join(songDir, entry.name);

    if (difficulty === 'new') {
      if (dryRun) {
        console.log(`[dry-run] delete ${path.relative(process.cwd(), filePath)}`);
      } else {
        fs.rmSync(filePath);
        console.log(`Deleted ${path.relative(process.cwd(), filePath)}`);
      }
      continue;
    }

    let parsed;
    try {
      parsed = readJson(filePath);
    } catch (error) {
      console.warn(`Skipping unreadable JSON: ${path.relative(process.cwd(), filePath)} (${error.message})`);
      continue;
    }

    const extracted = extractLegacyData(parsed, difficulty);
    if (!extracted) continue;

    hasLegacyInput = true;
    if (extracted.notes !== undefined) songMap[difficulty] = extracted.notes;
    if (extracted.speed !== undefined) speedMap[difficulty] = extracted.speed;
  }

  if (!hasLegacyInput) return false;

  const baseFilePath = path.join(songDir, `${songName}.json`);
  if (!fs.existsSync(baseFilePath)) {
    console.warn(`Skipping ${songName}: missing base file ${songName}.json`);
    return false;
  }

  let baseFile;
  try {
    baseFile = readJson(baseFilePath);
  } catch (error) {
    console.warn(`Skipping ${songName}: failed to parse base file (${error.message})`);
    return false;
  }

  if (!baseFile.song || typeof baseFile.song !== 'object') {
    console.warn(`Skipping ${songName}: base file is not legacy format`);
    return false;
  }

  baseFile.song.notes = songMap;
  baseFile.song.speed = speedMap;
  baseFile.song.hasDialogueFile = false;
  baseFile.song.stageDefault = getStage(songName);
  baseFile.version = `FNF SongConverter ${VERSION}`;

  if (dryRun) {
    console.log(`[dry-run] write ${path.relative(process.cwd(), baseFilePath)}`);
  } else {
    fs.writeFileSync(baseFilePath, formatJson(baseFile), 'utf8');
    console.log(`Updated ${path.relative(process.cwd(), baseFilePath)}`);
  }

  return true;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    printUsage();
    process.exit(1);
  }

  if (args.help) {
    printUsage();
    return;
  }

  if (!fs.existsSync(args.root) || !fs.statSync(args.root).isDirectory()) {
    console.error(`Songs root does not exist or is not a directory: ${args.root}`);
    process.exit(1);
  }

  const candidates = fs
    .readdirSync(args.root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.toLowerCase() !== 'smash')
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const songsToConvert = args.song ? candidates.filter((name) => name === args.song) : candidates;
  if (args.song && songsToConvert.length === 0) {
    console.error(`Song folder not found: ${args.song}`);
    process.exit(1);
  }

  let convertedCount = 0;
  for (const songName of songsToConvert) {
    const converted = convertSong(songName, args.root, args.dryRun);
    if (converted) convertedCount += 1;
  }

  console.log(`Done. Converted ${convertedCount} song${convertedCount === 1 ? '' : 's'}.`);
}

main();
