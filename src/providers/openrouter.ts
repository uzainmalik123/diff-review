import { Provider, ReviewPrompt } from './types.js';

export class OpenRouterProvider implements Provider {
  constructor(private apiKey: string, private model: string, private fetchImpl: typeof fetch = globalThis.fetch, private timeoutMs: number = 120000) {}

  async review(prompt: ReviewPrompt): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
          temperature: 0.2,
          stream: false,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        if (res.status === 429) throw new Error('rate limit');
        if (res.status === 401) throw new Error('auth error');
        throw new Error(`HTTP ${res.status}`);
      }
      const json: any = await res.json().catch(() => ({}));
      return json?.choices?.[0]?.message?.content || '';
    } catch (err: any) {
      if (err.name === 'AbortError') throw new Error('timeout');
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
