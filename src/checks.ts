export interface CheckFinding {
  file: string;
  issue: string;
}

function extractFilename(line: string, currentFile: string | null): string | null {
  if (line.startsWith('+++')) {
    const m = line.match(/^\+\+\+ b\/(.+)$/);
    if (m) return m[1];
  }
  return currentFile;
}

export function runChecks(diff: string): CheckFinding[] {
  const lines = diff.split(/\n/);
  let currentFile: string | null = null;
  const findings: CheckFinding[] = [];
  const addedFiles = new Set<string>();
  const addedFunctionFiles = new Set<string>();
  const filesWithTestsTouched = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fn = extractFilename(line, currentFile);
    if (fn) currentFile = fn;
    if (!currentFile) continue;

    if (line.startsWith('diff --git')) {
      // detect if new file
      if (lines[i + 1]?.startsWith('new file mode')) {
        addedFiles.add(currentFile);
      }
    }

    // track test files touched
    if (currentFile.match(/test|spec/i)) {
      filesWithTestsTouched.add(currentFile);
    }

    if (line.startsWith('+')) {
      const added = line.substring(1);
      // debug patterns
      if (/console\.log/.test(added) || /\bdebugger\b/.test(added) || /\bprint\s*\(/.test(added) || /\bpdb\b/.test(added)) {
        findings.push({ file: currentFile, issue: 'debug code found' });
      }
      if (/\b(TODO|FIXME)\b/.test(added)) {
        findings.push({ file: currentFile, issue: 'TODO/FIXME added' });
      }
      // function definitions in added lines
      if (/function\s+\w+|const\s+\w+\s*=|class\s+\w+/.test(added)) {
        addedFunctionFiles.add(currentFile);
      }
      // secrets
      if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(added)) {
        findings.push({ file: currentFile, issue: 'obvious secret' });
      }
      if (/AKIA[0-9A-Z]{16}/.test(added)) {
        findings.push({ file: currentFile, issue: 'obvious secret' });
      }
      if (/password\s*=|token\s*=|api_key\s*=/.test(added)) {
        findings.push({ file: currentFile, issue: 'obvious secret' });
      }
    }
  }

  for (const f of addedFiles) {
    // if it's a source file (not test/spec) and no test touched
    if (!f.match(/test|spec/i)) {
      if (filesWithTestsTouched.size === 0) {
        findings.push({ file: f, issue: 'new source file with no test touched in diff' });
      }
    }
  }
  for (const f of addedFunctionFiles) {
    if (!f.match(/test|spec/i)) {
      if (filesWithTestsTouched.size === 0) {
        findings.push({ file: f, issue: 'new logic with no test touched in diff' });
      }
    }
  }

  return findings;
}

export function formatChecks(findings: CheckFinding[]): string {
  return findings.map((f) => `- ${f.file}: ${f.issue}`).join('\n');
}
