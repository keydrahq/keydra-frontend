import type { FC } from 'react';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router';
import { AppLayout } from '@app/AppLayout/AppLayout';
import { AppRoutes } from '@app/AppRoutes';
import { NotificationProvider } from '@app/Shared/Components/Notifications';
import { AcceptInvitation } from '@app/Login/AcceptInvitation';
import { RequiresSignIn } from '@app/Security/RequiresSignIn';
import { authQueryKey } from '@app/Login/queries';
import { ApiError } from '@app/Shared/Services/Api.service';
import { defaultServices, ServiceContext } from '@app/Shared/Services/Services';
import './app.css';
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
  /*
   * A session that has expired is discovered by a request being refused, not by a clock. When
   * that happens the application is still on screen and every page in it is broken, so the one
   * useful response is to ask again who the caller is — which finds them anonymous and puts the
   * login page back.
   *
   * Here rather than in ApiService because it is a decision about the application's state, and
   * ApiService knows nothing about state; here rather than per query because a session expires
   * for all of them at once.
   */
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) {
        void queryClient.invalidateQueries({ queryKey: authQueryKey });
      }
    },
  }),
});

/** Provider tree for the whole application. */
export const App: FC = () => (
  <ServiceContext.Provider value={defaultServices}>
    <QueryClientProvider client={queryClient}>
      <NotificationProvider>
        <BrowserRouter>
          <Routes>
            {/* Outside the sign-in wall, necessarily: whoever follows an invitation has no
                  account to authenticate with yet, which is the entire point of the link. */}
            <Route path="/invitation/:token" element={<AcceptInvitation />} />
            <Route
              path="*"
              element={
                <RequiresSignIn>
                  <AppLayout>
                    <AppRoutes />
                  </AppLayout>
                </RequiresSignIn>
              }
            />
          </Routes>
        </BrowserRouter>
      </NotificationProvider>
    </QueryClientProvider>
  </ServiceContext.Provider>
);
