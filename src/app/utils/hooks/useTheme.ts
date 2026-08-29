import { useAppearance } from './useAppearance';
import type { ThemeSetting } from '@app/Shared/Services/service.types';

/**
 * The colour scheme alone, for the places that only ask about that.
 *
 * <p>A thin reading of {@link useAppearance}, which is where the document's theme classes are
 * actually kept in step. Two hooks writing the same classes would be two answers to one
 * question; this one only ever passes the question along.
 */
export const useTheme = (): [ThemeSetting, (theme: ThemeSetting) => void] => {
  const { appearance, setScheme } = useAppearance();
  return [appearance.scheme, setScheme];
};
