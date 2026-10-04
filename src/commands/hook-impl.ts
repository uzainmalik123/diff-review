import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { SYSTEM_PROMPT, buildUserMessage } from '../prompt.js';
import { filterAndTruncate, getDiff } from '../diff.js';
import { loadConfig } from '../config.js';
import { OllamaProvider } from '../providers/ollama.js';
import { OpenRouterProvider } from '../providers/openrouter.js';
import { formatHeader, postProcess } from '../format.js';
import { redactForOpenRouter } from '../redact.js';
import { runChecks, formatChecks } from '../checks.js';

export async function runHook(remoteName: string, remoteUrl: string) {
  if (process.env.DIFF_REVIEW_SKIP === '1') {
    return;
  }

  let stdin = '';
  try {
    stdin = readFileSync(0, 'utf8');
  } catch {
    return;
  }

  const lines = stdin.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const ranges: string[] = [];

  for (const l of lines) {
    const parts = l.trim().split(/\s+/);
    if (parts.length < 4) continue;
    const localRef = parts[0];
    const localOid = parts[1];
    const remoteRef = parts[2];
    const remoteOid = parts[3];
    if (localOid.match(/^0+$/)) continue; // delete
    if (remoteOid.match(/^0+$/)) {
      try {
        const candidates = ['origin/HEAD', 'origin/main', 'origin/master'];
        let base: string | null = null;
        for (const c of candidates) {
          try {
            execFileSync('git', ['rev-parse', '--verify', c], { stdio: 'ignore' });
            base = c;
            break;
          } catch {}
        }
        if (base) {
          ranges.push(`${base}...${localOid}`);
        } else {
          ranges.push(`${localOid}^...${localOid}`);
        }
      } catch {
        ranges.push(`${localOid}^...${localOid}`);
      }
    } else {
      ranges.push(`${remoteOid}..${localOid}`);
    }
    if (ranges.length >= 3) break;
  }

  if (ranges.length === 0) return;

  const cfg = await loadConfig();
  let foundIssues = false;

  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    let diffText: string;
    try {
      diffText = await getDiff(range.split(' '));
    } catch {
      process.stderr.write(`diff-review: review skipped (git diff failed)\n`);
      continue;
    }

    const stats = filterAndTruncate(diffText, cfg.maxChars, cfg.ignore);
    if (stats.filesIncluded === 0) continue;

    const checksFindings = runChecks(stats.includedText);
    const checksOutput = formatChecks(checksFindings);
    if (checksOutput) {
      process.stderr.write(checksOutput + '\n');
      foundIssues = true;
    }

    let toSend = stats.includedText;
    if (cfg.provider === 'openrouter') {
      toSend = redactForOpenRouter(toSend);
      if (i === 0) {
        process.stderr.write('diff-review: sending diff to hosted service (openrouter)\n');
      }
    }

    const provider =
      cfg.provider === 'openrouter'
        ? new OpenRouterProvider(cfg.openrouterApiKey || '', cfg.model || '', globalThis.fetch, cfg.timeoutMs)
        : new OllamaProvider(cfg.ollamaHost, cfg.model || 'gemma3:1b', globalThis.fetch, cfg.timeoutMs);

    let result: string;
    try {
      result = await provider.review({
        system: SYSTEM_PROMPT,
        user: buildUserMessage(toSend, stats.filesIncluded, stats.filesSeen, stats.truncated),
      });
    } catch (err: any) {
      process.stderr.write(`diff-review: review skipped (${err.message || err})\n`);
      continue;
    }

    let processed = postProcess(result);
    if (!processed || processed === SYSTEM_PROMPT || processed.startsWith('(unformatted)')) {
      processed = 'No issues found.';
    }

    const header = formatHeader({
      model: cfg.model,
      provider: cfg.provider,
      baseDesc: 'pre-push',
      filesIncluded: stats.filesIncluded,
      filesSeen: stats.filesSeen,
    });
    process.stderr.write(header + '\n');
    process.stderr.write(processed + '\n');
    if (stats.truncated) {
      process.stderr.write(`note: diff truncated to ${cfg.maxChars} characters, some file(s) not reviewed\n`);
    }
    if (processed !== 'No issues found.') {
      foundIssues = true;
    }
  }

  if (cfg.strict && foundIssues) {
    process.exit(1);
  }
}
