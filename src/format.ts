export function postProcess(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 'No issues found.';

  const lines = trimmed.split(/\r?\n/);
  const bullets: string[] = [];

  for (const l of lines) {
    const t = l.trim();
    if (t.startsWith('- ') || t.startsWith('* ')) {
      let norm = t.startsWith('* ') ? '- ' + t.substring(2) : t;
      if (norm.length > 200) {
        norm = norm.substring(0, 197) + '...';
      }
      bullets.push(norm);
      if (bullets.length >= 5) break;
    }
  }

  if (bullets.length === 0) {
    const clean = trimmed.toLowerCase().replace(/\.$/, '');
    if (clean === 'no issues found') {
      return 'No issues found.';
    }
    const nonEmpty = lines.filter((x) => x.trim().length > 0).slice(0, 3);
    if (nonEmpty.length === 0) return 'No issues found.';
    return '(unformatted) ' + nonEmpty.join(' ');
  }

  return bullets.join('\n');
}

export interface PrintOptions {
  model?: string;
  provider?: string;
  via?: string;
  baseDesc?: string;
  filesIncluded?: number;
  filesSeen?: number;
  truncated?: boolean;
  maxChars?: number;
  result?: string;
  skipped?: boolean;
  skipReason?: string;
}

export function formatHeader(opts: PrintOptions): string {
  const parts = ['diff-review'];
  if (opts.model) parts.push(opts.model);
  if (opts.provider || opts.via) parts.push(`via ${opts.provider || opts.via}`);
  if (opts.baseDesc) parts.push(opts.baseDesc);
  if (typeof opts.filesIncluded === 'number' && typeof opts.filesSeen === 'number') {
    parts.push(`${opts.filesIncluded} of ${opts.filesSeen} files`);
  }
  return parts.join(' · ');
}
