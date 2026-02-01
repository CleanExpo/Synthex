import { GoogleGenerativeAI } from '@google/generative-ai';

export interface GeminiConfig {
  apiKey: string;
  model?: string;
}

export class GeminiClient {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(config: GeminiConfig) {
    this.client = new GoogleGenerativeAI(config.apiKey);
    this.model = config.model || 'gemini-pro';
  }

  async generateText(prompt: string): Promise<string> {
    const model = this.client.getGenerativeModel({ model: this.model });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }

  async generateChat(messages: Array<{ role: string; content: string }>): Promise<string> {
    const model = this.client.getGenerativeModel({ model: this.model });
    const chat = model.startChat({
      history: messages.map(m => ({
        role: m.role as 'user' | 'model',
        parts: [{ text: m.content }]
      }))
    });
    const result = await chat.sendMessage(messages[messages.length - 1].content);
    const response = await result.response;
    return response.text();
  }
}

export default GeminiClient;
