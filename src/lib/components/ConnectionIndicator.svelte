<script lang="ts">
  import { connection } from '$lib/client/connection.svelte';

  const dotClass = $derived(
    {
      green: 'bg-emerald-500',
      yellow: 'bg-amber-500',
      gray: 'bg-slate-400'
    }[connection.status]
  );

  const label = $derived(
    {
      green: 'Live — data is current',
      yellow: connection.online ? 'Online — checking for updates' : 'Online — data may be stale',
      gray: 'Offline — showing saved data'
    }[connection.status]
  );

  const ageMin = $derived(
    connection.lastSyncAt
      ? Math.max(0, Math.floor((Date.now() / 1000 - connection.lastSyncAt) / 60))
      : null
  );
</script>

<div
  class="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600"
  title={label}
  aria-live="polite"
>
  <span class="relative flex h-2 w-2">
    <span class="absolute inline-flex h-full w-full rounded-full {dotClass} opacity-75"></span>
    <span class="relative inline-flex h-2 w-2 rounded-full {dotClass}"></span>
  </span>
  <span class="hidden sm:inline">{label}</span>
  <span class="sm:hidden capitalize">{connection.status === 'gray' ? 'Offline' : connection.status === 'yellow' ? 'Stale' : 'Live'}</span>
  {#if ageMin != null && connection.status !== 'gray'}
    <span class="text-slate-400">· {ageMin}m</span>
  {/if}
</div>
