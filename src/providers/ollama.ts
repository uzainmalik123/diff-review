import { Provider, ReviewPrompt } from './types.js';

export class OllamaProvider implements Provider {
  constructor(private host: string, private model: string, private fetchImpl: typeof fetch = globalThis.fetch, private timeoutMs: number = 120000) {}

  async review(prompt: ReviewPrompt): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(`${this.host}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          stream: false,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
          options: { temperature: 0.2, num_ctx: 4096 },
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        if (text.includes('model') && text.includes('not found')) {
          throw new Error(`ollama pull ${this.model}`);
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const json: any = await res.json().catch(() => ({}));
      return json?.message?.content || json?.choices?.[0]?.message?.content || '';
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('timeout');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
