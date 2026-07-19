import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiCacheService } from './ai-cache.service';
import { AiQueueService } from './ai-queue.service';
import type { AiGenerateOptions } from './types/ai.types';

/**
 * Gemini provider adapter.
 * Controllers must never use this directly — go through AiService.
 * Swap providers later by implementing the same generateText/generateJson surface.
 */
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly modelName = 'gemini-2.0-flash';
  private readonly defaultTimeoutMs = 18_000;
  private readonly defaultCacheTtlMs = 15 * 60_000;

  constructor(
    private readonly config: ConfigService,
    private readonly cache: AiCacheService,
    private readonly queue: AiQueueService,
  ) {}

  isConfigured() {
    return Boolean(this.config.get<string>('geminiApiKey')?.trim());
  }

  getModelName() {
    return this.modelName;
  }

  async generateJson<T>(
    systemPrompt: string,
    userPrompt: string,
    options?: AiGenerateOptions,
  ): Promise<{ data: T; fromCache: boolean }> {
    const textResult = await this.generateText(
      `${systemPrompt}\n\nReturn ONLY valid JSON. No markdown fences.\n\n${userPrompt}`,
      options,
    );
    return {
      data: this.parseJson<T>(textResult.text),
      fromCache: textResult.fromCache,
    };
  }

  async generateText(
    prompt: string,
    options?: AiGenerateOptions,
  ): Promise<{ text: string; fromCache: boolean }> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('AI provider is not configured');
    }

    const cacheKey = this.cache.key('gemini:text', {
      model: this.modelName,
      prompt,
    });

    if (!options?.bypassCache) {
      const cached = this.cache.get<string>(cacheKey);
      if (cached) {
        return { text: cached, fromCache: true };
      }
    }

    const text = await this.cache.once(cacheKey, async () => {
      const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
      return this.queue.withRetry('gemini.generateContent', async () => {
        return this.queue.withTimeout(
          this.callGemini(prompt),
          timeoutMs,
          'gemini.generateContent',
        );
      });
    });

    if (!options?.bypassCache) {
      this.cache.set(
        cacheKey,
        text,
        options?.cacheTtlMs ?? this.defaultCacheTtlMs,
      );
    }

    return { text, fromCache: false };
  }

  private async callGemini(prompt: string): Promise<string> {
    const apiKey = this.config.get<string>('geminiApiKey')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException('AI provider is not configured');
    }

    try {
      const client = new GoogleGenerativeAI(apiKey);
      const model = client.getGenerativeModel({ model: this.modelName });
      const result = await model.generateContent(prompt);
      const text = result.response.text()?.trim();
      if (!text) {
        throw new Error('Empty response from AI provider');
      }
      return text;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'AI provider request failed';
      this.logger.error(`Gemini request failed: ${message}`);
      // Friendly message — no stack traces to clients.
      throw new ServiceUnavailableException(
        'AI is temporarily unavailable. Please try again shortly.',
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
        try {
          return JSON.parse(cleaned.slice(start, end + 1)) as T;
        } catch {
          // fall through
        }
      }
      this.logger.error('AI returned invalid JSON');
      throw new ServiceUnavailableException(
        'AI is temporarily unavailable. Please try again shortly.',
      );
    }
  }
}
