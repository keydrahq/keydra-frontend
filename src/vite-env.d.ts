/// <reference types="vite/client" />

/**
 * The settings a build reads from its environment.
 *
 * Declared rather than inferred so a typo in one is a compile error instead of an
 * undefined that quietly turns a feature off.
 */
interface ImportMetaEnv {
  /** Starts the mock API worker, so the UI is usable without a backend. */
  readonly VITE_MOCK_API?: string;
  /** Where the browser sends what it knows about itself. Nothing is sent without it. */
  readonly VITE_FARO_URL?: string;
  /** What to call this build in that telemetry. */
  readonly VITE_APP_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
