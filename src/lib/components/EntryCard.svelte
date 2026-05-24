<script lang="ts">
  import type { PublicEntry } from '$lib/types';
  import { CAPACITY_CHIP, CAPACITY_LABEL } from '$lib/capacity';

  interface Props {
    entry: PublicEntry;
  }
  let { entry }: Props = $props();

  /** Single line: city · zip (used only if no street address). */
  const cityZip = $derived(
    [entry.city, entry.zip].filter((x): x is string => Boolean(x)).join(' · ')
  );

  const hasStreet = $derived(Boolean(entry.address));

  /** Best display string for the address line. Prefers full street. */
  const displayAddress = $derived(
    hasStreet
      ? [entry.address, entry.city, entry.zip].filter((x): x is string => Boolean(x)).join(', ')
      : cityZip
  );

  /**
   * Maps deep link — only when we actually have a street address.
   * Searching maps for just "Garden Grove" centers on the whole city,
   * useless to a user looking for a specific site.
   */
  const mapsUrl = $derived(
    hasStreet ? `https://maps.google.com/?q=${encodeURIComponent(displayAddress)}` : null
  );

  const SERVICE_PREVIEW = 4;
  const visibleServices = $derived(entry.services.slice(0, SERVICE_PREVIEW));
  const extraServices = $derived(Math.max(0, entry.services.length - SERVICE_PREVIEW));
  const showCapacity = $derived(entry.capacity_status !== 'unknown');
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

  {#if showCapacity}
    <div>
      <span
        class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold {CAPACITY_CHIP[entry.capacity_status]}"
      >
        {CAPACITY_LABEL[entry.capacity_status]}
      </span>
    </div>
  {/if}

  {#if hasStreet}
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      class="-mx-1 -my-0.5 flex items-start gap-2 rounded-md px-1 py-0.5 text-sm font-medium text-ink hover:bg-slate-50"
    >
      <svg
        class="mt-0.5 h-4 w-4 shrink-0 text-slate-500"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M10 2a6 6 0 016 6c0 4.5-6 10-6 10S4 12.5 4 8a6 6 0 016-6zm0 8a2 2 0 100-4 2 2 0 000 4z" />
      </svg>
      <span class="leading-snug">{displayAddress}</span>
    </a>
  {:else if cityZip}
    <p class="flex items-start gap-2 text-sm text-slate-600">
      <svg
        class="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M10 2a6 6 0 016 6c0 4.5-6 10-6 10S4 12.5 4 8a6 6 0 016-6zm0 8a2 2 0 100-4 2 2 0 000 4z" />
      </svg>
      <span class="leading-snug">{cityZip}</span>
    </p>
  {/if}

  <p class="clamp-3 text-sm leading-relaxed text-slate-700">{entry.description}</p>

  {#if entry.services.length > 0}
    <ul class="flex flex-wrap gap-1.5">
      {#each visibleServices as tag (tag)}
        <li class="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
          {tag}
        </li>
      {/each}
      {#if extraServices > 0}
        <li class="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500">
          +{extraServices} more
        </li>
      {/if}
    </ul>
  {/if}

  {#if entry.phone || entry.url}
    <div class="flex flex-wrap items-center gap-3 pt-1 text-base">
      {#if entry.phone}
        <a
          href="tel:{entry.phone}"
          class="rounded-md bg-slate-100 px-3 py-1.5 font-semibold text-ink hover:bg-slate-200"
        >
          📞 {entry.phone}
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

