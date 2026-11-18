<script lang="ts">
  import { AttributionControl, MapLibreMap, NavigationControl, setWorkerUrl } from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  // MapLibre looks for its worker next to its own file, which Vite moves when bundling.
  // Point it at the worker explicitly so tiles load in dev and in production builds.
  import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
  import { onMount } from 'svelte';
  import { DEFAULT_CENTER, DEFAULT_ZOOM, resolveMapStyleUrl } from './settings.ts';

  setWorkerUrl(workerUrl);

  interface Props {
    /** Called once, when the map and its style have loaded and layers can be added. */
    onready?: (map: MapLibreMap) => void;
  }
  let { onready }: Props = $props();

  let container: HTMLDivElement;

  onMount(() => {
    const map = new MapLibreMap({
      container,
      style: resolveMapStyleUrl(import.meta.env.VITE_MAP_STYLE_URL),
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
    });
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    // Top corner, so the panels at the bottom of the screen never cover the map credits.
    map.addControl(new AttributionControl({ compact: true }), 'top-right');
    map.once('load', () => onready?.(map));
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
