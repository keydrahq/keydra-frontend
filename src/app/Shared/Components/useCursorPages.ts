import { useCallback, useState } from 'react';

export interface CursorPages {
  /** Which page is on screen, counting from one. For display only. */
  page: number;
  /** Where the current page resumes from, or undefined for the first one. */
  after: string | undefined;
  /** Whether going back is possible, which is simply whether this is not the first page. */
  canGoBack: boolean;
  /** Moves forward, remembering where this page ended so back can return to it. */
  forward: (endCursor: string | null) => void;
  /** Moves back one page. */
  back: () => void;
  /** Returns to the first page, for when a filter changes and the old positions mean nothing. */
  first: () => void;
}

/**
 * Paging by cursor while still showing somebody which page they are on.
 *
 * <p>A cursor says "carry on after this row" and nothing else — there is no such thing as jumping
 * to page seven, because page seven has no name until pages one to six have been read. That is the
 * trade cursors make, and it is the right one for lists that grow while they are being read: an
 * offset into the audit log is a position that has moved by the time it is used.
 *
 * <p>What makes going back possible is remembering where each page began. The stack holds one
 * cursor per page visited — the first being undefined, meaning the beginning — so going back is
 * dropping the last one rather than asking the server for a page before a cursor, which is a
 * second query shape for something the client already knows.
 *
 * <p>Changing a filter calls {@link CursorPages.first}: positions taken from a differently filtered
 * list do not resume anywhere sensible, and the server refuses them rather than guessing.
 */
export const useCursorPages = (): CursorPages => {
  const [visited, setVisited] = useState<(string | undefined)[]>([undefined]);

  const forward = useCallback((endCursor: string | null) => {
    if (!endCursor) {
      return;
    }
    setVisited((pages) => [...pages, endCursor]);
  }, []);

  const back = useCallback(() => {
    setVisited((pages) => (pages.length > 1 ? pages.slice(0, -1) : pages));
  }, []);

  const first = useCallback(() => setVisited([undefined]), []);

  return {
    page: visited.length,
    after: visited[visited.length - 1],
    canGoBack: visited.length > 1,
    forward,
    back,
    first,
  };
};
