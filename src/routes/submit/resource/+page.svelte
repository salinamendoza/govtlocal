<script lang="ts">
  import EntryForm from '$lib/components/EntryForm.svelte';
  import { RESOURCE_CATEGORIES } from '$lib/categories';
  import type { ActionData } from './$types';

  let { form }: { form: ActionData } = $props();
</script>

<svelte:head><title>Submit a Resource — Emergency Resources</title></svelte:head>

<div class="mx-auto max-w-2xl px-4 py-6">
  <h2 class="text-2xl font-semibold text-ink">Submit a Resource</h2>
  <p class="mt-1 text-sm text-slate-600">
    Share a shelter, food site, medical service, or anything else that helps people right now.
    A volunteer will review and publish your submission.
  </p>

  <div class="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <EntryForm
      kind="resource"
      categories={RESOURCE_CATEGORIES}
      submitLabel="Submit Resource"
      errors={form?.errors}
      values={form?.values}
      formError={form?.formError}
    />
  </div>
</div>
