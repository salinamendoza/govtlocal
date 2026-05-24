<script lang="ts">
  import EntryList from '$lib/components/EntryList.svelte';
  import { DONATION_CATEGORIES } from '$lib/categories';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Donate — Emergency Resources</title>
</svelte:head>

<EntryList
  kind="donation"
  categories={DONATION_CATEGORIES}
  initialItems={data.items}
/>
