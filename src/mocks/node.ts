import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/** Node-side mock API used by the Vitest setup file. */
export const server = setupServer(...handlers);
