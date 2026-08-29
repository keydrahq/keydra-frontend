import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

/** Service-worker-backed mock API, started from main.tsx when VITE_MOCK_API=true. */
export const worker = setupWorker(...handlers);
