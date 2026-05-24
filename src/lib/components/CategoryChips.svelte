<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  interface Props {
    categories: readonly string[];
    selected: string | null;
  }
  let { categories, selected }: Props = $props();

  function select(cat: string | null) {
    const url = new URL($page.url);
    if (cat == null) url.searchParams.delete('cat');
    else url.searchParams.set('cat', cat);
    goto(url, { replaceState: true, keepFocus: true, noScroll: true });
  }
</script>

<div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Filter by category">
  <button
    type="button"
    role="radio"
    aria-checked={selected === null}
    onclick={() => select(null)}
    class="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors {selected === null
      ? 'border-ink bg-ink text-white'
      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}"
  >
    All
  </button>
  {#each categories as cat (cat)}
    <button
      type="button"
      role="radio"
      aria-checked={selected === cat}
      onclick={() => select(cat)}
      class="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors {selected === cat
        ? 'border-ink bg-ink text-white'
        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}"
    >
      {cat}
    </button>
  {/each}
</div>
