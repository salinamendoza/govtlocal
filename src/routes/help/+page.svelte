<script lang="ts">
  import EntryList from '$lib/components/EntryList.svelte';
  import { RESOURCE_CATEGORIES } from '$lib/categories';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Receive Help — Emergency Resources</title>
</svelte:head>

<EntryList
  kind="resource"
  categories={RESOURCE_CATEGORIES}
  initialItems={data.items}
  initialNextCursor={data.nextCursor}
/>
