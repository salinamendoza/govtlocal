<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import { RESOURCE_CATEGORIES, DONATION_CATEGORIES } from '$lib/categories';
  import { USER_CAPACITY_STATUSES, CAPACITY_LABEL } from '$lib/capacity';
  import { SERVICE_TAGS } from '$lib/services';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const e = $derived(data.entry);
  const categories = $derived(e.kind === 'donation' ? DONATION_CATEGORIES : RESOURCE_CATEGORIES);
  const statuses = ['pending', 'approved', 'rejected', 'archived'] as const;
  const serviceSet = $derived(new Set<string>(e.services));

  function fmt(t: number | null) {
    return t ? new Date(t * 1000).toLocaleString() : '—';
  }
</script>

<svelte:head><title>Admin · Edit entry</title></svelte:head>

<div class="flex items-center justify-between">
  <h1 class="text-xl font-semibold text-ink">Edit entry</h1>
  <a href="/admin" class="text-sm text-slate-600 hover:underline">← Back to queue</a>
</div>

<dl class="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-slate-500 md:grid-cols-3">
  <div><dt class="font-semibold">ID</dt><dd class="font-mono">{e.id}</dd></div>
  <div><dt class="font-semibold">Kind</dt><dd>{e.kind}</dd></div>
  <div><dt class="font-semibold">Created</dt><dd>{fmt(e.created_at)}</dd></div>
</dl>

{#if form?.saved}
  <p class="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Saved.</p>
{/if}
{#if form?.error}
  <p class="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{form.error}</p>
{/if}

<form method="POST" action="?/save" class="mt-4 flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5">
  <label class="text-sm">
    <span class="mb-1 block font-medium text-ink">Title</span>
    <input name="title" required maxlength="160" value={e.title} class="w-full rounded-md border border-slate-200 px-3 py-2" />
  </label>
  <label class="text-sm">
    <span class="mb-1 block font-medium text-ink">Description</span>
    <textarea name="description" required maxlength="2000" rows="4" class="w-full rounded-md border border-slate-200 px-3 py-2">{e.description}</textarea>
  </label>
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <label class="text-sm">
      <span class="mb-1 block font-medium text-ink">Category</span>
      <select name="category" class="w-full rounded-md border border-slate-200 px-3 py-2">
        {#each categories as c (c)}
          <option value={c} selected={e.category === c}>{c}</option>
        {/each}
      </select>
    </label>
    <label class="text-sm">
      <span class="mb-1 block font-medium text-ink">Status</span>
      <select name="status" class="w-full rounded-md border border-slate-200 px-3 py-2">
        {#each statuses as s (s)}
          <option value={s} selected={e.status === s}>{s}</option>
        {/each}
      </select>
    </label>
    <label class="text-sm">
      <span class="mb-1 block font-medium text-ink">City</span>
      <input name="city" maxlength="80" value={e.city ?? ''} class="w-full rounded-md border border-slate-200 px-3 py-2" />
    </label>
    <label class="text-sm">
      <span class="mb-1 block font-medium text-ink">ZIP</span>
      <input name="zip" maxlength="16" value={e.zip ?? ''} class="w-full rounded-md border border-slate-200 px-3 py-2" />
    </label>
    <label class="text-sm">
      <span class="mb-1 block font-medium text-ink">Capacity</span>
      <select name="capacity_status" class="w-full rounded-md border border-slate-200 px-3 py-2">
        {#each USER_CAPACITY_STATUSES as cap (cap)}
          <option value={cap} selected={e.capacity_status === cap}>{CAPACITY_LABEL[cap]}</option>
        {/each}
        {#if e.capacity_status === 'unknown'}
          <option value="unknown" selected>Unknown (default)</option>
        {/if}
      </select>
    </label>
  </div>

  <fieldset>
    <legend class="mb-2 text-sm font-medium text-ink">Services available</legend>
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {#each SERVICE_TAGS as tag (tag)}
        <label class="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:border-slate-300 has-[:checked]:border-ink has-[:checked]:bg-slate-50">
          <input
            type="checkbox"
            name="services"
            value={tag}
            checked={serviceSet.has(tag)}
            class="h-4 w-4 rounded border-slate-300"
          />
          <span>{tag}</span>
        </label>
      {/each}
    </div>
  </fieldset>

  <label class="text-sm">
    <span class="mb-1 block font-medium text-ink">Address</span>
    <input name="address" maxlength="200" value={e.address ?? ''} class="w-full rounded-md border border-slate-200 px-3 py-2" />
  </label>
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <label class="text-sm">
      <span class="mb-1 block font-medium text-ink">Phone</span>
      <input name="phone" maxlength="40" value={e.phone ?? ''} class="w-full rounded-md border border-slate-200 px-3 py-2" />
    </label>
    <label class="text-sm">
      <span class="mb-1 block font-medium text-ink">URL</span>
      <input name="url" type="url" maxlength="500" value={e.url ?? ''} class="w-full rounded-md border border-slate-200 px-3 py-2" />
    </label>
    <label class="text-sm">
      <span class="mb-1 block font-medium text-ink">Contact name</span>
      <input name="contact_name" maxlength="120" value={e.contact_name ?? ''} class="w-full rounded-md border border-slate-200 px-3 py-2" />
    </label>
    <label class="text-sm">
      <span class="mb-1 block font-medium text-ink">Contact email</span>
      <input name="contact_email" type="email" maxlength="200" value={e.contact_email ?? ''} class="w-full rounded-md border border-slate-200 px-3 py-2" />
    </label>
  </div>
  <div class="flex justify-between gap-3">
    <button type="submit" class="rounded-md bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">Save</button>
    <button
      type="submit"
      formaction="?/delete"
      formnovalidate
      onclick={(ev) => { if (!confirm('Permanently delete this entry?')) ev.preventDefault(); }}
      class="rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
    >
      Delete
    </button>
  </div>
</form>
