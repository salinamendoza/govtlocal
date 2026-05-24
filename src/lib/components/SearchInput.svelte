<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  interface Props {
    value: string;
    placeholder?: string;
  }
  let { value, placeholder = 'Search…' }: Props = $props();

  // svelte-ignore state_referenced_locally
  let local = $state(value);
  let timer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    local = value;
  });

  function commit(next: string) {
    const url = new URL($page.url);
    if (next.trim()) url.searchParams.set('q', next);
    else url.searchParams.delete('q');
    goto(url, { replaceState: true, keepFocus: true, noScroll: true });
  }

  function onInput(e: Event) {
    const next = (e.target as HTMLInputElement).value;
    local = next;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => commit(next), 200);
  }

  function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (timer) clearTimeout(timer);
    commit(local);
  }
</script>

<form onsubmit={onSubmit} role="search" class="w-full">
  <label for="search" class="sr-only">Search</label>
  <input
    id="search"
    type="search"
    name="q"
    autocomplete="off"
    {placeholder}
    value={local}
    oninput={onInput}
    class="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm placeholder:text-slate-400"
  />
</form>
