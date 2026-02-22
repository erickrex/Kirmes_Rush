#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');
const newgroundsProjectUrl = 'https://www.newgrounds.com/projects/games/1528775';

const profiles = {
  'itch-html-debug': {
    oldScript: 'build-Itch-HTML.bat',
    kind: 'html',
    buildMode: 'development',
    butlerChannel: 'ninja-muffin24/funkin-secret:html5',
  },
  'itch-html-release': {
    oldScript: 'build-Itch-HTML-RELEASE.bat',
    kind: 'html',
    buildMode: 'production',
    butlerChannel: 'ninja-muffin24/funkin-secret:html5',
  },
  'ng-html-release': {
    oldScript: 'build-NG-HTML-RELEASE.bat',
    kind: 'ng-html',
    buildMode: 'production',
  },
  'itch-windows-release': {
    oldScript: 'build-Itch-WINDOWS.bat',
    kind: 'unsupported',
  },
  'itch-windows-clean': {
    oldScript: 'build-Itch-WINDOWS-CLEAN.bat',
    kind: 'unsupported',
  },
  'itch-windows-secret': {
    oldScript: 'build-Itch-WINDOWS-SECRET.bat',
    kind: 'unsupported',
  },
  'switch-release': {
    oldScript: 'build-lime-SWITCH.bat',
    kind: 'unsupported',
  },
};

function usage(profileId) {
  const profile = profiles[profileId];
  if (!profile) return '';

  return [
    `Run migrated profile for ${profile.oldScript}`,
    '',
    'Options:',
    '  --dry-run      Print commands without executing.',
    '  --skip-upload  Build only; do not run butler push/status.',
    '  --help         Show this help.',
  ].join('\n');
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    skipUpload: false,
    help: false,
  };

  for (const token of argv) {
    if (token === '--dry-run') options.dryRun = true;
    else if (token === '--skip-upload') options.skipUpload = true;
    else if (token === '--help' || token === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }

  return options;
}

function runCommand(command, args, options = {}) {
  const display = [command, ...args].join(' ');
  console.log(`$ ${display}`);

  if (options.dryRun) return;

  const result = spawnSync(command, args, {
    cwd: options.cwd || projectRoot,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function ensureExecutable(command, checkArgs = ['--version']) {
  const check = spawnSync(command, checkArgs, { stdio: 'ignore' });
  return check.status === 0;
}

function createNgZipOutputPath() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  return path.join(projectRoot, `NG-${yyyy}${mm}${dd}--${hh}${mi}.zip`);
}

function runHtmlProfile(profile, options) {
  const buildArgs = ['run', 'build'];
  if (profile.buildMode === 'development') buildArgs.push('--', '--mode', 'development');
  runCommand('npm', buildArgs, options);

  if (options.skipUpload) {
    console.log('Skipping upload and status checks.');
    return;
  }

  if (!ensureExecutable('butler')) {
    console.error('butler is not installed or not in PATH. Re-run with --skip-upload to build only.');
    process.exit(1);
  }

  const distPath = path.join(projectRoot, 'dist');
  if (!fs.existsSync(distPath)) {
    console.error(`Build output not found: ${distPath}`);
    process.exit(1);
  }

  runCommand('butler', ['push', distPath, profile.butlerChannel], options);
  runCommand('butler', ['status', profile.butlerChannel], options);
}

function runNgHtmlProfile(profile, options) {
  const buildArgs = ['run', 'build'];
  if (profile.buildMode === 'development') buildArgs.push('--', '--mode', 'development');
  runCommand('npm', buildArgs, options);

  const outputPath = createNgZipOutputPath();
  const zipScriptPath = path.join(projectRoot, 'tools/legacy/postbuild-zip.mjs');
  runCommand('node', [zipScriptPath, '--input', 'dist', '--output', outputPath], options);
  console.log(`Newgrounds project page: ${newgroundsProjectUrl}`);
}

function runUnsupportedProfile(profileId) {
  console.error(`Profile "${profileId}" targets Haxe/Lime-native outputs and has no Phaser equivalent.`);
  console.error('Use HTML deploy profiles instead: itch-html-debug, itch-html-release, ng-html-release.');
  process.exit(2);
}

export function runProfile(profileId, argv = process.argv.slice(2)) {
  const profile = profiles[profileId];
  if (!profile) {
    console.error(`Unknown profile: ${profileId}`);
    process.exit(1);
  }

  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(error.message);
    console.log('');
    console.log(usage(profileId));
    process.exit(1);
  }

  if (options.help) {
    console.log(usage(profileId));
    return;
  }

  console.log(`Running profile ${profileId} (migrated from ${profile.oldScript})`);

  if (profile.kind === 'unsupported') runUnsupportedProfile(profileId);
  if (profile.kind === 'html') runHtmlProfile(profile, options);
  if (profile.kind === 'ng-html') runNgHtmlProfile(profile, options);
}

