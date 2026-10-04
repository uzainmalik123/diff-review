export interface ReviewPrompt {
  system: string;
  user: string;
}

export interface Provider {
  review(prompt: ReviewPrompt): Promise<string>;
}
