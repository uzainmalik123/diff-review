import { describe, it, expect } from 'vitest';

describe('cli e2e', () => {
  it('shows help', async () => {
    const { execSync } = await import('node:child_process');
    const out = execSync('node dist/cli.js --help', { encoding: 'utf8' });
    expect(out).toContain('diff-review');
  });
});
