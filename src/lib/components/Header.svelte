<script lang="ts">
  import ModeToggle from './ModeToggle.svelte';

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
    <a href="/help" class="block">
      <h1 class="text-xl font-semibold tracking-tight text-ink">Emergency Resources</h1>
      <p class="text-sm text-slate-500">Find help. Offer help. Share what you have.</p>
    </a>

    <div class="flex flex-col gap-3 md:flex-row md:items-center md:gap-3">
      <ModeToggle {mode} />
      {#if mode}
        <a
          href={submitHref}
          class="inline-flex items-center justify-center rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {submitLabel}
        </a>
      {/if}
    </div>
  </div>
</header>
