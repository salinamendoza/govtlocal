<script lang="ts">
  import { onMount } from 'svelte';
  import { getDB } from '$lib/client/idb';
  import { onSnapshotUpdated } from '$lib/client/syncManager';
  import type { UpdatePost } from '$lib/server/snapshot';

  let updates = $state<UpdatePost[]>([]);
  let zonesPresent = $state(0);

  async function refresh() {
    try {
      const db = await getDB();
      const all = await db.getAllFromIndex('updates', 'by-posted');
      updates = all.sort((a, b) => b.posted_at - a.posted_at).slice(0, 3);
      zonesPresent = await db.count('hazard_zones');
    } catch {
      updates = [];
    }
  }

  onMount(() => {
    void refresh();
    return onSnapshotUpdated(() => void refresh());
  });

  function severityClass(sev: UpdatePost['severity']) {
    switch (sev) {
      case 'critical':
        return 'border-red-300 bg-red-50 text-red-900';
      case 'urgent':
        return 'border-orange-300 bg-orange-50 text-orange-900';
      case 'advisory':
        return 'border-amber-300 bg-amber-50 text-amber-900';
      default:
        return 'border-slate-200 bg-slate-50 text-slate-800';
    }
  }
</script>

{#if updates.length > 0 || zonesPresent > 0}
  <div class="mx-auto max-w-6xl px-4 pt-4">
    {#if zonesPresent > 0}
      <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-red-700">
        {zonesPresent} active hazard zone{zonesPresent === 1 ? '' : 's'} — check official guidance
      </p>
    {/if}
    <ul class="flex flex-col gap-2">
      {#each updates as u (u.id)}
        <li class="rounded-md border px-3 py-2 text-sm {severityClass(u.severity)}">
          <p class="font-semibold">{u.headline}</p>
          {#if u.body}
            <p class="mt-0.5 text-xs opacity-90">{u.body}</p>
          {/if}
        </li>
      {/each}
    </ul>
  </div>
{/if}
