import type { FC } from 'react';
import { Route, Routes } from 'react-router';
import { ConnectionDetail } from '@app/Connections/ConnectionDetail';
import { NotFound } from '@app/NotFound/NotFound';
import { Overview } from '@app/Overview/Overview';
import { connectionRoutes, routes } from '@app/routes';

/**
 * Renders the route table from `routes.tsx`; unknown paths fall through to 404.
 *
 * <p>The tools of one target are nested under a layout route, so the target's header and tabs are
 * mounted once and only the body below them changes as the tabs are used.
 */
export const AppRoutes: FC = () => (
  <Routes>
    {/* The fleet, not one target: "how is everything" is the question somebody running
        more than one server has before they have picked which one to open. */}
    <Route path="/" element={<Overview />} />
    {routes.map(({ path, component: Component }) => (
      <Route key={path} path={path} element={<Component />} />
    ))}
    <Route path="/connections/:connectionId" element={<ConnectionDetail />}>
      {connectionRoutes.map(({ path, component: Component }) => (
        // Relative to the layout route: "/connections/:connectionId/keys" is "keys" here.
        <Route key={path} path={path.split('/').pop()} element={<Component />} />
      ))}
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>
);
