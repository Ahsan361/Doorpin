<script lang="ts">
  import { manualMessage, type LocateResult } from './locate.ts';

  interface Props {
    /** Undefined while the phone is still looking for its location. */
    located: LocateResult | undefined;
    hasDoor: boolean;
    /** True while the pin is where the phone's location put it. */
    doorFromLocation: boolean;
    onretry: () => void;
    onconfirm: () => void;
  }
  let { located, hasDoor, doorFromLocation, onretry, onconfirm }: Props = $props();

  // Offered whenever the pin didn't come from the location, including when a late fix was
  // ignored because the sender had already placed the pin by hand.
  let canRetry = $derived(located !== undefined && !doorFromLocation);
</script>

<section class="panel" aria-live="polite">
  {#if located === undefined}
    <h2>Finding your location…</h2>
    <p>You can also tap your door on the map.</p>
  {:else if hasDoor}
    <h2>Is this your door?</h2>
    <p>Tap the map to move the pin if it's not quite right.</p>
  {:else if located.kind === 'manual'}
    <h2>Tap your door on the map</h2>
    <p>{manualMessage(located.reason)}</p>
  {/if}

  <div class="actions">
    {#if canRetry}
      <button type="button" class="secondary" onclick={onretry}>
        {hasDoor ? 'Use my location instead' : 'Try my location again'}
      </button>
    {/if}
    <button type="button" class="primary" disabled={!hasDoor} onclick={onconfirm}>
      Yes, this is my door
    </button>
  </div>
</section>

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
    margin: 0 0 12px;
    color: #4a4a4a;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  button {
    min-height: 48px;
    border-radius: 10px;
    font-size: 1rem;
    font-weight: 600;
  }

  .primary {
    border: none;
    color: #ffffff;
    background: #1f6feb;
  }

  .primary:disabled {
    background: #9db8e0;
  }

  .secondary {
    border: 1px solid #1f6feb;
    color: #1f6feb;
    background: #ffffff;
  }
</style>
