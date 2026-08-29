import type { FC } from 'react';
import { useState } from 'react';
import { Dropdown, DropdownItem, DropdownList, MenuToggle } from '@patternfly/react-core';
import type { MenuToggleElement } from '@patternfly/react-core';
import { GlobeIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';
import { i18nLanguageNames, i18nLanguages } from '@i18n/i18nextUtil';
import { usePreference } from '@app/Settings/usePreference';

/**
 * Which language the interface speaks, in the masthead.
 *
 * <p>Here as well as in the settings page, and the reason is who needs it. Somebody who can read
 * the page can find the settings; somebody who cannot is the person this is for, and asking them
 * to navigate a page they cannot read in order to change the language they cannot read it in is a
 * loop. The login page has had one for exactly this reason since it was written.
 *
 * <p>The same preference the settings page writes, so the two cannot disagree and so the choice
 * follows the account rather than the browser. Each language is named in its own language, which
 * is the only labelling somebody looking for theirs can use.
 */
export const LanguageMenu: FC = () => {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [language, setLanguage] = usePreference('language', i18n.resolvedLanguage ?? 'en');

  const choose = (code: string) => {
    setLanguage(code);
    void i18n.changeLanguage(code);
    setIsOpen(false);
  };

  return (
    <Dropdown
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      popperProps={{ position: 'right' }}
      toggle={(ref: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={ref}
          aria-label={t('AppLayout.LANGUAGE')}
          variant="plain"
          isExpanded={isOpen}
          onClick={() => setIsOpen(!isOpen)}
          icon={<GlobeIcon />}
        />
      )}
    >
      <DropdownList>
        {i18nLanguages.map((code) => (
          <DropdownItem
            key={code}
            isSelected={language === code}
            onClick={() => choose(code)}
            // In its own language: a person looking for Turkish is looking for "Türkçe", and a
            // list that said "Turkish" in English would be a list they have to already read
            // English to use.
            lang={code}
          >
            {i18nLanguageNames[code] ?? code}
          </DropdownItem>
        ))}
      </DropdownList>
    </Dropdown>
  );
};
