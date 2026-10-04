import { describe, it, expect } from 'vitest';
import { parsePrepushLines } from '../src/commands/hook.js';

describe('hook ranges', () => {
  it('parses lines', () => {
    const s = 'refs/heads/main abc123 refs/heads/main 0000000000000000000000000000000000000000\n';
    const res = parsePrepushLines(s);
    expect(res.length).toBe(1);
    expect(res[0].localOid).toBe('abc123');
    expect(res[0].remoteOid.startsWith('0000')).toBe(true);
  });
});
