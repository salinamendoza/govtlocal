<script lang="ts">
  import { onMount } from 'svelte';
  import { env } from '$env/dynamic/public';

  interface Props {
    /** "auto" (size from layout) or "compact". */
    size?: 'normal' | 'compact';
  }
  let { size = 'normal' }: Props = $props();

  const siteKey = env.PUBLIC_TURNSTILE_SITE_KEY ?? '';
  let scriptLoaded = $state(false);

  onMount(() => {
    if (!siteKey) return;
    if (document.querySelector('script[data-turnstile]')) {
      scriptLoaded = true;
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true;
    s.defer = true;
    s.dataset.turnstile = '';
    s.onload = () => (scriptLoaded = true);
    document.head.appendChild(s);
  });
</script>

{#if siteKey}
  <div
    class="cf-turnstile"
    data-sitekey={siteKey}
    data-size={size}
    data-theme="light"
  ></div>
  {#if !scriptLoaded}
    <p class="text-xs text-slate-500">Loading verification…</p>
  {/if}
{:else}
  <!-- Turnstile not configured — server will treat as skipped. -->
{/if}
