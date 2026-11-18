<script lang="ts">
  import type { LatLng } from '@doorpin/shared';
  import type { MapLibreMap, MapMouseEvent } from 'maplibre-gl';
  import { onDestroy } from 'svelte';
  import MapView from '../map/MapView.svelte';
  import { addDrawingLayers, showDrawing } from '../map/drawing-layers.ts';
  import DoorStep from './DoorStep.svelte';
  import { emptyDrawing, setDoor, tapPlacesPoint } from './drawing.ts';
  import { doorFromAnswer, locateOnce, type LocateResult } from './locate.ts';

  const CLOSE_ZOOM = 18;
  /** Keeps the pin above the panel at the bottom of the screen. */
  const PANEL_PADDING = { top: 16, right: 16, bottom: 220, left: 16 };

  let map = $state.raw<MapLibreMap>();
  let drawing = $state(emptyDrawing());
  let step = $state<'door' | 'path'>('door');
  let located = $state<LocateResult>();
  /** Shown around the door only while it is where the phone's location put it. */
  let accuracyM = $state<number | null>(null);
  /** Pins the sender placed by hand since the last location request. */
  let tapsSinceRequest = 0;
  let destroyed = false;

  function flyToDoor(target: MapLibreMap, door: LatLng) {
    target.flyTo({ center: [door.lng, door.lat], zoom: CLOSE_ZOOM, padding: PANEL_PADDING });
  }

  async function findDoor() {
    located = undefined;
    tapsSinceRequest = 0;
    const result = await locateOnce(navigator.geolocation);
    if (destroyed || step !== 'door') return;
    located = result;
    const placed = doorFromAnswer(result, { step, tapsSinceRequest });
    if (placed) {
      drawing = setDoor(drawing, placed.door);
      accuracyM = placed.accuracyM;
      if (map) flyToDoor(map, placed.door);
    }
  }

  function tapped(event: MapMouseEvent) {
    const point: LatLng = { lat: event.lngLat.lat, lng: event.lngLat.lng };
    if (!tapPlacesPoint(event.target.getZoom())) {
      event.target.flyTo({ center: event.lngLat, zoom: CLOSE_ZOOM, padding: PANEL_PADDING });
      return;
    }
    if (step === 'door') {
      drawing = setDoor(drawing, point);
      accuracyM = null;
      tapsSinceRequest += 1;
    }
  }

  function mapReady(readyMap: MapLibreMap) {
    // A double tap would place two points and zoom; drawing uses single taps only.
    readyMap.doubleClickZoom.disable();
    addDrawingLayers(readyMap);
    readyMap.on('click', tapped);
    map = readyMap;
    // The location may have arrived before the map finished loading.
    if (drawing.door !== null) flyToDoor(readyMap, drawing.door);
  }

  $effect(() => {
    if (map) showDrawing(map, { door: drawing.door, accuracyM });
  });

  findDoor();
  onDestroy(() => {
    destroyed = true;
  });
</script>

<MapView onready={mapReady} />

{#if step === 'door'}
  <DoorStep
    {located}
    hasDoor={drawing.door !== null}
    doorFromLocation={accuracyM !== null}
    onretry={findDoor}
    onconfirm={() => {
      accuracyM = null;
      step = 'path';
    }}
  />
{:else}
  <section class="panel">
    <h2>Door saved</h2>
    <p>Drawing the path from your door to the gate comes next.</p>
  </section>
{/if}

<style>
  .panel {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
    background: #ffffff;
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -2px 12px rgb(0 0 0 / 0.18);
  }

  h2 {
    margin: 0 0 4px;
    font-size: 1.125rem;
  }

  p {
    margin: 0;
    color: #4a4a4a;
  }
</style>
