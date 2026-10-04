# PRD: diff-review

A small CLI and git pre-push hook that sends the diff you are about to push to an open-weight model and prints a short review before the push goes through.

This document is the full spec. A coding agent should be able to build the whole project from it without asking questions.

---

## 0. Instructions for the coding agent (read first)

- Implement everything marked **Must** and **Should**. Skip **Could** unless everything else is done and verified.
- Do not ask the user questions. When something is ambiguous, pick the simplest option, then record the decision under "Assumptions" in `NOTES.md`.
- Work in the order given in section 12 and make a git commit after each step with a clear message. Do not squash or rewrite history.
- This is a brand-new repository. Do not copy code from any other project on this machine. Write everything fresh. Third-party packages from npm are fine.
- Never log or print API keys. Never log the diff contents anywhere except to the model request itself.
- When finished, run `pnpm verify` and fix everything until it passes. Then follow section 13 (final report).
- Do not claim something works unless you ran it. Mark anything you could not run as "not verified" in `NOTES.md`.

---

## 1. Background and purpose

This is a submission for the Hacktoberfest 2026 Weekend Challenge ("Build for a Friend") on DEV. The rules that shape this project:

- It must be built around open-source AI: an open-weight model, local inference, or an open-source agent framework.
- It must be a new project started and completed within the challenge window (started Oct 4, 2026). Any commit made after the deadline (Oct 5, 2026 06:59 UTC) must be listed in the README.
- It is built for one real person: a developer friend who pushes code often and wants a quick sanity check before pushing, without sending his code to a hosted service.

The write-up matters more than anything else, so the README, the example output, and `NOTES.md` need to be clear and honest.

## 2. Goals

1. Catch obvious problems (likely bugs, missing error handling, leftover debug code, missing tests) before `git push`.
2. Run entirely on the user's machine by default, using a small open-weight model through Ollama.
3. Let the user swap the model or provider through config, with no code changes.
4. Never get in the way. A broken or slow review must never block a push unless the user opts in.
5. Install in under two minutes.

## 3. Non-goals

- No web UI, no GitHub Action, no editor plugin, no CI integration.
- No automatic fixing of code. The tool only reports.
- No accounts, telemetry, or analytics.
- No review history storage.
- No support for non-git version control.

## 4. User story

"As a developer, before I push, I want a short list of likely problems in my diff from a model that runs on my laptop, so that I catch dumb mistakes without leaking code or paying for an API."

## 5. Tech stack and constraints

- Language: TypeScript, strict mode. Node.js 20 or newer. Package manager: pnpm.
- **Zero runtime dependencies.** Use Node built-ins only: `child_process` (use `execFile`, never a shell string), `fs`, `path`, `util.parseArgs`, and the global `fetch`.
- Dev dependencies only: `typescript`, `vitest`, `@types/node`, and `eslint` with the TypeScript plugin if it is simple to set up (optional).
- Build with `tsc` to `dist/`. The CLI entry point `dist/cli.js` has a `#!/usr/bin/env node` shebang and is exposed through the `bin` field of `package.json` as `diff-review`.
- ESM output. Keep every source file small and readable.
- License: MIT.

## 6. Commands

```
diff-review review  [--base <ref>] [--staged] [--diff-file <path|->]
                    [--provider ollama|openrouter] [--model <name>]
                    [--max-chars <n>] [--strict]
diff-review install [--force]
diff-review uninstall
diff-review hook <remote-name> <remote-url>     (internal, reads git's pre-push stdin)
diff-review --help | --version
```

### 6.1 `review` (Must)

Chooses the diff source in this order (first match wins), and prints which one it used in the header:

1. `--diff-file <path>` (or `-` for stdin): read a unified diff from a file or stdin. Used for demos and tests.
2. `--staged`: `git diff --cached`.
3. `--base <ref>`: `git diff <ref>...HEAD`.
4. Default: if the current branch has an upstream, `git diff @{upstream}...HEAD`. If there is no upstream, but staged changes exist, use staged. Otherwise use `HEAD~1..HEAD`. If the repo has no commits, print "Nothing to review" and exit 0.

Then: filter and truncate the diff (section 8), call the provider (section 9), and print the result (section 10).

### 6.2 `install` (Must)

Installs a managed `pre-push` hook into the current repository.

