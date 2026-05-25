<script lang="ts">
  import ModeToggle from './ModeToggle.svelte';
  import ConnectionIndicator from './ConnectionIndicator.svelte';

  interface Props {
    mode: 'help' | 'donate' | null;
  }
  let { mode }: Props = $props();

  const submitHref = $derived(mode === 'donate' ? '/submit/donation' : '/submit/resource');
  const submitLabel = $derived(mode === 'donate' ? 'Submit Donation' : 'Submit Resource');

  let menuOpen = $state(false);
  let menuButton = $state<HTMLButtonElement | null>(null);

  function close() {
    menuOpen = false;
  }
  function onDocClick(e: MouseEvent) {
    if (!menuOpen) return;
    const target = e.target as Node;
    if (menuButton && (menuButton === target || menuButton.contains(target))) return;
    close();
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }
</script>

<svelte:window onclick={onDocClick} onkeydown={onKey} />

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

    <div class="flex flex-row items-center gap-2 md:gap-3">
      <div class="hidden md:block">
        <ConnectionIndicator />
      </div>
      <div class="flex-1 md:flex-none">
        <ModeToggle {mode} />
      </div>

      {#if mode}
        <!-- Desktop: surface Submit + Report directly. Plenty of room. -->
        <div class="hidden md:flex md:items-center md:gap-2">
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

        <!-- Mobile: collapse Submit + Report behind a single overflow button. -->
        <div class="relative md:hidden">
          <button
            bind:this={menuButton}
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="More actions"
            onclick={() => (menuOpen = !menuOpen)}
            class="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" class="h-5 w-5" aria-hidden="true">
              <path d="M4 10a2 2 0 11.001-.001A2 2 0 014 10zm6 0a2 2 0 11.001-.001A2 2 0 0110 10zm6 0a2 2 0 11.001-.001A2 2 0 0116 10z" />
            </svg>
          </button>
          {#if menuOpen}
            <div
              role="menu"
              class="absolute right-0 top-full z-10 mt-1 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
            >
              <a
                href={submitHref}
                role="menuitem"
                onclick={close}
                class="block px-4 py-3 text-sm font-medium text-ink hover:bg-slate-50"
              >
                {submitLabel}
              </a>
              <a
                href="/report"
                role="menuitem"
                onclick={close}
                class="block border-t border-slate-100 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Send a Report
              </a>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</header>
