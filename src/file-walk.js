import fs from 'node:fs/promises';
import path from 'node:path';
import {
  CODE_EXTENSIONS,
  IGNORED_DIRECTORIES,
  IGNORED_FILENAMES,
  TEXT_EXTENSIONS
} from './constants.js';

const DEFAULT_MAX_FILE_BYTES = 1_000_000;
const DEFAULT_MAX_FILES = 8_000;

export async function collectReadableFiles(rootPath, options = {}) {
  const root = path.resolve(rootPath);
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const rootStat = await fs.stat(root);

  if (!rootStat.isDirectory()) {
    throw new Error(`Target must be a directory: ${root}`);
  }

  const files = [];
  const skipped = {
    generatedOrHidden: 0,
    oversized: 0,
    unsupported: 0,
    unreadable: 0,
    sensitive: 0,
    maxFiles: false
  };

  async function walk(directory) {
    if (files.length >= maxFiles) {
      skipped.maxFiles = true;
      return;
    }

    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      skipped.unreadable += 1;
      return;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (files.length >= maxFiles) {
        skipped.maxFiles = true;
        return;
      }

      const absolutePath = path.join(directory, entry.name);

      if (entry.isSymbolicLink()) {
        skipped.unsupported += 1;
        continue;
      }

      if (entry.isDirectory()) {
        if (shouldSkipDirectory(entry.name)) {
          skipped.generatedOrHidden += 1;
          continue;
        }
        await walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        skipped.unsupported += 1;
        continue;
      }

      if (shouldSkipSensitiveFile(entry.name)) {
        skipped.sensitive += 1;
        continue;
      }

      if (IGNORED_FILENAMES.has(entry.name.toLowerCase())) {
        skipped.generatedOrHidden += 1;
        continue;
      }

      if (!isReadableTextFile(entry.name)) {
        skipped.unsupported += 1;
        continue;
      }

      let stat;
      try {
        stat = await fs.stat(absolutePath);
      } catch {
        skipped.unreadable += 1;
        continue;
      }

      if (stat.size > maxFileBytes) {
        skipped.oversized += 1;
        continue;
      }

      let text;
      try {
        text = await fs.readFile(absolutePath, 'utf8');
      } catch {
        skipped.unreadable += 1;
        continue;
      }

      const relativePath = path.relative(root, absolutePath) || entry.name;
      files.push({
        absolutePath,
        relativePath: normalizePath(relativePath),
        basename: entry.name,
        extension: path.extname(entry.name).toLowerCase(),
        kind: getFileKind(entry.name, relativePath),
        size: stat.size,
        text
      });
    }
  }

  await walk(root);

  return { root, files, skipped };
}

export function shouldSkipSensitiveFile(filename) {
  const lower = filename.toLowerCase();

  return (
    lower === '.env' ||
    lower.startsWith('.env.') ||
    lower.includes('credential') ||
    lower.includes('credentials') ||
    lower.includes('secret') ||
    lower === 'id_rsa' ||
    lower === 'id_dsa' ||
    lower === 'id_ed25519' ||
    lower.endsWith('.pem') ||
    lower.endsWith('.p12') ||
    lower.endsWith('.pfx') ||
    lower.endsWith('.key')
  );
}

function shouldSkipDirectory(dirname) {
  const lower = dirname.toLowerCase();

  return (
    IGNORED_DIRECTORIES.has(lower) ||
    lower.includes('credential') ||
    lower.includes('secret')
  );
}

function isReadableTextFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return TEXT_EXTENSIONS.has(ext) || filename === 'Dockerfile';
}

function getFileKind(filename, relativePath) {
  const ext = path.extname(filename).toLowerCase();
  const lowerPath = normalizePath(relativePath).toLowerCase();

  if (CODE_EXTENSIONS.has(ext)) return 'code';
  if (ext === '.md' || ext === '.mdx' || ext === '.txt' || ext === '.prompt') return 'prompt-text';
  if (ext === '.csv' || ext === '.jsonl') return 'data';
  if (
    ext === '.json' ||
    ext === '.jsonc' ||
    ext === '.yaml' ||
    ext === '.yml' ||
    ext === '.toml' ||
    ext === '.sql' ||
    ext === '.prisma' ||
    lowerPath.endsWith('dockerfile')
  ) {
    return 'config';
  }
  return 'text';
}

export function normalizePath(filePath) {
  return filePath.split(path.sep).join('/');
}
