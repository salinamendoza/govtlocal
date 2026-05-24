<script lang="ts">
  import type { PublicEntry } from '$lib/types';

  interface Props {
    entry: PublicEntry;
  }
  let { entry }: Props = $props();

  const location = $derived(
    [entry.city, entry.zip].filter((x): x is string => Boolean(x)).join(' · ')
  );
</script>

<article
  class="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
>
  <div class="flex items-start justify-between gap-3">
    <h3 class="text-base font-semibold leading-snug text-ink">{entry.title}</h3>
    <span
      class="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600"
    >
      {entry.category}
    </span>
  </div>

  <p class="clamp-3 text-sm leading-relaxed text-slate-700">{entry.description}</p>

  {#if location}
    <p class="text-xs font-medium uppercase tracking-wide text-slate-500">{location}</p>
  {/if}

  {#if entry.phone || entry.url}
    <div class="flex flex-wrap items-center gap-3 pt-1 text-sm">
      {#if entry.phone}
        <a
          href="tel:{entry.phone}"
          class="font-medium text-ink underline-offset-2 hover:underline"
        >
          {entry.phone}
        </a>
      {/if}
      {#if entry.url}
        <a
          href={entry.url}
          target="_blank"
          rel="noopener noreferrer"
          class="font-medium text-ink underline-offset-2 hover:underline"
        >
          Visit link ↗
        </a>
      {/if}
    </div>
  {/if}
</article>
