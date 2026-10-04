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

  // For now, just show stub
  if (cmd === 'review') {
    // will be implemented
    return;
  }
  if (cmd === 'install') {
    return;
  }
  if (cmd === 'uninstall') {
    return;
  }
  if (cmd === 'hook') {
    return;
  }

  showHelp();
}

main().catch(() => {
  process.exit(1);
});
