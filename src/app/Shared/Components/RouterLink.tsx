import type { AnchorHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { Link } from 'react-router';

/**
 * An anchor that navigates client-side.
 *
 * <p>PatternFly components render whatever `component` they are given and pass it an `href`;
 * react-router's Link wants a `to`. This adapter is the join. It lives at module scope on purpose:
 * written inline as `component={(props) => <Link .../>}` — the shape PatternFly's own examples use
 * — the component type differs on every render, so React unmounts and remounts the link each time.
 */
export const RouterLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement>>(
  ({ href = '', ...props }, ref) => <Link {...props} ref={ref} to={href} />,
);

RouterLink.displayName = 'RouterLink';
