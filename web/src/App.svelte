<script lang="ts">
  import CreatePage from './pages/CreatePage.svelte';
  import EditPage from './pages/EditPage.svelte';
  import NotFoundPage from './pages/NotFoundPage.svelte';
  import { pageFor } from './pages/page.ts';

  const current = () => pageFor(window.location.pathname, window.location.hash);
  let page = $state(current());
</script>

<svelte:window onpopstate={() => (page = current())} onhashchange={() => (page = current())} />

{#if page.name === 'create'}
  <CreatePage />
{:else if page.name === 'edit'}
  <EditPage />
{:else}
  <NotFoundPage />
{/if}
