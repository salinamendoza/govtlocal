<script lang="ts">
  import { enqueueReport, pendingCount, type ReportType } from '$lib/client/outbox';
  import { connection } from '$lib/client/connection.svelte';
  import { onMount } from 'svelte';

  const TYPES: { value: ReportType; label: string; hint: string }[] = [
    { value: 'resource_full', label: 'Resource is full / closed', hint: 'A shelter, water site, or station is no longer available.' },
    { value: 'other', label: 'Something else', hint: 'Anything that doesn\'t fit above.' }
  ];

  let type = $state<ReportType>('resource_full');
  let message = $state('');
  let contact = $state('');
  let location = $state('');
  let submitting = $state(false);
  let savedId = $state<string | null>(null);
  let queued = $state(0);
  let error = $state<string | null>(null);

  async function refreshQueued() {
    try {
      queued = await pendingCount();
    } catch {
      queued = 0;
    }
  }

  onMount(() => {
    void refreshQueued();
  });

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (submitting) return;
    error = null;
    if (!message.trim()) {
      error = 'Please tell us what is happening.';
      return;
    }
    if (message.length > 2000) {
      error = 'Message is too long (max 2000 characters).';
      return;
    }
    submitting = true;
    try {
      const id = await enqueueReport({
        type,
        payload: {
          message: message.trim(),
          contact: contact.trim() || null,
          location: location.trim() || null
        }
      });
      savedId = id;
      message = '';
      contact = '';
      location = '';
      await refreshQueued();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not save report.';
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head><title>Send a Report — Emergency Resources</title></svelte:head>

<div class="mx-auto max-w-xl px-4 py-6">
  <h2 class="text-2xl font-semibold text-ink">Report a problem with this directory</h2>
  <p class="mt-1 text-sm text-slate-600">
    Tell us if a resource is wrong, full, or closed so we can update it.
    Reports are saved on your device immediately and sent as soon as you have signal.
  </p>
  <p class="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
    <strong>This is not emergency services.</strong> If you need immediate help, call 911.
  </p>

  {#if !connection.online}
    <p class="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      You're offline. Reports will queue here and send automatically when you reconnect.
    </p>
  {/if}

  {#if savedId}
    <div class="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      <p class="font-semibold">Saved locally.</p>
      <p class="mt-1">
        Receipt ID: <code class="font-mono text-xs">{savedId.slice(0, 8)}</code>.
        {connection.online
          ? "It's being sent now."
          : 'It will send when you have signal.'}
      </p>
    </div>
  {/if}

  <form onsubmit={submit} class="mt-6 flex flex-col gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    {#if error}
      <p class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </p>
    {/if}

    <fieldset class="flex flex-col gap-2">
      <legend class="mb-1 text-sm font-medium text-ink">What is this report?</legend>
      {#each TYPES as t (t.value)}
        <label class="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 hover:border-slate-300 {type === t.value ? 'bg-slate-50 border-slate-400' : ''}">
          <input
            type="radio"
            name="type"
            value={t.value}
            checked={type === t.value}
            onchange={() => (type = t.value)}
            class="mt-0.5"
          />
          <span class="flex flex-col">
            <span class="text-sm font-medium text-ink">{t.label}</span>
            <span class="text-xs text-slate-500">{t.hint}</span>
          </span>
        </label>
      {/each}
    </fieldset>

    <div>
      <label for="message" class="mb-1 block text-sm font-medium text-ink">
        What is happening? <span aria-hidden="true" class="text-red-600">*</span>
      </label>
      <textarea
        id="message"
        rows="4"
        required
        maxlength="2000"
        bind:value={message}
        class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
      ></textarea>
    </div>

    <div>
      <label for="location" class="mb-1 block text-sm font-medium text-ink">
        Where? <span class="font-normal text-slate-500">(optional)</span>
      </label>
      <input
        id="location"
        maxlength="200"
        bind:value={location}
        placeholder="Address, intersection, or landmark"
        class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
      />
    </div>

    <div>
      <label for="contact" class="mb-1 block text-sm font-medium text-ink">
        Phone or email <span class="font-normal text-slate-500">(optional — only if you want a callback)</span>
      </label>
      <input
        id="contact"
        maxlength="200"
        bind:value={contact}
        class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
      />
    </div>

    <button
      type="submit"
      disabled={submitting}
      class="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
    >
      {submitting ? 'Saving…' : 'Send Report'}
    </button>

    {#if queued > 0}
      <p class="text-xs text-slate-500">
        {queued} report{queued === 1 ? '' : 's'} waiting to send.
      </p>
    {/if}

    <p class="text-xs text-slate-500">
      We don't store names or device IDs. Anything you type here is sent only when you submit.
    </p>
  </form>
</div>
