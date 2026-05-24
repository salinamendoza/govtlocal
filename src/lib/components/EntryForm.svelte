<script lang="ts">
  import type { Kind } from '$lib/types';
  import { HONEYPOT_FIELD } from '$lib/honeypot';
  import { USER_CAPACITY_STATUSES, CAPACITY_LABEL } from '$lib/capacity';
  import { SERVICE_TAGS } from '$lib/services';
  import Turnstile from './Turnstile.svelte';

  interface Props {
    kind: Kind;
    categories: readonly string[];
    submitLabel: string;
    errors?: Record<string, string>;
    values?: Record<string, string | string[]>;
    formError?: string;
  }
  let {
    kind,
    categories,
    submitLabel,
    errors = {},
    values = {},
    formError
  }: Props = $props();

  function err(name: string) {
    return errors[name];
  }

  function str(name: string): string {
    const v = values[name];
    return typeof v === 'string' ? v : '';
  }

  const selectedServices = $derived<Set<string>>(
    new Set(Array.isArray(values.services) ? values.services : [])
  );
  const selectedCapacity = $derived(str('capacity_status') || 'open');
</script>

<form
  method="POST"
  class="flex flex-col gap-5"
  enctype="application/x-www-form-urlencoded"
  autocomplete="off"
>
  {#if formError}
    <p class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {formError}
    </p>
  {/if}

  <!-- Honeypot: visually hidden but reachable to bots that fill every field. -->
  <div aria-hidden="true" class="absolute left-[-9999px] h-px w-px overflow-hidden">
    <label>
      Leave this empty
      <input type="text" name={HONEYPOT_FIELD} tabindex="-1" autocomplete="off" />
    </label>
  </div>

  <div>
    <label for="title" class="mb-1 block text-sm font-medium text-ink">
      {kind === 'resource' ? 'Resource name' : 'Donation name'} <span aria-hidden="true" class="text-red-600">*</span>
    </label>
    <input
      id="title"
      name="title"
      required
      maxlength="160"
      value={str('title')}
      class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
    />
    {#if err('title')}<p class="mt-1 text-xs text-red-700">{err('title')}</p>{/if}
  </div>

  <div>
    <label for="description" class="mb-1 block text-sm font-medium text-ink">
      Description <span aria-hidden="true" class="text-red-600">*</span>
    </label>
    <textarea
      id="description"
      name="description"
      required
      maxlength="2000"
      rows="4"
      class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
    >{str('description')}</textarea>
    {#if err('description')}<p class="mt-1 text-xs text-red-700">{err('description')}</p>{/if}
  </div>

  <div>
    <label for="category" class="mb-1 block text-sm font-medium text-ink">
      Category <span aria-hidden="true" class="text-red-600">*</span>
    </label>
    <select
      id="category"
      name="category"
      required
      class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
    >
      <option value="" disabled selected={!str('category')}>Choose one…</option>
      {#each categories as c (c)}
        <option value={c} selected={str('category') === c}>{c}</option>
      {/each}
    </select>
    {#if err('category')}<p class="mt-1 text-xs text-red-700">{err('category')}</p>{/if}
  </div>

  <div>
    <label for="capacity_status" class="mb-1 block text-sm font-medium text-ink">
      Current capacity
    </label>
    <select
      id="capacity_status"
      name="capacity_status"
      class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
    >
      {#each USER_CAPACITY_STATUSES as cap (cap)}
        <option value={cap} selected={selectedCapacity === cap}>{CAPACITY_LABEL[cap]}</option>
      {/each}
    </select>
    {#if err('capacity_status')}<p class="mt-1 text-xs text-red-700">{err('capacity_status')}</p>{/if}
  </div>

  <fieldset>
    <legend class="mb-2 text-sm font-medium text-ink">
      What's available here? <span class="font-normal text-slate-500">(select all that apply)</span>
    </legend>
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {#each SERVICE_TAGS as tag (tag)}
        <label class="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:border-slate-300 has-[:checked]:border-ink has-[:checked]:bg-slate-50">
          <input
            type="checkbox"
            name="services"
            value={tag}
            checked={selectedServices.has(tag)}
            class="h-4 w-4 rounded border-slate-300"
          />
          <span>{tag}</span>
        </label>
      {/each}
    </div>
    {#if err('services')}<p class="mt-1 text-xs text-red-700">{err('services')}</p>{/if}
  </fieldset>

  <fieldset class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <legend class="sr-only">Location</legend>
    <div>
      <label for="city" class="mb-1 block text-sm font-medium text-ink">City</label>
      <input
        id="city"
        name="city"
        maxlength="80"
        value={str('city')}
        class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
      />
      {#if err('city')}<p class="mt-1 text-xs text-red-700">{err('city')}</p>{/if}
    </div>
    <div>
      <label for="zip" class="mb-1 block text-sm font-medium text-ink">ZIP</label>
      <input
        id="zip"
        name="zip"
        maxlength="16"
        inputmode="numeric"
        value={str('zip')}
        class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
      />
      {#if err('zip')}<p class="mt-1 text-xs text-red-700">{err('zip')}</p>{/if}
    </div>
  </fieldset>

  <div>
    <label for="address" class="mb-1 block text-sm font-medium text-ink">Address</label>
    <input
      id="address"
      name="address"
      maxlength="200"
      value={str('address')}
      class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
    />
    {#if err('address')}<p class="mt-1 text-xs text-red-700">{err('address')}</p>{/if}
  </div>

  <fieldset class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <legend class="sr-only">Contact</legend>
    <div>
      <label for="phone" class="mb-1 block text-sm font-medium text-ink">Phone</label>
      <input
        id="phone"
        name="phone"
        maxlength="40"
        inputmode="tel"
        autocomplete="tel"
        value={str('phone')}
        class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
      />
      {#if err('phone')}<p class="mt-1 text-xs text-red-700">{err('phone')}</p>{/if}
    </div>
    <div>
      <label for="url" class="mb-1 block text-sm font-medium text-ink">Link (URL)</label>
      <input
        id="url"
        name="url"
        type="url"
        maxlength="500"
        value={str('url')}
        class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
      />
      {#if err('url')}<p class="mt-1 text-xs text-red-700">{err('url')}</p>{/if}
    </div>
  </fieldset>

  <fieldset class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <legend class="sr-only">Contact person</legend>
    <div>
      <label for="contact_name" class="mb-1 block text-sm font-medium text-ink">
        Contact name
      </label>
      <input
        id="contact_name"
        name="contact_name"
        maxlength="120"
        value={str('contact_name')}
        class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
      />
      {#if err('contact_name')}<p class="mt-1 text-xs text-red-700">{err('contact_name')}</p>{/if}
    </div>
    <div>
      <label for="contact_email" class="mb-1 block text-sm font-medium text-ink">
        Contact email
      </label>
      <input
        id="contact_email"
        name="contact_email"
        type="email"
        maxlength="200"
        autocomplete="email"
        value={str('contact_email')}
        class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
      />
      {#if err('contact_email')}<p class="mt-1 text-xs text-red-700">{err('contact_email')}</p>{/if}
    </div>
  </fieldset>

  <Turnstile />

  <div class="flex flex-col-reverse items-stretch gap-3 md:flex-row md:items-center md:justify-end">
    <a
      href={kind === 'resource' ? '/help' : '/donate'}
      class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-center text-sm font-medium text-slate-700 hover:border-slate-300"
    >
      Cancel
    </a>
    <button
      type="submit"
      class="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
    >
      {submitLabel}
    </button>
  </div>

  <p class="text-xs text-slate-500">
    Submissions are reviewed by volunteers before they appear publicly.
    Contact info is shown only if you provide it.
  </p>
</form>
