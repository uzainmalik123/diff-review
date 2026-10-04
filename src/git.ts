import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function git(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execFileAsync('git', args);
  return { stdout: stdout.toString(), stderr: stderr.toString() };
}

export async function gitPathHooks(): Promise<string> {
  const { stdout } = await git(['rev-parse', '--git-path', 'hooks']);
  return stdout.trim();
}

export async function hasCommits(): Promise<boolean> {
  try {
    const { stdout } = await git(['rev-parse', '--verify', 'HEAD']);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

export async function hasStagedChanges(): Promise<boolean> {
  const { stdout } = await git(['diff', '--cached', '--name-only']);
  return stdout.trim().length > 0;
}

export async function hasUpstream(): Promise<boolean> {
  try {
    const { stdout } = await git(['rev-parse', '--abbrev-ref', '@{upstream}']);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

export async function getUpstream(): Promise<string> {
  const { stdout } = await git(['rev-parse', '--abbrev-ref', '@{upstream}']);
  return stdout.trim();
}
