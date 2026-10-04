import { describe, it, expect } from 'vitest';
import { installHook, uninstallHook } from '../src/commands/install.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

describe('install', () => {
  it('installs and uninstalls', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'dr-install-'));
    execSync('git init', { cwd: d });
    const oldCwd = process.cwd();
    process.chdir(d);
    try {
      const res = installHook(false);
      expect(res.created).toBe(true);
      const hookPath = path.join('.git', 'hooks', 'pre-push');
      expect(fs.existsSync(hookPath)).toBe(true);
      expect(fs.readFileSync(hookPath, 'utf8')).toContain('# diff-review managed hook');
      const un = uninstallHook();
      expect(un.removed).toBe(true);
    } finally {
      process.chdir(oldCwd);
    }
  });

  it('refuses to overwrite foreign hook without force', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'dr-install2-'));
    execSync('git init', { cwd: d });
    const oldCwd = process.cwd();
    process.chdir(d);
    try {
      const hookPath = path.join('.git', 'hooks', 'pre-push');
      fs.writeFileSync(hookPath, '#!/bin/sh\necho hi');
      const res = installHook(false);
      expect(res.created).toBe(false);
    } finally {
      process.chdir(oldCwd);
    }
  });
});
