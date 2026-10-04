import { describe, it, expect } from 'vitest';
import { OllamaProvider } from '../src/providers/ollama.js';

describe('providers', () => {
  it('handles model not found', async () => {
    const mockFetch = async () => {
      return {
        ok: false,
        status: 404,
        text: async () => '{"error":"model not found"}',
        json: async () => ({}),
      } as any;
    };
    const p = new OllamaProvider('http://localhost:11434', 'nope', mockFetch as any);
    await expect(p.review({ system: 's', user: 'u' })).rejects.toThrow(/ollama pull/);
  });

  it('parses response', async () => {
    const mockFetch = async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({ message: { content: '- bug' } }),
      } as any;
    };
    const p = new OllamaProvider('h', 'm', mockFetch as any);
    const res = await p.review({ system: 's', user: 'u' });
    expect(res).toBe('- bug');
  });
});
