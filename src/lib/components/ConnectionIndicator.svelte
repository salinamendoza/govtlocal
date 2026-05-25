<script lang="ts">
  import { connection } from '$lib/client/connection.svelte';

  const dotClass = $derived(
    {
      green: 'bg-emerald-500',
      yellow: 'bg-amber-500',
      gray: 'bg-slate-400'
    }[connection.status]
  );

  const ageSec = $derived(
    connection.lastSyncAt
      ? Math.max(0, Math.floor(Date.now() / 1000 - connection.lastSyncAt))
      : null
  );

  function humanAge(sec: number | null): string {
    if (sec == null) return 'syncing…';
    if (sec < 30) return 'just now';
    if (sec < 60) return `${sec}s ago`;
    const mins = Math.floor(sec / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  const ageLabel = $derived(humanAge(ageSec));

  const label = $derived(
    connection.online
      ? `Updated ${ageLabel}`
      : `Offline — last update ${ageLabel}`
  );

  const a11yLabel = $derived(
    {
      green: 'Live, data is current',
      yellow: 'Connected, checking for updates',
      gray: 'Offline, showing saved data'
    }[connection.status] + ` — last update ${ageLabel}`
  );
</script>

<div
  class="inline-flex items-center gap-1.5 text-xs text-slate-600 sm:gap-2 sm:rounded-md sm:border sm:border-slate-200 sm:bg-white sm:px-2.5 sm:py-1"
  title={a11yLabel}
  aria-label={a11yLabel}
  aria-live="polite"
>
  <span class="relative flex h-2 w-2">
    <span class="absolute inline-flex h-full w-full rounded-full {dotClass} opacity-75"></span>
    <span class="relative inline-flex h-2 w-2 rounded-full {dotClass}"></span>
  </span>
  <span>{label}</span>
</div>
