<script lang="ts">
  import type { ActionData, PageData } from './$types';
  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>Admin Sign-in</title></svelte:head>

<div class="mx-auto max-w-sm px-4 py-16">
  <h2 class="text-xl font-semibold text-ink">Admin sign-in</h2>
  <form method="POST" class="mt-6 flex flex-col gap-4">
    <input type="hidden" name="next" value={data.next} />
    {#if form?.error}
      <p class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {form.error}
      </p>
    {/if}
    <label class="flex flex-col gap-1 text-sm">
      <span class="font-medium text-ink">Password</span>
      <!-- svelte-ignore a11y_autofocus -->
      <input
        type="password"
        name="password"
        required
        autocomplete="current-password"
        autofocus
        class="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
      />
    </label>
    <button
      type="submit"
      class="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
    >
      Sign in
    </button>
  </form>
</div>
