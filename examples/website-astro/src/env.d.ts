/// <reference types="astro/client" />

interface ApptrackTracker {
  track: (
    type: string,
    props?: Record<string, string | number | boolean | undefined>,
  ) => void;
  flush: () => void;
  destroy: () => void;
}

interface Window {
  apptrack?: ApptrackTracker;
}
