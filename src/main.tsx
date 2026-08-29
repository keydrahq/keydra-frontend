import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@app/index';
import { startTelemetry } from '@app/Shared/Services/Telemetry';
import '@i18n/config';

/** Starts the MSW worker so the UI is usable without a running backend. */
const enableMocking = async (): Promise<void> => {
  if (import.meta.env.VITE_MOCK_API !== 'true') {
    return;
  }
  const { worker } = await import('@mocks/browser');
  await worker.start({ onUnhandledRequest: 'bypass' });
};

// Before the first render, so a failure while the page is still starting is a failure
// somebody collecting this would see. Failing to start telemetry never stops the
// application: the console is the thing being used, and this is the thing watching it.
void startTelemetry().catch(() => undefined);

void enableMocking().then(() => {
  const container = document.getElementById('root');
  if (!container) {
    throw new Error('Root container #root not found');
  }
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
