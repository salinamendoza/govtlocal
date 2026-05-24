<script lang="ts">
  import ModeToggle from './ModeToggle.svelte';
  import ConnectionIndicator from './ConnectionIndicator.svelte';

  interface Props {
    mode: 'help' | 'donate' | null;
  }
  let { mode }: Props = $props();

  const submitHref = $derived(mode === 'donate' ? '/submit/donation' : '/submit/resource');
  const submitLabel = $derived(mode === 'donate' ? 'Submit Donation' : 'Submit Resource');
</script>

<header class="border-b border-slate-200 bg-white">
  <div
    class="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:py-5"
  >
    <div class="flex items-start justify-between gap-3 md:items-center">
      <a href="/help" class="block">
        <h1 class="text-xl font-semibold tracking-tight text-ink">Emergency Resources</h1>
        <p class="text-sm text-slate-500">Find help. Offer help. Share what you have.</p>
      </a>
      <div class="md:hidden">
        <ConnectionIndicator />
      </div>
    </div>

    <div class="flex flex-col gap-3 md:flex-row md:items-center md:gap-3">
      <div class="hidden md:block">
        <ConnectionIndicator />
      </div>
      <ModeToggle {mode} />
      {#if mode}
        <div class="flex flex-col gap-2 md:flex-row md:items-center md:gap-2">
          <a
            href={submitHref}
            class="inline-flex items-center justify-center rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            {submitLabel}
          </a>
          <a
            href="/report"
            class="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300"
          >
            Report
          </a>
        </div>
      {/if}
    </div>
  </div>
</header>
