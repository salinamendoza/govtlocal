<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import type { PublicEntry, Kind } from '$lib/types';
  import { queryEntries, getMeta } from '$lib/client/idb';
  import { onSnapshotUpdated, syncSnapshot } from '$lib/client/syncManager';
  import { connection } from '$lib/client/connection.svelte';
  import CategoryChips from './CategoryChips.svelte';
  import SearchInput from './SearchInput.svelte';
  import EntryCard from './EntryCard.svelte';

  interface Props {
    kind: Kind;
    categories: readonly string[];
    initialItems: PublicEntry[];
  }
  let { kind, categories, initialItems }: Props = $props();

  let items = $state<PublicEntry[]>(initialItems);
  let usingLocal = $state(false);
  let error = $state<string | null>(null);

  const q = $derived($page.url.searchParams.get('q') ?? '');
  const cat = $derived($page.url.searchParams.get('cat'));

  async function refreshFromLocal() {
    try {
      const { items: local } = await queryEntries({
        kind,
        category: cat,
        query: q
      });
      // Only swap to local if we actually have a mirror — otherwise keep
      // the SSR list so first-visit users still see results.
      const hasLocal = (await getMeta('snapshot_version')) != null;
      if (hasLocal) {
        items = local;
        usingLocal = true;
      }
      error = null;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Local read failed';
    }
  }

  // Re-query IDB whenever the filter changes.
  $effect(() => {
    const _q = q;
    const _cat = cat;
    void refreshFromLocal();
  });

  onMount(() => {
    // Subscribe to snapshot updates so the list re-renders after a sync.
    const off = onSnapshotUpdated(() => {
      void refreshFromLocal();
    });
    // Fire an initial local read (handles offline / cached-shell case)
    // and kick a fresh snapshot fetch in the background.
    void refreshFromLocal();
    void syncSnapshot();
    return off;
  });
</script>

<div class="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6">
  <SearchInput value={q} placeholder="Search by keyword, place, or need…" />
  <CategoryChips {categories} selected={cat} />

  {#if !connection.online}
    <p
      class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
    >
      Offline. Showing the most recent data saved to this device.
    </p>
  {/if}

  {#if error}
    <p class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {error}
    </p>
  {/if}

  {#if items.length === 0}
    <div class="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-12 text-center">
      <p class="text-sm font-medium text-slate-700">No entries match your filters.</p>
      <p class="mt-1 text-sm text-slate-500">Try clearing the search or category.</p>
    </div>
  {:else}
    <ul class="grid grid-cols-1 gap-4 md:grid-cols-2">
      {#each items as entry (entry.id)}
        <li><EntryCard {entry} /></li>
      {/each}
    </ul>
  {/if}
</div>
