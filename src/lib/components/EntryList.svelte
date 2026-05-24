<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import type { PublicEntry, Kind } from '$lib/types';
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
  let error = $state<string | null>(null);
  let isInitial = true;

  const q = $derived($page.url.searchParams.get('q') ?? '');
  const cat = $derived($page.url.searchParams.get('cat'));

  // Refetch whenever q or cat changes. Skip the very first run because
  // SSR has already populated initialItems.
  $effect(() => {
    const _q = q;
    const _cat = cat;
    if (isInitial) {
      isInitial = false;
      return;
    }
    void refetch(_q, _cat);
  });

  async function refetch(query: string, category: string | null) {
    loading = true;
    error = null;
    try {
      const url = new URL('/api/entries', window.location.origin);
      url.searchParams.set('kind', kind);
      if (query) url.searchParams.set('q', query);
      if (category) url.searchParams.set('cat', category);
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const data = (await res.json()) as {
        items: PublicEntry[];
        nextCursor: number | null;
      };
      items = data.items;
      nextCursor = data.nextCursor;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Search failed';
    } finally {
      loading = false;
    }
  }

  async function loadMore() {
    if (nextCursor == null || loading) return;
    loading = true;
    try {
      const url = new URL('/api/entries', window.location.origin);
      url.searchParams.set('kind', kind);
      if (q) url.searchParams.set('q', q);
      if (cat) url.searchParams.set('cat', cat);
      url.searchParams.set('cursor', String(nextCursor));
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const data = (await res.json()) as {
        items: PublicEntry[];
        nextCursor: number | null;
      };
      items = [...items, ...data.items];
      nextCursor = data.nextCursor;
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
    <ul class="grid grid-cols-1 gap-4 md:grid-cols-2" aria-busy={loading}>
      {#each items as entry (entry.id)}
        <li><EntryCard {entry} /></li>
      {/each}
    </ul>
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
