#!/usr/bin/env node
import { parseArgs } from 'node:util';

function showHelp() {
  console.log(`diff-review

Usage:
  diff-review review  [--base <ref>] [--staged] [--diff-file <path|->]
                      [--provider ollama|openrouter] [--model <name>]
                      [--max-chars <n>] [--strict]
  diff-review install [--force]
  diff-review uninstall
  diff-review hook <remote-name> <remote-url>
  diff-review --help | --version
`);
}

function showVersion() {
  console.log('0.1.0');
}

async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
      force: { type: 'boolean' },
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

  if (values.help) {
    showHelp();
    return;
  }
  if (values.version) {
    showVersion();
    return;
  }

  const cmd = positionals[0];
  if (!cmd) {
    showHelp();
    return;
  }

  if (cmd === 'review') {
    const { runReview } = await import('./commands/review.js');
    await runReview(process.argv.slice(2));
    return;
  }
  if (cmd === 'install') {
    const { installHook } = await import('./commands/install.js');
    const res = installHook(Boolean(values.force));
    console.log(res.message);
    if (!res.created) process.exit(1);
    return;
  }
  if (cmd === 'uninstall') {
    const { uninstallHook } = await import('./commands/install.js');
    const res = uninstallHook();
    console.log(res.message);
    if (!res.removed) process.exit(0); // be gentle
    return;
  }
  if (cmd === 'hook') {
    const remoteName = positionals[1] || '';
    const remoteUrl = positionals[2] || '';
    const { runHook } = await import('./commands/hook-impl.js');
    await runHook(remoteName, remoteUrl);
    return;
  }

  showHelp();
}

main().catch(() => {
  process.exit(1);
});
