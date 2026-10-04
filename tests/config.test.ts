import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

describe('config', () => {
  it('loads defaults', async () => {
    const d = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'dr-'));
    const cfg = await loadConfig(d);
    expect(cfg.provider).toBe('ollama');
    expect(cfg.model).toBe('gemma3:1b');
  });

  it('rejects unknown keys', async () => {
    const d = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'dr-'));
    await fs.promises.writeFile(path.join(d, 'diff-review.json'), JSON.stringify({ foo: 'bar' }));
    await expect(loadConfig(d)).rejects.toThrow('Unknown config key');
  });

  it('rejects api key in file', async () => {
    const d = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'dr-'));
    await fs.promises.writeFile(path.join(d, 'diff-review.json'), JSON.stringify({ openrouterApiKey: 'sk-xxx' }));
    await expect(loadConfig(d)).rejects.toThrow('API key must not be in config file');
  });
});
