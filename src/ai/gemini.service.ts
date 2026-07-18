import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly modelName = 'gemini-2.0-flash';

  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return Boolean(this.config.get<string>('geminiApiKey')?.trim());
  }

  async generateJson<T>(systemPrompt: string, userPrompt: string): Promise<T> {
    const text = await this.generateText(
      `${systemPrompt}\n\nReturn ONLY valid JSON. No markdown fences.\n\n${userPrompt}`,
    );
    return this.parseJson<T>(text);
  }

  async generateText(prompt: string): Promise<string> {
    const apiKey = this.config.get<string>('geminiApiKey')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'GEMINI_API_KEY is not configured. Add it to backend .env',
      );
    }

    try {
      const client = new GoogleGenerativeAI(apiKey);
      const model = client.getGenerativeModel({ model: this.modelName });
      const result = await model.generateContent(prompt);
      const text = result.response.text()?.trim();
      if (!text) {
        throw new Error('Empty response from Gemini');
      }
      return text;
    } catch (error) {
      this.logger.error(
        `Gemini request failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      throw new ServiceUnavailableException(
        error instanceof Error
          ? `Gemini error: ${error.message}`
          : 'Gemini request failed',
      );
    }
  }

  private parseJson<T>(raw: string): T {
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    try {
      return JSON.parse(cleaned) as T;
    } catch {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start >= 0 && end > start) {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      }
      throw new ServiceUnavailableException('Gemini returned invalid JSON');
    }
  }
}
