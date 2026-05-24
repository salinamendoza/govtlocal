<script lang="ts">
  interface Props {
    mode: 'help' | 'donate' | null;
  }
  let { mode }: Props = $props();

  const baseSeg =
    'flex-1 md:flex-none px-4 py-2 text-sm font-medium text-center rounded-md transition-colors';
  const active = 'bg-ink text-white';
  const inactive = 'text-slate-600 hover:text-ink';
</script>

<div
  role="tablist"
  aria-label="Mode"
  class="inline-flex w-full items-center rounded-lg border border-slate-200 bg-slate-100 p-1 md:w-auto"
>
  <a
    role="tab"
    aria-selected={mode === 'help'}
    href="/help"
    class="{baseSeg} {mode === 'help' ? active : inactive}"
  >
    Receive Help
  </a>
  <a
    role="tab"
    aria-selected={mode === 'donate'}
    href="/donate"
    class="{baseSeg} {mode === 'donate' ? active : inactive}"
  >
    Donate
  </a>
</div>
