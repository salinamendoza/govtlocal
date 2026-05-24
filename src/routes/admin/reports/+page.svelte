<script lang="ts">
  import type { PageData } from './$types';
  import { REPORT_STATUSES } from '$lib/reportTypes';
  let { data }: { data: PageData } = $props();
  function fmt(t: number) { return new Date(t * 1000).toLocaleString(); }

  const filters = ['new', 'triaged', 'resolved', 'dismissed', 'all'];
</script>

<svelte:head><title>Admin · Reports inbox</title></svelte:head>

<h1 class="text-xl font-semibold text-ink">Reports inbox</h1>
<p class="mt-1 text-sm text-slate-600">
  Anonymous resident reports submitted via the outbox. Triage and resolve as needed.
</p>

<form method="GET" class="mt-4 flex flex-wrap gap-2">
  {#each filters as f (f)}
    <a
      href={`/admin/reports?status=${f}`}
      class="rounded-md px-3 py-1.5 text-xs font-medium {data.status === f
        ? 'bg-ink text-white'
        : 'border border-slate-200 bg-white text-slate-700'}"
    >{f}</a>
  {/each}
</form>

<div class="mt-4 flex flex-col gap-3">
  {#each data.items as r (r.id)}
    <article class="rounded-lg border border-slate-200 bg-white p-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium">{r.type}</span>
          <span class="rounded bg-slate-100 px-2 py-0.5 text-xs">{r.status}</span>
          <span class="text-xs text-slate-500">{fmt(r.received_at)}</span>
        </div>
        <form method="POST" action="?/setStatus" class="flex items-center gap-2">
          <input type="hidden" name="id" value={r.id} />
          <select name="status" class="rounded-md border border-slate-200 px-2 py-1 text-xs">
            {#each REPORT_STATUSES as s (s)}
              <option value={s} selected={s === r.status}>{s}</option>
            {/each}
          </select>
          <button class="rounded-md bg-ink px-2 py-1 text-xs font-medium text-white">Update</button>
        </form>
      </div>
      <pre class="mt-3 max-w-full overflow-x-auto rounded bg-slate-50 p-3 text-xs">{JSON.stringify(r.payload, null, 2)}</pre>
      <p class="mt-1 font-mono text-[10px] text-slate-400">id {r.id}</p>
    </article>
  {:else}
    <p class="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-12 text-center text-sm text-slate-500">
      No reports.
    </p>
  {/each}
</div>
