<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { enhance } from '$app/forms';
  import type { PageData, ActionData } from './$types';
  import type { EntryInput, Kind } from '$lib/types';
  import { RESOURCE_CATEGORIES, DONATION_CATEGORIES } from '$lib/categories';
  import {
    USER_CAPACITY_STATUSES,
    CAPACITY_LABEL,
    CAPACITY_CHIP,
    type CapacityStatus
  } from '$lib/capacity';
  import { SERVICE_TAGS } from '$lib/services';
  import { expirationLabel, isExpired } from '$lib/expiration';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  function fmt(t: number) {
    return new Date(t * 1000).toLocaleString();
  }

  const statusFilters: { value: string; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'archived', label: 'Archived' },
    { value: 'expired', label: 'Expired' },
    { value: 'all', label: 'All' }
  ];

  // ─────────────────────────────────────────────────────────────────
  // Quick-add: preview-before-save flow
  //
  // 1. Paste → server action ?/parseQuick → returns ParsedDraft[]
  // 2. Drafts are stored in localStorage so they survive page navigation
  //    (admin can approve other entries below without losing drafts)
  // 3. UI shows ONE draft at a time as an editable form
  // 4. Save (?/commitDraft) creates the entry; on success the draft is
  //    removed and the next one shows
  // 5. Skip removes without saving; Discard all clears them
  // ─────────────────────────────────────────────────────────────────
  interface Draft {
    source: string;
    parsed: EntryInput | null;
    error?: string;
  }
  const DRAFT_KEY = 'qa_drafts_v1';

  let drafts = $state<Draft[]>([]);
  let qaKind = $state<Kind>('resource');
  let qaText = $state<string>('');
  let parseError = $state<string | null>(null);
  let commitErrors = $state<Record<string, string>>({});
  let commitFormError = $state<string | null>(null);

  function loadDrafts() {
    if (!browser) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) drafts = JSON.parse(raw);
    } catch {
      drafts = [];
    }
  }
  function persistDrafts() {
    if (!browser) return;
    if (drafts.length === 0) localStorage.removeItem(DRAFT_KEY);
    else localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
  }

  onMount(loadDrafts);

  // Hydrate from server when parseQuick returns. Use a derived to detect
  // a new server response and write it to state + storage exactly once.
  let lastHandled: unknown = null;
  $effect(() => {
    const r = form?.parseQuick;
    if (!r || r === lastHandled) return;
    lastHandled = r;
    if ('error' in r && r.error) {
      parseError = r.error;
      qaText = r.text ?? '';
      qaKind = (r.kind as Kind) ?? 'resource';
      return;
    }
    if ('drafts' in r && Array.isArray(r.drafts)) {
      // Replace any existing drafts (clearer than appending — if she
      // wants to start fresh, she pastes; if mid-batch she finishes).
      drafts = r.drafts as Draft[];
      qaKind = (r.kind as Kind) ?? 'resource';
      qaText = '';
      parseError = null;
      commitErrors = {};
      commitFormError = null;
      persistDrafts();
    }
  });

  // Same one-shot pattern for commitDraft response.
  let lastCommitHandled: unknown = null;
  $effect(() => {
    const r = form?.commitDraft;
    if (!r || r === lastCommitHandled) return;
    lastCommitHandled = r;
    if ('errors' in r && r.errors) {
      commitErrors = r.errors;
      commitFormError = null;
      return;
    }
    if ('committed' in r && r.committed) {
      // Successful save — pop the current draft, show the next.
      drafts = drafts.slice(1);
      persistDrafts();
      commitErrors = {};
      commitFormError = null;
    }
  });

  function skipCurrent() {
    drafts = drafts.slice(1);
    persistDrafts();
    commitErrors = {};
    commitFormError = null;
  }
  function discardAll() {
    if (drafts.length > 1 && !confirm(`Discard all ${drafts.length} drafts?`)) return;
    drafts = [];
    persistDrafts();
    commitErrors = {};
    commitFormError = null;
  }

  const current = $derived<Draft | null>(drafts[0] ?? null);
  const remaining = $derived(drafts.length);
  const reviewKind = $derived<Kind>(current?.parsed?.kind ?? qaKind);
  const reviewCategories = $derived(
    reviewKind === 'donation' ? DONATION_CATEGORIES : RESOURCE_CATEGORIES
  );

  function fieldErr(name: string) {
    return commitErrors[name];
  }
</script>

<svelte:head><title>Admin · Queue</title></svelte:head>

