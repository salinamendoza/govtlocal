<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import {
    USER_CAPACITY_STATUSES,
    CAPACITY_LABEL,
    CAPACITY_CHIP,
    type CapacityStatus
  } from '$lib/capacity';
  let { data, form }: { data: PageData; form: ActionData } = $props();

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

  // Re-fill the textarea on validation failure so the paste isn't lost.
  const qaError = $derived(form?.quickAdd?.error);
  const qaAdded = $derived(form?.quickAdd?.added ?? []);
  const qaFailures = $derived(form?.quickAdd?.failures ?? []);
  const qaIsBulk = $derived(form?.quickAdd?.bulk === true);
  const qaText = $derived(form?.quickAdd?.text ?? '');
  const qaKind = $derived(form?.quickAdd?.kind ?? 'resource');
</script>

<svelte:head><title>Admin · Queue</title></svelte:head>

<section class="mb-6 rounded-lg border border-slate-200 bg-white p-4">
  <h2 class="text-base font-semibold text-ink">Quick add</h2>
  <p class="mt-0.5 text-xs text-slate-500">
    Paste any sentence or two — name, address, hours, phone, anything. AI fills
    in the form and drops it in the queue as pending.
  </p>

  {#if qaAdded.length === 1 && !qaIsBulk}
    <p class="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
      Added "{qaAdded[0].title}" as pending.
      <a href={`/admin/${qaAdded[0].id}`} class="font-medium underline">Edit</a>
      or scroll down to approve.
    </p>
  {:else if qaAdded.length > 0}
    <div class="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
      <p class="font-medium">Added {qaAdded.length} {qaAdded.length === 1 ? 'entry' : 'entries'} as pending:</p>
      <ul class="mt-1 list-disc pl-5">
        {#each qaAdded as a (a.id)}
          <li><a href={`/admin/${a.id}`} class="underline">{a.title}</a></li>
        {/each}
      </ul>
    </div>
  {/if}
  {#if qaFailures.length > 0}
    <div class="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <p class="font-medium">{qaFailures.length} entr{qaFailures.length === 1 ? 'y' : 'ies'} couldn't be parsed:</p>
      <ul class="mt-1 list-disc pl-5">
        {#each qaFailures as f}
          <li><span class="font-mono text-xs">{f.source}</span> — {f.error}</li>
        {/each}
      </ul>
    </div>
  {/if}
  {#if qaError}
    <p class="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {qaError}
    </p>
  {/if}

  <form method="POST" action="?/quickAdd" class="mt-3 flex flex-col gap-3">
    <div class="flex gap-2">
      <label class="flex flex-1 cursor-pointer items-center justify-center rounded-md border border-slate-200 px-3 py-2 text-sm font-medium {qaKind === 'resource' ? 'bg-ink text-white border-ink' : 'bg-white text-slate-700'}">
        <input type="radio" name="kind" value="resource" checked={qaKind === 'resource'} class="sr-only" />
        Resource
      </label>
      <label class="flex flex-1 cursor-pointer items-center justify-center rounded-md border border-slate-200 px-3 py-2 text-sm font-medium {qaKind === 'donation' ? 'bg-ink text-white border-ink' : 'bg-white text-slate-700'}">
        <input type="radio" name="kind" value="donation" checked={qaKind === 'donation'} class="sr-only" />
        Donation
      </label>
    </div>
    <textarea
      name="text"
      required
      rows="4"
      maxlength="4000"
      placeholder={`One entry: "Westside Community Center has a shower trailer open 8a-8p at 1234 Magnolia. Call (714) 555-0123."\n\nOr a list (bullets or blank lines) and each becomes its own entry:\nHotlines:\n- Garden Grove 24-hour call center: (714) 741-5444\n- OC public info hotline: (714) 628-7085`}
      class="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
    >{qaText}</textarea>
    <button
      type="submit"
      class="rounded-md bg-ink px-4 py-3 text-base font-medium text-white hover:bg-slate-800"
    >
      Parse & add to queue
    </button>
  </form>
</section>

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
        <th class="px-3 py-2">Capacity</th>
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
          <td class="px-3 py-2 text-xs">
            <form method="POST" action="?/setCapacity" class="inline-flex items-center gap-2">
              <input type="hidden" name="id" value={e.id} />
              <span class="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold {CAPACITY_CHIP[e.capacity_status]}">
                {CAPACITY_LABEL[e.capacity_status]}
              </span>
              <select
                name="capacity_status"
                onchange={(ev) => (ev.currentTarget.form as HTMLFormElement).requestSubmit()}
                class="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs"
                aria-label="Set capacity"
              >
                {#each USER_CAPACITY_STATUSES as cap (cap)}
                  <option value={cap} selected={e.capacity_status === cap}>{CAPACITY_LABEL[cap as CapacityStatus]}</option>
                {/each}
              </select>
            </form>
          </td>
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
        <tr><td colspan="7" class="px-3 py-8 text-center text-sm text-slate-500">Nothing here.</td></tr>
      {/each}
    </tbody>
  </table>
</div>
