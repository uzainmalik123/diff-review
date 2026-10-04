import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, chmodSync, existsSync, mkdirSync } from 'node:fs';
import * as path from 'node:path';

const MARKER = '# diff-review managed hook';

export function getHooksPath(): string {
  try {
    const out = execFileSync('git', ['rev-parse', '--git-path', 'hooks'], { encoding: 'utf8' });
    return out.trim();
  } catch {
    return path.join('.git', 'hooks');
  }
}

export function installHook(force: boolean): { created: boolean; message: string } {
  const hooksDir = getHooksPath();
  if (!existsSync(hooksDir)) {
    mkdirSync(hooksDir, { recursive: true });
  }
  const hookPath = path.join(hooksDir, 'pre-push');
  const distPath = path.resolve(process.cwd(), 'dist', 'cli.js');
  const script = `#!/bin/sh
${MARKER}
if command -v diff-review >/dev/null 2>&1; then
  exec diff-review hook "$@"
else
  exec node "${distPath}" hook "$@"
fi
`;

  if (existsSync(hookPath)) {
    const content = readFileSync(hookPath, 'utf8');
    if (!content.includes(MARKER)) {
      if (!force) {
        return { created: false, message: 'pre-push hook exists and is not managed by diff-review; use --force to overwrite' };
      }
      writeFileSync(hookPath + '.backup', content);
    }
  }
  writeFileSync(hookPath, script);
  chmodSync(hookPath, 0o755);
  return { created: true, message: 'installed' };
}

export function uninstallHook(): { removed: boolean; message: string } {
  const hooksDir = getHooksPath();
  const hookPath = path.join(hooksDir, 'pre-push');
  if (!existsSync(hookPath)) {
    return { removed: false, message: 'no pre-push hook found' };
  }
  const content = readFileSync(hookPath, 'utf8');
  if (!content.includes(MARKER)) {
    return { removed: false, message: 'hook is not managed by diff-review' };
  }
  if (existsSync(hookPath + '.backup')) {
    writeFileSync(hookPath, readFileSync(hookPath + '.backup', 'utf8'));
    return { removed: true, message: 'restored backup' };
  }
  try {
    require('node:fs').unlinkSync(hookPath);
  } catch {}
  return { removed: true, message: 'removed' };
}
