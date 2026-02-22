#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

function formatTimestamp(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}--${hh}${mi}`;
}

function printUsage(defaultInput, defaultOutput) {
  console.log('Create an uncompressed zip for a build directory (legacy Postbuild replacement).');
  console.log('');
  console.log('Usage:');
  console.log('  node fnf-phaser/tools/legacy/postbuild-zip.mjs [--input <dir>] [--output <zip-file>]');
  console.log('');
  console.log('Options:');
  console.log(`  --input <dir>      Directory to zip. Default: ${defaultInput}`);
  console.log(`  --output <file>    Zip file path. Default: ${defaultOutput}`);
}

function parseArgs(argv, defaults) {
  const args = { ...defaults, help: false };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--input') {
      args.input = argv[i + 1];
      i += 1;
    } else if (token === '--output') {
      args.output = argv[i + 1];
      i += 1;
    } else if (token === '--help' || token === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }

  if (!args.input) throw new Error('--input requires a value');
  if (!args.output) throw new Error('--output requires a value');

  args.input = path.resolve(process.cwd(), args.input);
  args.output = path.resolve(process.cwd(), args.output);
  return args;
}

function ensureZipBinary() {
  const check = spawnSync('zip', ['-v'], { stdio: 'ignore' });
  if (check.status !== 0) {
    console.error('zip command not found. Install zip or create the archive manually.');
    process.exit(1);
  }
}

function main() {
  const defaultInput = path.join(projectRoot, 'dist');
  const defaultOutput = path.join(projectRoot, `NG-${formatTimestamp(new Date())}.zip`);

  let args;
  try {
    args = parseArgs(process.argv.slice(2), {
      input: defaultInput,
      output: defaultOutput,
    });
  } catch (error) {
    console.error(error.message);
    printUsage(defaultInput, defaultOutput);
    process.exit(1);
  }

  if (args.help) {
    printUsage(defaultInput, defaultOutput);
    return;
  }

  if (!fs.existsSync(args.input) || !fs.statSync(args.input).isDirectory()) {
    console.error(`Input directory does not exist: ${args.input}`);
    process.exit(1);
  }

  ensureZipBinary();
  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  if (fs.existsSync(args.output)) fs.rmSync(args.output);

  console.log(`Creating ${path.relative(process.cwd(), args.output)} from ${path.relative(process.cwd(), args.input)}`);

  const zipProcess = spawnSync('zip', ['-r', '-0', args.output, '.'], {
    cwd: args.input,
    stdio: 'inherit',
  });

  if (zipProcess.status !== 0) {
    console.error('Failed to create zip archive.');
    process.exit(zipProcess.status || 1);
  }

  console.log(`Zip created: ${path.relative(process.cwd(), args.output)}`);
}

main();
