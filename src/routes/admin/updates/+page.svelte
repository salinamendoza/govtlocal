<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import { UPDATE_SEVERITIES } from '$lib/server/updates';
  let { data, form }: { data: PageData; form: ActionData } = $props();
  function fmt(t: number) { return new Date(t * 1000).toLocaleString(); }
</script>

<svelte:head><title>Admin · Updates</title></svelte:head>

<h1 class="text-xl font-semibold text-ink">Updates</h1>
<p class="mt-1 text-sm text-slate-600">
  Headlines pushed to every client in the next snapshot. Use sparingly — these are interruptive.
</p>

{#if form?.created}
  <p class="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Posted.</p>
{/if}
{#if form?.error}
  <p class="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{form.error}</p>
{/if}

<form method="POST" action="?/create" class="mt-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5">
  <label class="text-sm">
    <span class="mb-1 block font-medium text-ink">Headline</span>
    <input name="headline" required maxlength="200" class="w-full rounded-md border border-slate-200 px-3 py-2" />
  </label>
  <label class="text-sm">
    <span class="mb-1 block font-medium text-ink">Body (optional)</span>
    <textarea name="body" maxlength="2000" rows="3" class="w-full rounded-md border border-slate-200 px-3 py-2"></textarea>
  </label>
  <label class="text-sm">
    <span class="mb-1 block font-medium text-ink">Severity</span>
    <select name="severity" class="rounded-md border border-slate-200 px-3 py-2">
      {#each UPDATE_SEVERITIES as s (s)}<option value={s}>{s}</option>{/each}
    </select>
  </label>
  <div><button class="rounded-md bg-ink px-4 py-2 text-sm font-medium text-white">Post update</button></div>
</form>

<h2 class="mt-8 text-sm font-semibold uppercase tracking-wider text-slate-500">Recent updates</h2>
<div class="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-white">
  <table class="w-full text-sm">
    <thead class="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
      <tr><th class="px-3 py-2">Headline</th><th class="px-3 py-2">Severity</th><th class="px-3 py-2">Posted</th><th class="px-3 py-2">Status</th><th class="px-3 py-2 text-right">Action</th></tr>
    </thead>
    <tbody>
      {#each data.items as u (u.id)}
        <tr class="border-t border-slate-100 align-top">
          <td class="px-3 py-2">
            <p class="font-medium">{u.headline}</p>
            {#if u.body}<p class="mt-1 text-xs text-slate-500">{u.body}</p>{/if}
          </td>
          <td class="px-3 py-2 text-xs">{u.severity}</td>
          <td class="whitespace-nowrap px-3 py-2 text-xs text-slate-500">{fmt(u.posted_at)}</td>
          <td class="px-3 py-2 text-xs">{u.archived_at ? 'archived' : 'live'}</td>
          <td class="px-3 py-2 text-right">
            <form method="POST" action={u.archived_at ? '?/unarchive' : '?/archive'} class="inline">
              <input type="hidden" name="id" value={u.id} />
              <button class="rounded border border-slate-200 bg-white px-2 py-1 text-xs">
                {u.archived_at ? 'Unarchive' : 'Archive'}
              </button>
            </form>
          </td>
        </tr>
      {:else}
        <tr><td colspan="5" class="px-3 py-8 text-center text-sm text-slate-500">No updates posted.</td></tr>
      {/each}
    </tbody>
  </table>
</div>
