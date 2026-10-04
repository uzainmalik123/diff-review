import { describe, it, expect } from 'vitest';
import { filterAndTruncate } from '../src/diff.js';

describe('filterAndTruncate', () => {
  it('filters lockfiles', () => {
    const diff = `diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
index 123..456 100644
--- a/pnpm-lock.yaml
+++ b/pnpm-lock.yaml
@@ -1,1 +1,1 @@
-lock
+lock changed
`;
    const res = filterAndTruncate(diff, 6000, []);
    expect(res.filesIncluded).toBe(0);
  });

  it('truncates without cutting mid-line', () => {
    const diff = `diff --git a/src/a.ts b/src/a.ts
index 1..2 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,1 +1,1 @@
-hello
+helloxxxxxx
`;
    const res = filterAndTruncate(diff, 10, []);
    expect(res.includedText).toBeTruthy();
  });
});
