export function redactForOpenRouter(diff: string): string {
  let out = diff;
  // private key blocks
  out = out.replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[REDACTED]');
  // AKIA keys
  out = out.replace(/AKIA[0-9A-Z]{16}/g, '[REDACTED]');
  // sk- tokens
  out = out.replace(/sk-[A-Za-z0-9]{20,}/g, '[REDACTED]');
  // assignments
  out = out.replace(/(password|secret|token|api_key)\s*=\s*["'][^"']*["']/gi, '$1=[REDACTED]');
  return out;
}
