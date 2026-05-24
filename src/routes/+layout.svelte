<script lang="ts">
  import '../app.css';
  import Header from '$lib/components/Header.svelte';
  import UpdatesBanner from '$lib/components/UpdatesBanner.svelte';
  import { page } from '$app/stores';

  let { children } = $props();

  const mode = $derived<'help' | 'donate' | null>(
    $page.url.pathname.startsWith('/help')
      ? 'help'
      : $page.url.pathname.startsWith('/donate')
        ? 'donate'
        : null
  );
</script>

<div class="min-h-dvh flex flex-col">
  <Header {mode} />
  <UpdatesBanner />
  <main class="flex-1">
    {@render children()}
  </main>
  <footer class="border-t border-slate-200 py-6 text-center text-sm text-slate-500">
    Community-maintained. Submissions reviewed before publishing.
  </footer>
</div>