<!-- ───────────────────────────── Quick add ───────────────────────────── -->
<section class="mb-6 rounded-lg border border-slate-200 bg-white p-4">
  <div class="flex items-center justify-between gap-3">
    <h2 class="text-base font-semibold text-ink">Quick add</h2>
    {#if remaining > 0}
      <span class="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
        Reviewing {remaining > 1 ? `1 of ${remaining}` : '1 draft'}
      </span>
    {/if}
  </div>

  {#if current}
    <!-- ─── Review mode: walk through drafts one at a time ─── -->
    <p class="mt-1 text-xs text-slate-500">
      Check the AI's extraction. Edit anything that's off, then save. Nothing is in the queue until you click Save.
    </p>

    {#if current.error}
      <div class="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        <p class="font-medium">Couldn't parse this one.</p>
        <p class="mt-1 text-xs">{current.error}</p>
        <p class="mt-2 text-xs font-mono whitespace-pre-wrap">{current.source}</p>
        <div class="mt-2 flex gap-2">
          <button
            type="button"
            onclick={skipCurrent}
            class="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs"
          >
            Skip
          </button>
          <button
            type="button"
            onclick={discardAll}
            class="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs"
          >
            Discard all
          </button>
        </div>
      </div>
    {:else if current.parsed}
      <details class="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <summary class="cursor-pointer font-medium">Original paste</summary>
        <p class="mt-2 whitespace-pre-wrap">{current.source}</p>
      </details>

      {#if commitFormError}
        <p class="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {commitFormError}
        </p>
      {/if}

      <form
        method="POST"
        action="?/commitDraft"
        use:enhance
        class="mt-3 flex flex-col gap-4"
      >
        <input type="hidden" name="kind" value={reviewKind} />

        <label class="text-sm">
          <span class="mb-1 block font-medium text-ink">
            Title <span class="text-red-600" aria-hidden="true">*</span>
          </span>
          <input
            name="title"
            required
            maxlength="160"
            value={current.parsed.title}
            class="w-full rounded-md border border-slate-200 px-3 py-2"
          />
          {#if fieldErr('title')}<p class="mt-1 text-xs text-red-700">{fieldErr('title')}</p>{/if}
        </label>

        <label class="text-sm">
          <span class="mb-1 block font-medium text-ink">
            Description <span class="text-red-600" aria-hidden="true">*</span>
            <span class="ml-1 text-xs font-normal text-slate-500">
              (include any promo codes, deadlines, redemption instructions)
            </span>
          </span>
          <textarea
            name="description"
            required
            maxlength="2000"
            rows="4"
            class="w-full rounded-md border border-slate-200 px-3 py-2"
          >{current.parsed.description}</textarea>
          {#if fieldErr('description')}<p class="mt-1 text-xs text-red-700">{fieldErr('description')}</p>{/if}
        </label>

        <label class="text-sm">
          <span class="mb-1 block font-medium text-ink">
            Expires <span class="font-normal text-slate-500">(optional — last day this is valid)</span>
          </span>
          <input
            name="expires_at"
            type="date"
            value={current.parsed.expires_at ?? ''}
            class="w-full rounded-md border border-slate-200 px-3 py-2 md:w-1/2"
          />
        </label>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label class="text-sm">
            <span class="mb-1 block font-medium text-ink">Category</span>
            <select name="category" class="w-full rounded-md border border-slate-200 px-3 py-2">
              {#each reviewCategories as c (c)}
                <option value={c} selected={current.parsed.category === c}>{c}</option>
              {/each}
            </select>
            {#if fieldErr('category')}<p class="mt-1 text-xs text-red-700">{fieldErr('category')}</p>{/if}
          </label>
          <label class="text-sm">
            <span class="mb-1 block font-medium text-ink">Capacity</span>
            <select name="capacity_status" class="w-full rounded-md border border-slate-200 px-3 py-2">
              {#each USER_CAPACITY_STATUSES as cap (cap)}
                <option value={cap} selected={current.parsed.capacity_status === cap}>{CAPACITY_LABEL[cap]}</option>
              {/each}
              {#if current.parsed.capacity_status === 'unknown' || !current.parsed.capacity_status}
                <option value="unknown" selected>Unknown</option>
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
                  checked={current.parsed.services?.includes(tag) ?? false}
                  class="h-4 w-4 rounded border-slate-300"
                />
                <span>{tag}</span>
              </label>
            {/each}
          </div>
        </fieldset>

        <label class="text-sm">
          <span class="mb-1 block font-medium text-ink">Address</span>
          <input
            name="address"
            maxlength="200"
            value={current.parsed.address ?? ''}
            class="w-full rounded-md border border-slate-200 px-3 py-2"
          />
        </label>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label class="text-sm">
            <span class="mb-1 block font-medium text-ink">City</span>
            <input name="city" maxlength="80" value={current.parsed.city ?? ''} class="w-full rounded-md border border-slate-200 px-3 py-2" />
          </label>
          <label class="text-sm">
            <span class="mb-1 block font-medium text-ink">ZIP</span>
            <input name="zip" maxlength="16" value={current.parsed.zip ?? ''} class="w-full rounded-md border border-slate-200 px-3 py-2" />
          </label>
          <label class="text-sm">
            <span class="mb-1 block font-medium text-ink">Phone</span>
            <input name="phone" maxlength="40" value={current.parsed.phone ?? ''} class="w-full rounded-md border border-slate-200 px-3 py-2" />
          </label>
          <label class="text-sm">
            <span class="mb-1 block font-medium text-ink">Link (URL)</span>
            <input name="url" type="url" maxlength="500" value={current.parsed.url ?? ''} class="w-full rounded-md border border-slate-200 px-3 py-2" />
          </label>
          <label class="text-sm">
            <span class="mb-1 block font-medium text-ink">Contact name</span>
            <input name="contact_name" maxlength="120" value={current.parsed.contact_name ?? ''} class="w-full rounded-md border border-slate-200 px-3 py-2" />
          </label>
          <label class="text-sm">
            <span class="mb-1 block font-medium text-ink">Contact email</span>
            <input name="contact_email" type="email" maxlength="200" value={current.parsed.contact_email ?? ''} class="w-full rounded-md border border-slate-200 px-3 py-2" />
          </label>
        </div>

        <div class="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="submit"
            class="flex-1 rounded-md bg-ink px-4 py-3 text-base font-medium text-white hover:bg-slate-800"
          >
            Save to queue
          </button>
          <button
            type="button"
            onclick={skipCurrent}
            class="rounded-md border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-700"
          >
            Skip
          </button>
          <button
            type="button"
            onclick={discardAll}
            class="rounded-md border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-700"
          >
            Discard all
          </button>
        </div>
      </form>
    {/if}
  {:else}
    <!-- ─── Paste mode ─── -->
    <p class="mt-0.5 text-xs text-slate-500">
      Paste anything — name, address, hours, phone, promo codes. AI extracts the fields and you review before it lands in the queue.
    </p>

    {#if parseError}
      <p class="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {parseError}
      </p>
    {/if}

    <form method="POST" action="?/parseQuick" class="mt-3 flex flex-col gap-3">
      <div class="flex gap-2">
        <label class="flex flex-1 cursor-pointer items-center justify-center rounded-md border border-slate-200 px-3 py-2 text-sm font-medium {qaKind === 'resource' ? 'bg-ink text-white border-ink' : 'bg-white text-slate-700'}">
          <input type="radio" name="kind" value="resource" checked={qaKind === 'resource'} onchange={() => (qaKind = 'resource')} class="sr-only" />
          Resource
        </label>
        <label class="flex flex-1 cursor-pointer items-center justify-center rounded-md border border-slate-200 px-3 py-2 text-sm font-medium {qaKind === 'donation' ? 'bg-ink text-white border-ink' : 'bg-white text-slate-700'}">
          <input type="radio" name="kind" value="donation" checked={qaKind === 'donation'} onchange={() => (qaKind = 'donation')} class="sr-only" />
          Donation
        </label>
      </div>
      <textarea
        name="text"
        required
        rows="4"
        maxlength="4000"
        placeholder={`One entry: "Westside Community Center has a shower trailer open 8a-8p at 1234 Magnolia. Call (714) 555-0123."\n\nOr a bulleted list — each becomes its own draft to review:\nHotlines:\n- Garden Grove 24-hour call center: (714) 741-5444\n- OC public info hotline: (714) 628-7085`}
        value={qaText}
        oninput={(e) => (qaText = e.currentTarget.value)}
        class="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
      ></textarea>
      <button
        type="submit"
        class="rounded-md bg-ink px-4 py-3 text-base font-medium text-white hover:bg-slate-800"
      >
        Parse for review
      </button>
    </form>
  {/if}
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
        <th class="px-3 py-2">Expires</th>
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
          <td class="px-3 py-2 text-xs">
            {#if e.expires_at}
              <span class="rounded px-1.5 py-0.5 font-medium {isExpired(e.expires_at) ? 'bg-red-100 text-red-800' : 'text-slate-600'}">
                {expirationLabel(e.expires_at)}
              </span>
            {:else}
              <span class="text-slate-400">—</span>
            {/if}
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
        <tr><td colspan="8" class="px-3 py-8 text-center text-sm text-slate-500">Nothing here.</td></tr>
      {/each}
    </tbody>
  </table>
</div>
