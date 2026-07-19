import { Injectable, Logger } from '@nestjs/common';

type QueueJob<T> = {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

/**
 * Serializes outbound AI provider calls and applies exponential backoff retries.
 */
@Injectable()
export class AiQueueService {
  private readonly logger = new Logger(AiQueueService.name);
  private queue: Array<QueueJob<unknown>> = [];
  private running = false;
  private lastCallAt = 0;
  private readonly minGapMs = 250;

  enqueue<T>(run: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        run: run as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      void this.pump();
    });
  }

  async withRetry<T>(
    label: string,
    fn: () => Promise<T>,
    options?: { retries?: number; baseDelayMs?: number },
  ): Promise<T> {
    const retries = options?.retries ?? 3;
    const baseDelayMs = options?.baseDelayMs ?? 400;
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= retries) {
      try {
        return await this.enqueue(fn);
      } catch (error) {
        lastError = error;
        attempt += 1;
        if (attempt > retries || !this.isRetryable(error)) {
          break;
        }
        const delay = baseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 120);
        this.logger.warn(
          `${label} failed (attempt ${attempt}/${retries}). Retrying in ${delay}ms`,
        );
        await sleep(delay);
      }
    }

    throw lastError;
  }

  withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private isRetryable(error: unknown): boolean {
    const message = String(
      error instanceof Error ? error.message : error || '',
    ).toLowerCase();
    return (
      message.includes('429') ||
      message.includes('rate') ||
      message.includes('timeout') ||
      message.includes('503') ||
      message.includes('500') ||
      message.includes('unavailable') ||
      message.includes('fetch failed') ||
      message.includes('econnreset') ||
      message.includes('network')
    );
  }

  private async pump() {
    if (this.running) return;
    this.running = true;
    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;
      const wait = Math.max(0, this.minGapMs - (Date.now() - this.lastCallAt));
      if (wait > 0) await sleep(wait);
      this.lastCallAt = Date.now();
      try {
        const value = await job.run();
        job.resolve(value);
      } catch (error) {
        job.reject(error);
      }
    }
    this.running = false;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
