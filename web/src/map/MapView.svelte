<script lang="ts">
  import { MapLibreMap, NavigationControl, setWorkerUrl } from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  // MapLibre looks for its worker next to its own file, which Vite moves when bundling.
  // Point it at the worker explicitly so tiles load in dev and in production builds.
  import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
  import { onMount } from 'svelte';
  import { DEFAULT_CENTER, DEFAULT_ZOOM, resolveMapStyleUrl } from './settings.ts';

  setWorkerUrl(workerUrl);

  let container: HTMLDivElement;

  onMount(() => {
    const map = new MapLibreMap({
      container,
      style: resolveMapStyleUrl(import.meta.env.VITE_MAP_STYLE_URL),
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    return () => map.remove();
  });
</script>

<div class="map" bind:this={container} role="region" aria-label="Map"></div>

<style>
  .map {
    position: fixed;
    inset: 0;
  }
</style>
