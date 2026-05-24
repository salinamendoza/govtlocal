<script lang="ts">
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();

  function fmt(t: number) {
    return new Date(t * 1000).toLocaleString();
  }

  const statusFilters: { value: string; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'archived', label: 'Archived' },
    { value: 'all', label: 'All' }
  ];

  function url(params: Record<string, string>) {
    const p = new URLSearchParams(params);
    return `/admin?${p.toString()}`;
  }
</script>

<svelte:head><title>Admin · Queue</title></svelte:head>

<h1 class="text-xl font-semibold text-ink">Submission queue</h1>

<form method="GET" class="mt-4 flex flex-wrap items-end gap-3">
  <label class="flex flex-col gap-1 text-xs font-medium text-slate-600">
    Kind
    <select name="kind" class="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm">
      <option value="resource" selected={data.kind === 'resource'}>Resource</option>
      <option value="donation" selected={data.kind === 'donation'}>Donation</option>
    </select>
  </label>
  <label class="flex flex-col gap-1 text-xs font-medium text-slate-600">
    Status
    <select name="status" class="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm">
      {#each statusFilters as f (f.value)}
        <option value={f.value} selected={data.status === f.value}>{f.label}</option>
      {/each}
    </select>
  </label>
  <label class="flex flex-col gap-1 text-xs font-medium text-slate-600">
    Search
    <input
      type="search"
      name="q"
      value={data.query}
      class="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
    />
  </label>
  <button class="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-white">Filter</button>
</form>

<div class="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
  <table class="w-full text-sm">
    <thead class="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
      <tr>
        <th class="px-3 py-2">Title</th>
        <th class="px-3 py-2">Category</th>
        <th class="px-3 py-2">Location</th>
        <th class="px-3 py-2">Submitted</th>
        <th class="px-3 py-2">Status</th>
        <th class="px-3 py-2 text-right">Actions</th>
      </tr>
    </thead>
    <tbody>
      {#each data.items as e (e.id)}
        <tr class="border-t border-slate-100 align-top">
          <td class="max-w-xs px-3 py-2">
            <a href={`/admin/${e.id}`} class="font-medium text-ink hover:underline">
              {e.title}
            </a>
            <p class="mt-1 line-clamp-2 text-xs text-slate-500">{e.description}</p>
          </td>
          <td class="px-3 py-2 text-xs text-slate-600">{e.category}</td>
          <td class="px-3 py-2 text-xs text-slate-600">
            {[e.city, e.zip].filter(Boolean).join(' · ') || '—'}
          </td>
          <td class="whitespace-nowrap px-3 py-2 text-xs text-slate-500">{fmt(e.created_at)}</td>
          <td class="px-3 py-2 text-xs">
            <span class="rounded bg-slate-100 px-2 py-0.5 font-medium">{e.status}</span>
          </td>
          <td class="px-3 py-2 text-right">
            <div class="inline-flex flex-wrap justify-end gap-1">
              {#if e.status !== 'approved'}
                <form method="POST" action="?/approve" class="inline">
                  <input type="hidden" name="id" value={e.id} />
                  <button class="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700">Approve</button>
                </form>
              {/if}
              {#if e.status !== 'rejected'}
                <form method="POST" action="?/reject" class="inline">
                  <input type="hidden" name="id" value={e.id} />
                  <button class="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-slate-300">Reject</button>
                </form>
              {/if}
              {#if e.status === 'approved'}
                <form method="POST" action="?/archive" class="inline">
                  <input type="hidden" name="id" value={e.id} />
                  <button class="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-slate-300">Archive</button>
                </form>
              {/if}
              <a href={`/admin/${e.id}`} class="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-slate-300">Edit</a>
            </div>
          </td>
        </tr>
      {:else}
        <tr><td colspan="6" class="px-3 py-8 text-center text-sm text-slate-500">Nothing here.</td></tr>
      {/each}
    </tbody>
  </table>
</div>
