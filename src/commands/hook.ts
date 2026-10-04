export function parsePrepushLines(stdin: string): Array<{ localRef: string; localOid: string; remoteRef: string; remoteOid: string }> {
  const lines = stdin.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const res: any[] = [];
  for (const l of lines) {
    const parts = l.trim().split(/\s+/);
    if (parts.length >= 4) {
      res.push({ localRef: parts[0], localOid: parts[1], remoteRef: parts[2], remoteOid: parts[3] });
    }
  }
  return res;
}
