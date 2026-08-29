/** Types shared across the service layer. */

/** Injectable fetch, so tests can substitute a stub without touching globals. */
export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Theme preference. Declared as a const object rather than an enum because the
 * TypeScript config enables `erasableSyntaxOnly`.
 */
export const ThemeSetting = {
  Auto: 'auto',
  Light: 'light',
  Dark: 'dark',
} as const;

export type ThemeSetting = (typeof ThemeSetting)[keyof typeof ThemeSetting];

export const isThemeSetting = (value: unknown): value is ThemeSetting =>
  value === ThemeSetting.Auto || value === ThemeSetting.Light || value === ThemeSetting.Dark;

/**
 * Which of PatternFly's themes the application wears.
 *
 * <p>Both of these ship inside PatternFly 6 — `felt` is the one its own documentation site
 * wears, which is why that site looks red and pill-shaped while a default PatternFly
 * application looks blue and square. Nothing here is a colour Keydra invented.
 */
export const BrandTheme = {
  Default: 'default',
  Felt: 'felt',
} as const;

export type BrandTheme = (typeof BrandTheme)[keyof typeof BrandTheme];

export const isBrandTheme = (value: unknown): value is BrandTheme =>
  value === BrandTheme.Default || value === BrandTheme.Felt;

/**
 * How much contrast to draw with.
 *
 * <p>`Auto` follows the operating system's own "increase contrast" setting, which is the answer
 * for the people the high-contrast theme exists for: somebody who has already asked their
 * machine for more contrast should not have to ask every application separately.
 */
export const ContrastSetting = {
  Auto: 'auto',
  Default: 'default',
  High: 'high',
  Glass: 'glass',
} as const;

export type ContrastSetting = (typeof ContrastSetting)[keyof typeof ContrastSetting];

export const isContrastSetting = (value: unknown): value is ContrastSetting =>
  value === ContrastSetting.Auto ||
  value === ContrastSetting.Default ||
  value === ContrastSetting.High ||
  value === ContrastSetting.Glass;
