import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';

const execFileAsync = promisify(execFile);

const LOCKFILES = new Set([
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'bun.lockb',
  'Cargo.lock',
  'poetry.lock',
  'Gemfile.lock',
  'go.sum',
]);

const BUILD_DIRS = new Set(['dist', 'build', 'node_modules', '.next']);

function isBinaryLine(line: string): boolean {
  return line.startsWith('Binary files ');
}

function isGeneratedOrMinified(filename: string): boolean {
  if (filename.endsWith('.min.js')) return true;
  if (filename.endsWith('.map')) return true;
  return false;
}

function shouldExcludePath(filename: string, ignoreGlobs: string[]): boolean {
  const base = path.basename(filename);
  if (LOCKFILES.has(base)) return true;
  if (isGeneratedOrMinified(base)) return true;
  for (const dir of BUILD_DIRS) {
    if (filename.startsWith(dir + '/') || filename === dir) return true;
  }
  for (const g of ignoreGlobs) {
    if (g.includes('*')) {
      const regex = new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
      if (regex.test(filename) || regex.test(base)) return true;
    } else if (filename.includes(g)) {
      return true;
    }
  }
  return false;
}

export interface DiffStats {
  filesSeen: number;
  filesIncluded: number;
  truncated: boolean;
  totalChangedLines: number;
  includedText: string;
}

export async function getDiff(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', [
    'diff',
    '--no-color',
    '--unified=3',
    '--no-ext-diff',
    ...args,
  ]);
  return stdout.toString();
}

function countChangedLines(section: string): number {
  let count = 0;
  for (const line of section.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) count++;
    if (line.startsWith('-') && !line.startsWith('---')) count++;
  }
  return count;
}

export function filterAndTruncate(diff: string, maxChars: number, ignoreGlobs: string[]): DiffStats {
  const lines = diff.split('\n');
  const sections: string[] = [];
  let current: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('diff --git')) {
      if (current.length > 0) {
        sections.push(current.join('\n'));
        current = [];
      }
      current.push(line);
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) {
    sections.push(current.join('\n'));
  }

  const filtered: string[] = [];
  let totalChangedLines = 0;
  for (const sec of sections) {
    const secLines = sec.split('\n');
    let secFilename: string | null = null;
    let isBinary = false;
    for (const l of secLines) {
      if (l.startsWith('+++')) {
        const m = l.match(/^\+\+\+ b\/(.+)$/);
        if (m) secFilename = m[1];
      }
      if (isBinaryLine(l)) {
        isBinary = true;
      }
    }
    if (isBinary) continue;
    if (secFilename && shouldExcludePath(secFilename, ignoreGlobs)) {
      continue;
    }
    totalChangedLines += countChangedLines(sec);
    filtered.push(sec);
  }

  let included: string[] = [];
  let truncated = false;
  let chars = 0;
  for (const sec of filtered) {
    const secLen = sec.length;
    const sep = included.length > 0 ? 1 : 0; // \n
    if (chars + secLen + sep <= maxChars) {
      included.push(sec);
      chars += secLen + sep;
    } else {
      truncated = true;
      const remaining = maxChars - chars - sep;
      if (remaining > 30) {
        const secLinesArr = sec.split('\n');
        const partial: string[] = [];
        for (const l of secLinesArr) {
          const pLen = partial.length === 0 ? 0 : 1;
          if ((partial.join('\n') + (pLen ? '\n' : '') + l).length <= remaining) {
            partial.push(l);
          } else {
            break;
          }
        }
        if (partial.length > 0) {
          included.push(partial.join('\n'));
        }
      }
      break;
    }
  }

  const includedText = included.join('\n');
  return {
    filesSeen: filtered.length,
    filesIncluded: included.length,
    truncated,
    totalChangedLines,
    includedText,
  };
}
