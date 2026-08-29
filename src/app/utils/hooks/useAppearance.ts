import { useEffect } from 'react';
import { usePreference } from '@app/Settings/preferences';
import { BrandTheme, ContrastSetting, ThemeSetting } from '@app/Shared/Services/service.types';

/**
 * PatternFly's own theme classes.
 *
 * <p>All four ship inside PatternFly 6 and none of them is Keydra's invention — which is worth
 * knowing, because `felt` is the theme PatternFly's own documentation site wears. What looks
 * like "PatternFly is red with pill-shaped buttons" is that class; a default PatternFly
 * application is blue and square, and both are PatternFly.
 */
const CLASS = {
  dark: 'pf-v6-theme-dark',
  felt: 'pf-v6-theme-felt',
  high: 'pf-v6-theme-high-contrast',
  glass: 'pf-v6-theme-glass',
} as const;

const prefersDark = (): boolean =>
  window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

const prefersContrast = (): boolean =>
  window.matchMedia?.('(prefers-contrast: more)').matches ?? false;

export const isDarkScheme = (scheme: ThemeSetting): boolean =>
  scheme === ThemeSetting.Dark || (scheme === ThemeSetting.Auto && prefersDark());

/** What somebody has chosen about how the application looks. */
export interface Appearance {
  scheme: ThemeSetting;
  brand: BrandTheme;
  contrast: ContrastSetting;
}

export interface AppearanceControls {
  appearance: Appearance;
  setScheme: (scheme: ThemeSetting) => void;
  setBrand: (brand: BrandTheme) => void;
  setContrast: (contrast: ContrastSetting) => void;
  /** True when the dark theme is actually on, whether it was chosen or inherited. */
  isDark: boolean;
}

/**
 * Reads what somebody chose about the look, and keeps the document's classes in step with it.
 *
 * <p>Three separate questions rather than one list of themes, which is how PatternFly's own site
 * asks them: the colour scheme, the theme, and the contrast are chosen for different reasons by
 * different people — somebody who needs more contrast needs it in both schemes.
 */
export const useAppearance = (): AppearanceControls => {
  /*
   * Through the preference hook, so the look follows the person rather than the browser: sign in
   * on a second machine and it is the theme you chose, not the default. The browser's own copy is
   * still what the first paint uses — a round trip cannot happen before it — and the account's
   * replaces it a moment later, which is the one case where the page may change colour once.
   */
  const [scheme, setScheme] = usePreference<ThemeSetting>('keydra.theme', ThemeSetting.Auto);
  const [brand, setBrand] = usePreference<BrandTheme>('keydra.brandTheme', BrandTheme.Default);
  const [contrast, setContrast] = usePreference<ContrastSetting>(
    'keydra.contrast',
    ContrastSetting.Auto,
  );
  const appearance: Appearance = { scheme, brand, contrast };

  const dark = isDarkScheme(appearance.scheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle(CLASS.dark, dark);
    root.classList.toggle(CLASS.felt, appearance.brand === BrandTheme.Felt);
    root.classList.toggle(
      CLASS.high,
      appearance.contrast === ContrastSetting.High ||
        (appearance.contrast === ContrastSetting.Auto && prefersContrast()),
    );
    root.classList.toggle(CLASS.glass, appearance.contrast === ContrastSetting.Glass);
  }, [dark, appearance.brand, appearance.contrast]);

  return { appearance, setScheme, setBrand, setContrast, isDark: dark };
};
