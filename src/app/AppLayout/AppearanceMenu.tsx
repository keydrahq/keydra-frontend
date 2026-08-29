import type { FC } from 'react';
import { useState } from 'react';
import {
  Content,
  Divider,
  Dropdown,
  MenuToggle,
  ToggleGroup,
  ToggleGroupItem,
} from '@patternfly/react-core';
import type { MenuToggleElement } from '@patternfly/react-core';
import { MoonIcon, SunIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';
import { BrandTheme, ContrastSetting, ThemeSetting } from '@app/Shared/Services/service.types';
import { useAppearance } from '@app/utils/hooks/useAppearance';

/**
 * How the application looks, asked as the three questions PatternFly asks.
 *
 * <p>One control instead of the pair of sun/moon buttons that used to be here. The pair could
 * only ever say one thing, and there are three: which theme, which colour scheme, and how much
 * contrast. They are separate on purpose — somebody who needs more contrast needs it in both
 * schemes, and the theme is a matter of taste rather than of legibility.
 *
 * <p>Every option here is a PatternFly theme class. Nothing in this menu is a colour Keydra
 * chose: "Felt" is the theme PatternFly's own documentation site wears, which is where its red
 * and its pill-shaped controls come from.
 */
export const AppearanceMenu: FC = () => {
  const { t } = useTranslation();
  const { appearance, setScheme, setBrand, setContrast, isDark } = useAppearance();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dropdown
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      popperProps={{ position: 'right' }}
      toggle={(ref: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={ref}
          aria-label={t('AppLayout.APPEARANCE')}
          variant="plain"
          isExpanded={isOpen}
          onClick={() => setIsOpen(!isOpen)}
          icon={isDark ? <MoonIcon /> : <SunIcon />}
        />
      )}
    >
      <div className="pf-v6-u-px-md pf-v6-u-py-sm">
        <Content component="h6" className="pf-v6-u-mb-sm">
          {t('AppLayout.THEME')}
        </Content>
        <ToggleGroup aria-label={t('AppLayout.THEME')}>
          {Object.values(BrandTheme).map((option) => (
            <ToggleGroupItem
              key={option}
              text={t(`AppLayout.BRAND_${option}` as 'AppLayout.BRAND_default')}
              buttonId={`brand-${option}`}
              isSelected={appearance.brand === option}
              onChange={() => setBrand(option)}
            />
          ))}
        </ToggleGroup>

        <Divider className="pf-v6-u-my-md" />

        <Content component="h6" className="pf-v6-u-mb-sm">
          {t('AppLayout.COLOR_SCHEME')}
        </Content>
        <ToggleGroup aria-label={t('AppLayout.COLOR_SCHEME')}>
          {Object.values(ThemeSetting).map((option) => (
            <ToggleGroupItem
              key={option}
              text={t(`AppLayout.SCHEME_${option}` as 'AppLayout.SCHEME_auto')}
              buttonId={`scheme-${option}`}
              isSelected={appearance.scheme === option}
              onChange={() => setScheme(option)}
            />
          ))}
        </ToggleGroup>

        <Divider className="pf-v6-u-my-md" />

        <Content component="h6" className="pf-v6-u-mb-sm">
          {t('AppLayout.CONTRAST')}
        </Content>
        <ToggleGroup aria-label={t('AppLayout.CONTRAST')}>
          {Object.values(ContrastSetting).map((option) => (
            <ToggleGroupItem
              key={option}
              text={t(`AppLayout.CONTRAST_${option}` as 'AppLayout.CONTRAST_auto')}
              buttonId={`contrast-${option}`}
              isSelected={appearance.contrast === option}
              onChange={() => setContrast(option)}
            />
          ))}
        </ToggleGroup>
      </div>
    </Dropdown>
  );
};
