import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

type CacheEntry = {
  value: unknown;
  expiresAt: number;
};

@Injectable()
export class AiCacheService {
  private readonly logger = new Logger(AiCacheService.name);
  private readonly store = new Map<string, CacheEntry>();
  /** In-flight requests — prevents duplicate concurrent Gemini calls. */
  private readonly inflight = new Map<string, Promise<unknown>>();
  private readonly maxEntries = 200;

  key(namespace: string, payload: unknown): string {
    const hash = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex')
      .slice(0, 40);
    return `${namespace}:${hash}`;
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set(key: string, value: unknown, ttlMs: number) {
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /** Deduplicate concurrent identical requests. */
  async once<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) {
      this.logger.debug(`Deduped in-flight AI request: ${key}`);
      return existing as Promise<T>;
    }
    const promise = factory().finally(() => {
      this.inflight.delete(key);
    });
    this.inflight.set(key, promise);
    return promise;
  }
}
