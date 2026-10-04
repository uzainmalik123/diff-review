# NOTES

## Assumptions

- No runtime dependencies - only Node built-ins used.
- Deterministic checks run on added lines of filtered diff; model output may be dropped if empty/unformatted/repetitive.
- Strict mode treats any finding (deterministic or model) as an issue; infrastructure errors never cause exit 1.
- Lockfiles, build outputs, binaries, minified files are excluded from review.
- Truncation preserves whole sections and cuts at line boundaries when necessary.

## Test Results

TBD - run tests via pnpm verify

## Verification

TBD

## Known weaknesses

- A 1B model (gemma3:1b) provides shallow review quality and adds relatively little beyond the deterministic rule-based checks. Results are advisory only.
- Simple redaction for OpenRouter may miss secrets; use local Ollama for privacy.
