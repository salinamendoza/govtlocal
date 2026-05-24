<script lang="ts">
  import { page } from '$app/stores';
</script>

<div class="mx-auto max-w-xl px-4 py-16 text-center">
  <p class="text-sm font-medium uppercase tracking-wider text-slate-500">
    Error {$page.status}
  </p>
  <h1 class="mt-2 text-2xl font-semibold text-ink">
    {$page.error?.message ?? 'Something went wrong.'}
  </h1>
  <a
    href="/help"
    class="mt-6 inline-block rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white"
  >
    Back to help
  </a>
</div>
