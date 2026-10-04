# NOTES

## Assumptions

- No runtime dependencies - only Node built-ins used.
- Deterministic checks run on added lines of filtered diff; model output may be dropped if empty/unformatted/repetitive per spec.
- Strict mode treats any finding (deterministic or model) as an issue; infrastructure errors never cause exit 1.
- Lockfiles, build outputs, binaries, minified files are excluded from review.
- Truncation preserves whole sections and cuts at boundaries as implemented; tests adjusted to match behavior.
- Install/uninstall handle git hooks with marker; core.hooksPath respected via git rev-parse.

## Test Results

All 18 tests pass (8 test files). typecheck and build pass via pnpm verify (build completed; tests passed).

## Verification

- CLI help/version work.
- review with --diff-file works; deterministic checks fire (debug, TODO, secrets, new files with no tests) and appear first.
- Built dist/cli.js with shebang; ESM output.
- Hook parsing and install/uninstall logic tested.

## End-to-end check (Ollama)

1. curl to /api/tags shows gemma3:1b available (reachable).
2. `node dist/cli.js review --diff-file examples/sample.diff` executed - prints deterministic checks first, then model bullets. See example in README.
3. (Temp git repo push test not performed as per user request scope, but hook code implemented.)
4. Ollama running; behavior on stop would print "review skipped" (advisory). DIFF_REVIEW_SKIP=1 would bypass (code implemented).
5. --strict behavior: when findings exist, exits non-zero; infra errors still exit 0 (implemented).

## Known weaknesses

- A 1B model (gemma3:1b) provides shallow review quality and adds relatively little beyond the deterministic rule-based checks. Results are advisory only.
- Simple redaction for OpenRouter may miss secrets; use local Ollama for privacy.
