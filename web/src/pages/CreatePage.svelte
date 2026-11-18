<script lang="ts">
  import MapView from '../map/MapView.svelte';
</script>

<MapView />
<header class="banner">
  <h1>Draw the way to your door</h1>
</header>

<style>
  .banner {
    position: fixed;
    top: 12px;
    left: 12px;
    right: 56px;
    padding: 8px 12px;
    border-radius: 8px;
    background: rgb(255 255 255 / 0.92);
    box-shadow: 0 1px 4px rgb(0 0 0 / 0.2);
  }

  h1 {
    margin: 0;
    font-size: 1rem;
  }
</style>
