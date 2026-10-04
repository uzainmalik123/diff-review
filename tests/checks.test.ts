import { describe, it, expect } from 'vitest';
import { runChecks } from '../src/checks.js';

describe('checks', () => {
  it('detects console.log', () => {
    const diff = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,1 +1,1 @@
-console.log('hi')
`;
    const res = runChecks(diff);
    expect(res.some((r) => r.issue.includes('debug'))).toBe(true);
  });

  it('detects secrets', () => {
    const diff = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,1 +1,1 @@
+AKIA0123456789ABCDEF
`;
    const res = runChecks(diff);
    expect(res.some((r) => r.issue.includes('secret'))).toBe(true);
  });

  it('detects TODO', () => {
    const diff = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,1 +1,1 @@
+// TODO fix
`;
    const res = runChecks(diff);
    expect(res.some((r) => r.issue.includes('TODO'))).toBe(true);
  });
});
