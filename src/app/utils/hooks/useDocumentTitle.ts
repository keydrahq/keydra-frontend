import { useEffect } from 'react';

const BASE_TITLE = 'Keydra';

/** Sets `document.title` for the active route and restores it on unmount. */
export const useDocumentTitle = (title?: string): void => {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} | ${BASE_TITLE}` : BASE_TITLE;
    return () => {
      document.title = previous;
    };
  }, [title]);
};