- Find the hooks directory with `git rev-parse --git-path hooks`. This respects `core.hooksPath` and worktrees. Create it if missing.
- If a `pre-push` file already exists and was not created by this tool (detect through the marker line `# diff-review managed hook`), do not touch it. Print a clear message and exit 1, unless `--force` is passed. With `--force`, save the old file as `pre-push.backup` first.
- The hook is a POSIX shell script, marked executable (`chmod 755`):

```sh
#!/bin/sh
# diff-review managed hook
if command -v diff-review >/dev/null 2>&1; then
  exec diff-review hook "$@"
else
  exec node "<ABSOLUTE_PATH_TO_dist/cli.js_AT_INSTALL_TIME>" hook "$@"
fi
```

`exec` keeps git's stdin attached to the tool.

### 6.3 `uninstall` (Must)

Remove the hook only if it contains the marker line. Restore `pre-push.backup` if it exists. If the hook is not ours, do nothing and say so.

### 6.4 `hook` (Must)

Internal command that git invokes. Reads stdin lines in git's pre-push format:

```
<local ref> <local oid> <remote ref> <remote oid>
```

Rules:

- Skip lines where the local oid is all zeros (a branch deletion).
- If the remote oid is all zeros (new branch), diff against the merge-base of the local oid and the first existing ref among `origin/HEAD`, `origin/main`, `origin/master`. If none exist, use the local oid's last commit only.
- Otherwise diff `<remote oid>..<local oid>`.
- If several refs are pushed, review them one at a time and cap at the first 3 refs.
- If the diff is empty after filtering, print nothing and exit 0.
- Hook output goes to **stderr** so git always shows it.
- Respect the bypass switch: if the environment variable `DIFF_REVIEW_SKIP=1` is set, exit 0 immediately. (`git push --no-verify` also bypasses all hooks, which is git's own behavior. Mention both in the README.)

Exit code rules for `review` and `hook`:

- Default (advisory mode): **always exit 0**, including on provider errors, timeouts, and unreadable diffs. On such errors, print one line: `diff-review: review skipped (<short reason>)`.
- With `--strict` (or `"strict": true` in config): exit 1 if and only if the model's output is not "No issues found." Errors still skip with exit 0. Strict mode must never fail on infrastructure problems, only on review findings.

## 7. Configuration

Optional file `diff-review.json` at the repository root. Precedence, highest first: CLI flags, environment variables, config file, built-in defaults.

| Setting | Config key | Env var | Default |
|---|---|---|---|
| Provider | `provider` | `DIFF_REVIEW_PROVIDER` | `ollama` |
| Model | `model` | `DIFF_REVIEW_MODEL` | `gemma3:1b` for ollama; **no default** for openrouter (error if missing) |
| Ollama URL | `ollamaHost` | `OLLAMA_HOST` | `http://localhost:11434` |
| API key | (never in file) | `OPENROUTER_API_KEY` | none |
| Max diff size | `maxChars` | `DIFF_REVIEW_MAX_CHARS` | `6000` |
| Timeout | `timeoutMs` | `DIFF_REVIEW_TIMEOUT_MS` | `120000` |
| Strict mode | `strict` | `DIFF_REVIEW_STRICT` | `false` |
| Extra ignore globs | `ignore` | none | `[]` |

The config loader must reject unknown keys with a clear message, validate types, and refuse an API key found in the file (tell the user to use the env var instead).

## 8. Diff handling (Must)

Run git through `execFile` with an argument array, never through a shell. Use `--no-color`, `--unified=3`, and `--no-ext-diff`.

Before sending to the model:

1. **Exclude noise** with git pathspec excludes or by filtering file sections: lockfiles (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lockb`, `Cargo.lock`, `poetry.lock`, `Gemfile.lock`, `go.sum`), build output (`dist/`, `build/`, `node_modules/`, `.next/`), minified or generated files (`*.min.js`, `*.map`), and binary files (sections containing "Binary files ... differ"). Also apply the user's `ignore` globs.
2. **Truncate** to `maxChars`. Keep whole file sections where possible: include sections in order until the next one would exceed the budget, then cut the last section at a line boundary. Never cut mid-line.
3. Track what happened: number of files seen, number included, whether truncation occurred, and total changed lines.
4. If truncated, the printed output must say so (section 10).

A diff with zero included files after filtering prints "Nothing to review" and exits 0.

**Should:** when the provider is `openrouter`, run a simple redaction pass over the diff before sending it: replace matches of obvious secret patterns (private key blocks, `AKIA[0-9A-Z]{16}`, strings of the form `sk-...` longer than 20 characters, and `password|secret|token|api_key` assignments with a quoted value) with `[REDACTED]`. Also print one stderr warning per run that the diff is being sent to a hosted service. Do not do this for ollama.

## 9. Providers

Define a small `Provider` interface: `review(prompt: {system: string; user: string}): Promise<string>`. Providers receive `fetch` and the timeout through their constructor so tests can inject a fake.

### 9.1 Ollama (Must)

`POST {ollamaHost}/api/chat` with JSON:

```json
{
  "model": "<model>",
  "stream": false,
  "messages": [
    {"role": "system", "content": "<system prompt>"},
    {"role": "user", "content": "<user message>"}
  ],
  "options": {"temperature": 0.2, "num_ctx": 4096}
}
```

Read `message.content` from the response. Handle: connection refused (print "Ollama is not reachable at <url>. Start it with `systemctl start ollama` or `ollama serve`"), HTTP error with a model-not-found body (print `ollama pull <model>` hint), timeout through `AbortController`, and malformed JSON. All of these become a skipped review, not a crash.

### 9.2 OpenRouter (Should)

`POST https://openrouter.ai/api/v1/chat/completions` with header `Authorization: Bearer ${OPENROUTER_API_KEY}` and an OpenAI-style body (`model`, `messages`, `temperature: 0.2`, `stream: false`). Read `choices[0].message.content`. Missing key or missing model gives a clear config error, printed as a skipped review. Surface rate-limit and auth errors in one line each.

## 10. Prompt and output

### 10.1 System prompt (use exactly this as a starting point; keep it in `src/prompt.ts`)

```
You are a strict but concise code reviewer. You will be given a git diff.
List only concrete problems you can point to in the diff: likely bugs, missing error handling, leftover debug code (console.log, print, debugger, TODO/FIXME added in this diff), and missing tests for new logic.
Rules:
- Output at most 5 bullet points, one line each, starting with "- ".
- Mention the file name in each bullet when you can.
- Do not praise the code. Do not summarize the diff. Do not suggest style changes.
- If you find no concrete problem, output exactly: No issues found.
```

### 10.2 User message

```
Review this diff.
Files included: <n> of <total>. Truncated: <yes|no>.

<diff text>
```

### 10.3 Post-processing

Models this small ramble. Enforce the format in code:

- Trim whitespace. Keep only lines that start with `- ` or `* `; normalize them to `- `. Keep at most 5 and cap each at 200 characters.
- If no bullet lines remain and the text (case-insensitive, trailing period optional) equals "no issues found", the result is "No issues found."
- If no bullet lines remain and the text is something else, print the first 3 non-empty lines of it as-is, prefixed by `(unformatted) `, and treat it as findings for strict mode.

### 10.4 Printed result (stderr in hook mode, stdout in `review`)

```
diff-review · gemma3:1b via ollama · upstream diff · 3 of 3 files · 142 lines
- src/api.ts: fetch result is used without checking response.ok
- src/api.ts: console.log left in getUser()
- no tests added for the new retry logic
```

When truncated, add a line: `note: diff truncated to <maxChars> characters, <k> file(s) not reviewed`. When there are no findings: `No issues found.` Respect `NO_COLOR`; use no color at all in v1, plain text only. When the review is skipped: `diff-review: review skipped (<reason>)`.

## 11. Repository layout

```
diff-review/
  PRD.md                  # this file, keep it
  NOTES.md                # assumptions, test results, verification log (written by the agent)
  README.md
  LICENSE
  package.json
  tsconfig.json
  diff-review.example.json
  examples/sample.diff    # a small realistic diff with a few planted problems for the demo
  src/
    cli.ts                # arg parsing, command dispatch
    commands/review.ts
    commands/install.ts   # install + uninstall
    commands/hook.ts
    git.ts                # all git calls via execFile
    diff.ts               # filter, split by file, truncate, stats
    prompt.ts             # system prompt + user message builder
    format.ts             # post-processing and printing
    config.ts             # load, merge, validate
    redact.ts             # Should
    providers/types.ts
    providers/ollama.ts
    providers/openrouter.ts
  tests/
    diff.test.ts
    format.test.ts
    config.test.ts
    hook-range.test.ts
    providers.test.ts
    install.test.ts
    cli-e2e.test.ts
```

## 12. Build order (commit after each step)

1. Scaffold: `package.json` (scripts below), `tsconfig.json`, `LICENSE`, `.gitignore`, empty `src/cli.ts` with `--help` and `--version`. Commit the PRD first, before anything else.
2. `diff.ts` and `git.ts` with tests.
3. `prompt.ts` and `format.ts` with tests.
4. `config.ts` with tests.
5. Ollama provider with fake-`fetch` tests, then the `review` command with `--diff-file`.
6. `hook.ts` (pure function that turns stdin lines into diff ranges, tested separately) and `install`/`uninstall`, tested in temporary real git repos (`git init` in a temp dir).
7. OpenRouter provider and `redact.ts`.
8. README, `examples/sample.diff`, `diff-review.example.json`, `NOTES.md`.
9. End-to-end check (section 14).

`package.json` scripts: `build` (`tsc`), `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `verify` (typecheck, then test, then build). `pnpm verify` must pass from a clean clone after `pnpm install --frozen-lockfile`.

## 13. Final report (required)

At the end, print a short report and write it into `NOTES.md`:

- What was implemented, command by command, and what was not.
- Output of `pnpm verify`.
- The result of the end-to-end check in section 14, including the exact command lines used, the real model name, the time the review took, and the real captured output.
- Assumptions made. Anything not verified. Known weaknesses of the review quality with a 1B model, stated honestly.

## 14. End-to-end check (required if Ollama is reachable)

1. Run `curl -s http://localhost:11434/api/tags`. If it fails, do not fake it. Note "e2e not verified: Ollama unreachable" in `NOTES.md` and skip to step 5.
2. Run `diff-review review --diff-file examples/sample.diff` and save the exact output.
3. In a temp git repo with a bare "remote": install the hook, commit a change with a planted problem, run `git push`, and confirm the review prints and the push still succeeds.
4. Stop Ollama (or point `OLLAMA_HOST` at a dead port) and confirm the push still succeeds with "review skipped". Confirm `--strict` still does not fail on that.
5. Confirm `DIFF_REVIEW_SKIP=1 git push` prints nothing.

## 15. Acceptance criteria

- [ ] `pnpm verify` passes on a clean clone.
- [ ] `diff-review install` creates an executable `.git/hooks/pre-push` (or the configured hooks path) with the marker line, refuses to overwrite a foreign hook, and `uninstall` removes only ours.
- [ ] A normal `git push` in a repo with the hook prints a review to stderr and the push completes.
- [ ] With Ollama stopped, the push completes and one "review skipped" line is printed.
- [ ] `--strict` exits 1 only when findings exist, never on infrastructure errors.
- [ ] Lockfiles and binaries never reach the model. Truncation is reported in the output.
- [ ] Provider and model are changeable through flags, env, and config file, with the documented precedence.
- [ ] No API key is ever printed or accepted from the config file.
- [ ] Zero runtime dependencies in `package.json`.
- [ ] README follows section 16, and every command in it was actually run.

## 16. README requirements

Plain, short, honest. Sections, in order:

1. One-line description and a captured example of real output (from the e2e check, not invented).
2. **Why local and open-weight**: the code never leaves your machine; the model is swappable by config; it costs nothing to run. Say plainly that small models give shallow reviews and are advisory only.
3. **Quick start** (Arch Linux, then a generic note for other systems):
   ```
   sudo pacman -S ollama
   sudo systemctl enable --now ollama
   ollama pull gemma3:1b
   git clone <repo> && cd diff-review
   pnpm install && pnpm build && pnpm link --global
   cd /path/to/your/project && diff-review install
   ```
4. Usage: each command with one example.
5. Configuration table (copy from section 7) and the OpenRouter alternative, with the privacy caveat that the diff leaves your machine and what redaction does and does not catch.
6. How it works in five lines (hook, diff range, filter and truncate, model, formatted output).
7. Limitations: small-model quality, truncation, advisory only, bypass with `--no-verify` or `DIFF_REVIEW_SKIP=1`.
8. Development: install, test, build.
9. **Challenge note**: "Built for a friend for the Hacktoberfest 2026 Weekend Challenge, started October 4, 2026." Then a heading **Post-deadline changes** listing any commit made after October 5, 2026 06:59 UTC (empty if none).
10. License.

Do not mention the author's location, nationality, or any personal details anywhere in the repository.

## 17. Out of scope for the agent

Publishing to npm, creating the GitHub repository, writing the DEV post, contacting the friend, or pushing to a remote. The user does these.
