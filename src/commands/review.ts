import { readFileSync } from 'node:fs';
import { formatHeader, postProcess } from '../src/format.js';
import { SYSTEM_PROMPT, buildUserMessage } from '../src/prompt.js';
import { filterAndTruncate, getDiff } from '../src/diff.js';
import { loadConfig, mergeFlags } from '../src/config.js';
import { OllamaProvider } from '../src/providers/ollama.js';
import { OpenRouterProvider } from '../src/providers/openrouter.js';
import { hasCommits, hasStagedChanges, hasUpstream } from '../src/git.js';
import { redactForOpenRouter } from '../src/redact.js';

function getBaseDesc(flags: any): string {
  if (flags['diff-file']) return 'diff-file';
  if (flags.staged) return 'staged';
  if (flags.base) return `base:${flags.base}`;
  return 'upstream diff';
}

export async function runReview(argv: string[]) {
  const { parseArgs } = await import('node:util');
  const { values } = parseArgs({
    args: argv,
    options: {
      base: { type: 'string' },
      staged: { type: 'boolean' },
      'diff-file': { type: 'string' },
      provider: { type: 'string' },
      model: { type: 'string' },
      'max-chars': { type: 'string' },
      strict: { type: 'boolean' },
    },
    strict: false,
  });

  let diffText = '';
  let baseDesc = getBaseDesc(values as any);

  if (values['diff-file']) {
    const p = values['diff-file'] as string;
    if (p === '-') {
      diffText = readFileSync(0, 'utf8');
    } else {
      diffText = readFileSync(p, 'utf8');
    }
  } else if (values.staged) {
    diffText = await getDiff(['--cached']);
  } else if (values.base) {
    diffText = await getDiff([`${values.base}...HEAD`]);
  } else {
    if (await hasUpstream()) {
      baseDesc = 'upstream diff';
      diffText = await getDiff(['@{upstream}...HEAD']);
    } else if (await hasStagedChanges()) {
      baseDesc = 'staged';
      diffText = await getDiff(['--cached']);
    } else {
      if (!(await hasCommits())) {
        console.log('Nothing to review');
        return;
      }
      baseDesc = 'HEAD~1..HEAD';
      diffText = await getDiff(['HEAD~1..HEAD']);
    }
  }

  const cfg = await loadConfig();
  const merged = mergeFlags(cfg, values);

  const stats = filterAndTruncate(diffText, merged.maxChars, merged.ignore);
  if (stats.filesIncluded === 0) {
    console.log('Nothing to review');
    return;
  }

  let toSend = stats.includedText;
  if (merged.provider === 'openrouter') {
    toSend = redactForOpenRouter(toSend);
    process.stderr.write('diff-review: sending diff to hosted service (openrouter)\n');
  }

  const provider =
    merged.provider === 'openrouter'
      ? new OpenRouterProvider(merged.openrouterApiKey || '', merged.model || '', globalThis.fetch, merged.timeoutMs)
      : new OllamaProvider(merged.ollamaHost, merged.model || 'gemma3:1b', globalThis.fetch, merged.timeoutMs);

  let result: string;
  try {
    result = await provider.review({
      system: SYSTEM_PROMPT,
      user: buildUserMessage(toSend, stats.filesIncluded, stats.filesSeen, stats.truncated),
    });
  } catch (err: any) {
    const reason = err.message || String(err);
    process.stderr.write(`diff-review: review skipped (${reason})\n`);
    process.exit(0);
  }

  const processed = postProcess(result);
  const header = formatHeader({
    model: merged.model,
    provider: merged.provider,
    baseDesc,
    filesIncluded: stats.filesIncluded,
    filesSeen: stats.filesSeen,
  });
  const out = [header, processed].filter(Boolean).join('\n');
  console.log(out);
  if (stats.truncated) {
    console.log(`note: diff truncated to ${merged.maxChars} characters, some file(s) not reviewed`);
  }
  if (merged.strict && processed !== 'No issues found.') {
    process.exit(1);
  }
}
