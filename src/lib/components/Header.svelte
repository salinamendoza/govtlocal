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
    class="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-4 md:py-5"
  >
    <div class="flex items-center justify-between gap-3">
      <a href="/help" class="block">
        <h1 class="text-lg font-semibold tracking-tight text-ink md:text-xl">Emergency Resources</h1>
        <p class="hidden text-sm text-slate-500 md:block">Find help. Offer help. Share what you have.</p>
      </a>
      <div class="md:hidden">
        <ConnectionIndicator />
      </div>
    </div>

    <div class="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
      <div class="hidden md:block">
        <ConnectionIndicator />
      </div>
      <ModeToggle {mode} />
      {#if mode}
        <div class="flex flex-row gap-2 md:items-center">
          <a
            href={submitHref}
            class="inline-flex flex-1 items-center justify-center rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 md:flex-none"
          >
            {submitLabel}
          </a>
          <a
            href="/report"
            class="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300"
          >
            Report
          </a>
        </div>
      {/if}
    </div>
  </div>
</header>
