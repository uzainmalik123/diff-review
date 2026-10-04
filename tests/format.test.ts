import { describe, it, expect } from 'vitest';
import { postProcess } from '../src/format.js';

describe('postProcess', () => {
  it('returns exact no issues', () => {
    expect(postProcess('No issues found.')).toBe('No issues found.');
    expect(postProcess('No issues found')).toBe('No issues found.');
  });

  it('extracts bullets', () => {
    const input = `- src/a.ts: bug
* src/b.ts: issue
extra`;
    expect(postProcess(input)).toBe('- src/a.ts: bug\n- src/b.ts: issue');
  });

  it('caps bullets at 5', () => {
    let s = '';
    for (let i = 0; i < 10; i++) s += `- a: x${i}\n`;
    const res = postProcess(s);
    expect(res.split('\n').length).toBe(5);
  });

  it('handles unformatted', () => {
    const res = postProcess('something weird');
    expect(res.startsWith('(unformatted)')).toBe(true);
  });
});
