<script lang="ts">
  import { page } from '$app/stores';
  let { children } = $props();

  const nav = [
    { href: '/admin', label: 'Queue' },
    { href: '/admin/updates', label: 'Updates' },
    { href: '/admin/hazards', label: 'Hazard zones' },
    { href: '/admin/reports', label: 'Reports inbox' }
  ];

  const isLogin = $derived($page.url.pathname === '/admin/login');
</script>

{#if isLogin}
  {@render children()}
{:else}
  <div class="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 md:flex-row">
    <aside class="md:w-48 shrink-0">
      <h2 class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Admin</h2>
      <nav class="flex flex-row gap-2 overflow-x-auto md:flex-col">
        {#each nav as link (link.href)}
          <a
            href={link.href}
            class="rounded-md px-3 py-2 text-sm font-medium {$page.url.pathname === link.href
              ? 'bg-ink text-white'
              : 'text-slate-700 hover:bg-slate-100'}"
          >
            {link.label}
          </a>
        {/each}
        <form method="POST" action="/admin/logout" class="md:mt-4">
          <button
            type="submit"
            class="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Sign out
          </button>
        </form>
      </nav>
    </aside>
    <section class="flex-1 min-w-0">
      {@render children()}
    </section>
  </div>
{/if}
