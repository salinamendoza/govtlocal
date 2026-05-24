import type { D1Database, KVNamespace } from '@cloudflare/workers-types';

declare global {
  namespace App {
    interface Error {
      message: string;
    }
    interface Locals {
      adminEmail?: string;
    }
    interface PageData {}
    interface PageState {}
    interface Platform {
      env: {
        DB: D1Database;
        RATELIMIT: KVNamespace;
        TURNSTILE_SECRET_KEY?: string;
      };
      context: {
        waitUntil(promise: Promise<unknown>): void;
      };
      caches: CacheStorage & { default: Cache };
    }
  }
}

export {};
