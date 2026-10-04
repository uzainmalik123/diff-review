import * as fs from 'node:fs';
import * as path from 'node:path';

export interface Config {
  provider: 'ollama' | 'openrouter';
  model?: string;
  ollamaHost: string;
  openrouterApiKey?: string;
  maxChars: number;
  timeoutMs: number;
  strict: boolean;
  ignore: string[];
}

const DEFAULTS: Config = {
  provider: 'ollama',
  ollamaHost: 'http://localhost:11434',
  maxChars: 6000,
  timeoutMs: 120000,
  strict: false,
  ignore: [],
};

function mergeEnv(cfg: Config): Config {
  const out = { ...cfg };
  if (process.env.DIFF_REVIEW_PROVIDER) out.provider = process.env.DIFF_REVIEW_PROVIDER as any;
  if (process.env.DIFF_REVIEW_MODEL) out.model = process.env.DIFF_REVIEW_MODEL;
  if (process.env.OLLAMA_HOST) out.ollamaHost = process.env.OLLAMA_HOST;
  if (process.env.OPENROUTER_API_KEY) out.openrouterApiKey = process.env.OPENROUTER_API_KEY;
  if (process.env.DIFF_REVIEW_MAX_CHARS) {
    out.maxChars = parseInt(process.env.DIFF_REVIEW_MAX_CHARS, 10);
  }
  if (process.env.DIFF_REVIEW_TIMEOUT_MS) {
    out.timeoutMs = parseInt(process.env.DIFF_REVIEW_TIMEOUT_MS, 10);
  }
  if (process.env.DIFF_REVIEW_STRICT === '1' || process.env.DIFF_REVIEW_STRICT === 'true') {
    out.strict = true;
  }
  return out;
}

export async function loadConfig(cwd: string = process.cwd()): Promise<Config> {
  let cfg: Config = { ...DEFAULTS };
  const configPath = path.join(cwd, 'diff-review.json');
  if (fs.existsSync(configPath)) {
    const text = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      if ('openrouterApiKey' in parsed || 'apiKey' in parsed) {
        throw new Error('API key must not be in config file; use OPENROUTER_API_KEY env var');
      }
    }
    const allowed = new Set(['provider', 'model', 'ollamaHost', 'maxChars', 'timeoutMs', 'strict', 'ignore']);
    for (const k of Object.keys(parsed)) {
      if (!allowed.has(k)) {
        throw new Error(`Unknown config key: ${k}`);
      }
    }
    if (parsed.provider && parsed.provider !== 'ollama' && parsed.provider !== 'openrouter') {
      throw new Error('Invalid provider');
    }
    cfg = { ...cfg, ...parsed };
  }
  cfg = mergeEnv(cfg);
  if (cfg.provider === 'ollama' && !cfg.model) {
    cfg.model = 'gemma3:1b';
  }
  if (cfg.provider === 'openrouter' && !cfg.model) {
    throw new Error('model is required for openrouter');
  }
  return cfg;
}

export function mergeFlags(cfg: Config, flags: any): Config {
  const out = { ...cfg };
  if (flags.provider) out.provider = flags.provider;
  if (flags.model) out.model = flags.model;
  if (flags['max-chars']) out.maxChars = parseInt(flags['max-chars'], 10);
  if (flags.strict) out.strict = true;
  return out;
}
