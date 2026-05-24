<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import { HAZARD_SEVERITIES } from '$lib/hazards';
  let { data, form }: { data: PageData; form: ActionData } = $props();
  function fmt(t: number) { return new Date(t * 1000).toLocaleString(); }
</script>

<svelte:head><title>Admin · Hazard zones</title></svelte:head>

<h1 class="text-xl font-semibold text-ink">Hazard zones</h1>
<p class="mt-1 text-sm text-slate-600">
  GeoJSON polygons surfaced to the client snapshot for evacuation / shelter messaging.
</p>

{#if form?.created}
  <p class="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Created.</p>
{/if}
{#if form?.error}
  <p class="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{form.error}</p>
{/if}

<form method="POST" action="?/create" class="mt-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5">
  <label class="text-sm">
    <span class="mb-1 block font-medium text-ink">Severity</span>
    <select name="severity" class="rounded-md border border-slate-200 px-3 py-2">
      {#each HAZARD_SEVERITIES as s (s)}<option value={s}>{s}</option>{/each}
    </select>
  </label>
  <label class="text-sm">
    <span class="mb-1 block font-medium text-ink">Message (optional, shown to residents)</span>
    <input name="message" maxlength="500" class="w-full rounded-md border border-slate-200 px-3 py-2" />
  </label>
  <label class="text-sm">
    <span class="mb-1 block font-medium text-ink">GeoJSON</span>
    <textarea name="geojson" required rows="8" placeholder={'{ "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[...]] } }'} class="w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-xs"></textarea>
  </label>
  <div><button class="rounded-md bg-ink px-4 py-2 text-sm font-medium text-white">Create zone</button></div>
</form>

<h2 class="mt-8 text-sm font-semibold uppercase tracking-wider text-slate-500">Zones</h2>
<div class="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-white">
  <table class="w-full text-sm">
    <thead class="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
      <tr><th class="px-3 py-2">Severity</th><th class="px-3 py-2">Message</th><th class="px-3 py-2">Updated</th><th class="px-3 py-2">Status</th><th class="px-3 py-2 text-right">Action</th></tr>
    </thead>
    <tbody>
      {#each data.items as z (z.id)}
        <tr class="border-t border-slate-100 align-top">
          <td class="px-3 py-2 text-xs font-medium">{z.severity}</td>
          <td class="px-3 py-2 text-xs">{z.message ?? '—'}</td>
          <td class="whitespace-nowrap px-3 py-2 text-xs text-slate-500">{fmt(z.updated_at)}</td>
          <td class="px-3 py-2 text-xs">{z.archived_at ? 'archived' : 'live'}</td>
          <td class="px-3 py-2 text-right">
            <form method="POST" action={z.archived_at ? '?/unarchive' : '?/archive'} class="inline">
              <input type="hidden" name="id" value={z.id} />
              <button class="rounded border border-slate-200 bg-white px-2 py-1 text-xs">
                {z.archived_at ? 'Unarchive' : 'Archive'}
              </button>
            </form>
          </td>
        </tr>
      {:else}
        <tr><td colspan="5" class="px-3 py-8 text-center text-sm text-slate-500">No hazard zones.</td></tr>
      {/each}
    </tbody>
  </table>
</div>
