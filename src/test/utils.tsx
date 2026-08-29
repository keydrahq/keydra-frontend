import type { ReactElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as rtlRender } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { defaultServices, ServiceContext } from '@app/Shared/Services/Services';
import type { Services } from '@app/Shared/Services/Services';

export interface RenderOptions {
  services?: Partial<Services>;
  route?: string;
  /**
   * Route pattern the component is mounted under.
   *
   * <p>Needed when the component reads useParams: without a matching Route the params are empty
   * and the component sees no connection id.
   */
  path?: string;
}

/**
 * Renders a component inside the same provider tree the app uses, so tests
 * exercise real routing, query and service wiring.
 */
export const render = (ui: ReactElement, options: RenderOptions = {}) => {
  const services: Services = { ...defaultServices, ...options.services };
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <ServiceContext.Provider value={services}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[options.route ?? '/']}>
          {options.path ? (
            <Routes>
              <Route path={options.path} element={children} />
            </Routes>
          ) : (
            children
          )}
        </MemoryRouter>
      </QueryClientProvider>
    </ServiceContext.Provider>
  );

  return rtlRender(ui, { wrapper: Wrapper });
};
