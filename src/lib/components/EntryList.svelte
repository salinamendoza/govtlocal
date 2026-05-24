<script lang="ts">
  import { page } from '$app/stores';
  import type { PublicEntry, Kind } from '$lib/types';
  import * as cache from '$lib/client/entryCache';
  import CategoryChips from './CategoryChips.svelte';
  import SearchInput from './SearchInput.svelte';
  import EntryCard from './EntryCard.svelte';

  interface Props {
    kind: Kind;
    categories: readonly string[];
    initialItems: PublicEntry[];
    initialNextCursor: number | null;
  }
  let { kind, categories, initialItems, initialNextCursor }: Props = $props();

  let items = $state<PublicEntry[]>(initialItems);
  let nextCursor = $state<number | null>(initialNextCursor);
  let loading = $state(false);
  let revalidating = $state(false);
  let error = $state<string | null>(null);

  const q = $derived($page.url.searchParams.get('q') ?? '');
  const cat = $derived($page.url.searchParams.get('cat'));

  // Seed the cache with whatever the server rendered so we don't immediately
  // refetch the initial filter on mount.
  let isInitial = true;
  $effect(() => {
    const _q = q;
    const _cat = cat;
    if (isInitial) {
      isInitial = false;
      cache.set(cache.makeKey(kind, _cat, _q), {
        items: initialItems,
        nextCursor: initialNextCursor,
        etag: null,
        fetchedAt: Date.now()
      });
      return;
    }
    void load(_q, _cat);
  });

  function buildUrl(query: string, category: string | null, cursor?: number | null) {
    const url = new URL('/api/entries', window.location.origin);
    url.searchParams.set('kind', kind);
    if (query) url.searchParams.set('q', query);
    if (category) url.searchParams.set('cat', category);
    if (cursor != null) url.searchParams.set('cursor', String(cursor));
    return url;
  }

  /**
   * Stale-while-revalidate:
   * 1. If we have a memoized page for this filter, paint it immediately.
   *    No network, no spinner — instant on crowded wifi.
   * 2. Then send `If-None-Match` to confirm. 304 → keep cached data.
   *    200 → swap in the new payload and update the cache.
   */
  async function load(query: string, category: string | null) {
    const key = cache.makeKey(kind, category, query);
    const cached = cache.get(key);

    if (cached) {
      items = cached.items;
      nextCursor = cached.nextCursor;
      loading = false;
      revalidating = true;
    } else {
      loading = true;
      revalidating = false;
    }
    error = null;

    try {
      const headers: HeadersInit = { accept: 'application/json' };
      if (cached?.etag) headers['if-none-match'] = cached.etag;

      const res = await fetch(buildUrl(query, category), { headers });

      if (res.status === 304 && cached) {
        cache.set(key, { ...cached, fetchedAt: Date.now() });
        return;
      }
      if (!res.ok) throw new Error(`Search failed (${res.status})`);

      const data = (await res.json()) as {
        items: PublicEntry[];
        nextCursor: number | null;
      };
      const etag = res.headers.get('etag');
      items = data.items;
      nextCursor = data.nextCursor;
      cache.set(key, { ...data, etag, fetchedAt: Date.now() });
    } catch (e) {
      error = e instanceof Error ? e.message : 'Search failed';
    } finally {
      loading = false;
      revalidating = false;
    }
  }

  async function loadMore() {
    if (nextCursor == null || loading) return;
    loading = true;
    try {
      const res = await fetch(buildUrl(q, cat, nextCursor));
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const data = (await res.json()) as {
        items: PublicEntry[];
        nextCursor: number | null;
      };
      items = [...items, ...data.items];
      nextCursor = data.nextCursor;
      // Note: we don't memoize paginated tails — the cache is for the
      // first page of each filter, where snap-back matters most.
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed';
    } finally {
      loading = false;
    }
  }
</script>

<div class="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6">
  <SearchInput value={q} placeholder="Search by keyword, place, or need…" />
  <CategoryChips {categories} selected={cat} />

  {#if error}
    <p class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {error}
    </p>
  {/if}

  {#if items.length === 0 && !loading}
    <div class="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-12 text-center">
      <p class="text-sm font-medium text-slate-700">No entries match your filters yet.</p>
      <p class="mt-1 text-sm text-slate-500">Try clearing the search or category.</p>
    </div>
  {:else}
    <ul class="grid grid-cols-1 gap-4 md:grid-cols-2" aria-busy={loading || revalidating}>
      {#each items as entry (entry.id)}
        <li><EntryCard {entry} /></li>
      {/each}
    </ul>
  {/if}

  {#if revalidating}
    <p class="text-center text-xs text-slate-400" aria-live="polite">Checking for updates…</p>
  {/if}

  {#if nextCursor != null}
    <div class="flex justify-center pt-2">
      <button
        type="button"
        onclick={loadMore}
        disabled={loading}
        class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 disabled:opacity-50"
      >
        {loading ? 'Loading…' : 'Load more'}
      </button>
    </div>
  {/if}
</div>
