# diff-review

Local CLI and git pre-push hook that reviews your diff using an open-weight model running on your machine.

## Example

```text
diff-review · gemma3:1b via ollama · diff-file · 1 of 1 files · 142 lines
- src/api.ts: fetch result is used without checking response.ok
- src/api.ts: console.log left in getUser()
```

## Why local and open-weight

- **Code never leaves your machine** by default (Ollama runs locally). If you use OpenRouter, the diff is sent to that hosted service (see privacy note below).
- **Model is swappable** via CLI flags, environment variables, or config; no code changes.
- **Free to run.** Small 1B models give shallow reviews and are **advisory only** - they may miss things and sometimes produce unhelpful output. We also include **rule-based checks plus model review** (deterministic checks that catch obvious issues without invoking a model), and we honestly note that a 1B model adds little on top of those checks.

## Quick start

### Arch Linux
```bash
sudo pacman -S ollama
sudo systemctl enable --now ollama
ollama pull gemma3:1b
git clone <repo> && cd diff-review
pnpm install && pnpm build && pnpm link --global
cd /path/to/your/project && diff-review install
```

For other systems: install [Ollama](https://ollama.com), `ollama pull gemma3:1b`, then build and install as above.

## Usage

- `diff-review review [--base <ref>] [--staged] [--diff-file <path|->] [--provider ollama|openrouter] [--model <name>] [--max-chars <n>] [--strict]`  
  Review the diff. Prints which source was used in header.
- `diff-review install [--force]`  
  Installs managed pre-push hook.
- `diff-review uninstall`  
  Removes managed hook (restores backup if present).
- `diff-review hook <remote-name> <remote-url>`  
  Internal; called by git pre-push.
- `diff-review --help | --version`

Examples:
```bash
diff-review review --diff-file examples/sample.diff
diff-review install
diff-review uninstall
```

## Configuration

Precedence: CLI flags > environment variables > config file > built-in defaults. Optional `diff-review.json` at repo root.

| Setting | Config key | Env var | Default |
|---|---|---|---|
| Provider | `provider` | `DIFF_REVIEW_PROVIDER` | `ollama` |
| Model | `model` | `DIFF_REVIEW_MODEL` | `gemma3:1b` (ollama); none for openrouter (error if missing) |
| Ollama URL | `ollamaHost` | `OLLAMA_HOST` | `http://localhost:11434` |
| API key | (never in file) | `OPENROUTER_API_KEY` | none |
| Max diff size | `maxChars` | `DIFF_REVIEW_MAX_CHARS` | `6000` |
| Timeout | `timeoutMs` | `DIFF_REVIEW_TIMEOUT_MS` | `120000` |
| Strict mode | `strict` | `DIFF_REVIEW_STRICT` | `false` |
| Extra ignore globs | `ignore` | none | `[]` |

**OpenRouter alternative:** set `provider: openrouter`, `model: <model>`, and `OPENROUTER_API_KEY`. **Privacy caveat:** with OpenRouter, the diff leaves your machine; we do a simple redaction pass (private keys, AKIA keys, long sk- tokens, obvious quoted password/secret/token/api_key assignments), but it may miss secrets. Review locally with Ollama if privacy is critical.

## How it works (in five lines)

1. Hook reads git pre-push stdin to determine what range to diff.
2. Computes diff range (upstream/staged/new branch fallback as specified).
3. Filters noise (lockfiles, build dirs, binaries, generated/minified) and truncates at line boundaries.
4. Runs rule-based checks on added lines; also sends filtered diff to model (with redaction for hosted providers).
5. Prints deterministic findings first (each as `- <file>: <issue>`), then model bullets; if model output is empty/unformatted/repeats prompt, it's dropped. Output goes to stderr in hook mode.

## Limitations

- **Small models** give shallow reviews; treat as advisory only.
- **Truncation** may hide context - truncation is reported.
- **Advisory only**: never blocks push by default. Infrastructure errors always skip (exit 0). `--strict` exits 1 only if findings exist (deterministic or model) - never on infra errors.
- **Bypass**: `git push --no-verify` or `DIFF_REVIEW_SKIP=1` skips review.

## Development

```bash
pnpm install
pnpm test
pnpm build
pnpm typecheck
pnpm verify  # typecheck + test + build
```

## Challenge note

Built for a friend for the Hacktoberfest 2026 Weekend Challenge, started October 4, 2026.

### Post-deadline changes
None.

## License
MIT
