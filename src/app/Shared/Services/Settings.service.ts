import {
  BrandTheme,
  ContrastSetting,
  isBrandTheme,
  isContrastSetting,
  isThemeSetting,
  ThemeSetting,
} from './service.types';

const THEME_KEY = 'keydra.theme';
const BRAND_KEY = 'keydra.brandTheme';
const CONTRAST_KEY = 'keydra.contrast';

/** User preferences persisted in localStorage. */
export class SettingsService {
  private readonly storage: Storage;

  constructor(storage: Storage = window.localStorage) {
    this.storage = storage;
  }

  theme(): ThemeSetting {
    const stored = this.storage.getItem(THEME_KEY);
    return isThemeSetting(stored) ? stored : ThemeSetting.Auto;
  }

  setTheme(theme: ThemeSetting): void {
    this.storage.setItem(THEME_KEY, theme);
  }

  brandTheme(): BrandTheme {
    const stored = this.storage.getItem(BRAND_KEY);
    return isBrandTheme(stored) ? stored : BrandTheme.Default;
  }

  setBrandTheme(theme: BrandTheme): void {
    this.storage.setItem(BRAND_KEY, theme);
  }

  contrast(): ContrastSetting {
    const stored = this.storage.getItem(CONTRAST_KEY);
    return isContrastSetting(stored) ? stored : ContrastSetting.Auto;
  }

  setContrast(contrast: ContrastSetting): void {
    this.storage.setItem(CONTRAST_KEY, contrast);
  }
}
