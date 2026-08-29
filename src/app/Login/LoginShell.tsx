import type { FC, ReactNode } from 'react';
import { useState } from 'react';
import {
  Button,
  Content,
  Flex,
  FlexItem,
  FormSelect,
  FormSelectOption,
  List,
  ListItem,
  ListVariant,
  Login,
  LoginFooter,
  LoginFooterItem,
  LoginHeader,
  LoginMainBody,
  LoginMainFooter,
  LoginMainFooterBandItem,
  LoginMainHeader,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ToggleGroup,
  ToggleGroupItem,
} from '@patternfly/react-core';
import { MoonIcon, SunIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';
import { i18nLanguageNames, i18nLanguages } from '@i18n/i18nextUtil';
import { ThemeSetting } from '@app/Shared/Services/service.types';
import { useTheme } from '@app/utils/hooks/useTheme';
import { usePreference } from '@app/Settings/usePreference';
import { Wordmark } from '@app/Shared/Components/Wordmark';
import { LoginBackdrop } from './LoginBackdrop';

export interface LoginShellProps {
  title: string;
  subtitle?: string;
  /** The sentence in the band under the card, for pages that have one. */
  band?: string;
  children?: ReactNode;
}

/**
 * The page somebody sees before they are anybody.
 *
 * <p>Shared, because there is more than one thing that can be on it. The sign-in form is the
 * usual one; "Keydra could not be reached" is the other, and putting that on a bare white page
 * made an unreachable server look like a broken application — no wordmark, no way to change the
 * language, nothing to say which product had failed.
 *
 * <p>The language and theme controls belong here for the same reason they belong on the form:
 * somebody who cannot read this page has no way through it to the settings that would fix that,
 * and somebody who works in the dark should not have to pass through a white page to get there.
 */
export const LoginShell: FC<LoginShellProps> = ({ title, subtitle, band, children }) => {
  const { t } = useTranslation();

  return (
    <>
      <LoginBackdrop />
      {/*
        Composed from the pieces rather than using LoginPage, which is the same convenience
        wrapper around exactly these. The one thing it does not allow is a brand that is not an
        <img>, and the brand here has to be the application's own wordmark — the same component
        the masthead draws, in the same ink.

        That matters for more than consistency. The wordmark is drawn in `currentColor`, so it is
        right in every theme by construction; the two SVG files it replaces were picked by asking
        whether the colour scheme was dark, which is the question the masthead stopped asking
        because the page is drawn dark in more cases than that.
      */}
      <Login
        header={<LoginHeader headerBrand={<Wordmark height={LOGIN_WORDMARK_HEIGHT} />} />}
        footer={
          <LoginFooter>
            <p>{t('Login.PRODUCT_BLURB')}</p>
            <List variant={ListVariant.inline}>
              <FooterLinks />
            </List>
          </LoginFooter>
        }
      >
        <LoginMainHeader title={title} subtitle={subtitle} headerUtilities={<LoginPreferences />} />
        <LoginMainBody>{children}</LoginMainBody>
        {band && (
          <LoginMainFooter
            signUpForAccountMessage={<LoginMainFooterBandItem>{band}</LoginMainFooterBandItem>}
          />
        )}
      </Login>
    </>
  );
};

/**
 * How tall the wordmark is on the sign-in page.
 *
 * <p>Larger than in the masthead, and for the opposite reason: there the height is capped by a bar
 * built to hold other things, and here the mark is the only thing identifying what somebody is
 * about to sign in to. Still bounded by the viewport, so a short window does not push the form off
 * the bottom to make room for a logo.
 */
const LOGIN_WORDMARK_HEIGHT = 56;

/**
 * The two settings somebody might need before they can sign in.
 *
 * <p>Language, because whoever cannot read this page cannot reach the settings page to change
 * it; and the theme, because somebody who works in the dark should not have to pass through a
 * white page to get there. Both are kept in the browser, so both work before there is anybody
 * to keep them for.
 */
const LoginPreferences: FC = () => {
  const { t, i18n } = useTranslation();
  const [theme, setTheme] = useTheme();
  const [language, setLanguage] = usePreference('language', i18n.language);
  const dark = theme === ThemeSetting.Dark;

  return (
    // Flex rather than Split, because what these two need from a layout is vertical centring and
    // Split does not do it: it lays items out in a row and leaves them stretched, so a select and
    // a toggle group of different heights sit on different centre lines. The header row around
    // them is PatternFly's own grid and already centres and right-aligns the whole group.
    <Flex
      alignItems={{ default: 'alignItemsCenter' }}
      spaceItems={{ default: 'spaceItemsSm' }}
      flexWrap={{ default: 'nowrap' }}
    >
      <FlexItem>
        <FormSelect
          id="login-language"
          // Sized to its content. A select left to its own devices fills the column it is in,
          // which next to two icon buttons reads as one control that got away from the others.
          className="pf-v6-u-w-auto"
          value={language}
          aria-label={t('Settings.LANGUAGE')}
          onChange={(_event, value) => {
            setLanguage(value);
            void i18n.changeLanguage(value);
          }}
        >
          {i18nLanguages.map((code) => (
            <FormSelectOption key={code} value={code} label={i18nLanguageNames[code] ?? code} />
          ))}
        </FormSelect>
      </FlexItem>
      <FlexItem>
        {/* Not compact: a compact toggle group is shorter than a default select, and two controls
            of different heights beside each other is what made this look unaligned. */}
        <ToggleGroup aria-label={t('AppLayout.THEME')}>
          <ToggleGroupItem
            icon={<SunIcon />}
            aria-label={t('AppLayout.THEME_LIGHT')}
            buttonId="login-theme-light"
            isSelected={!dark}
            onChange={() => setTheme(ThemeSetting.Light)}
          />
          <ToggleGroupItem
            icon={<MoonIcon />}
            aria-label={t('AppLayout.THEME_DARK')}
            buttonId="login-theme-dark"
            isSelected={dark}
            onChange={() => setTheme(ThemeSetting.Dark)}
          />
        </ToggleGroup>
      </FlexItem>
    </Flex>
  );
};

/**
 * Where the documentation lives.
 *
 * <p>One named constant rather than a URL typed into a link, which is what made moving it a
 * one-line change when the site moved from keydra.github.io/keydra to its own repository.
 */
const DOCS_URL = 'https://keydrahq.github.io/docs/';

/**
 * The three links every login page has, and what each of them should actually do.
 *
 * <p>Terms and privacy open here, because they are about this instance and sending somebody
 * away from a login page to read two paragraphs loses whatever they had typed. Help leaves,
 * in a new tab, because it is a manual rather than a notice — somebody opens it to follow
 * along while they carry on doing what they were doing.
 */
const FooterLinks: FC = () => {
  const { t } = useTranslation();
  const [reading, setReading] = useState<'terms' | 'privacy' | undefined>();

  return (
    <>
      <ListItem>
        <LoginFooterItem
          href="#"
          onClick={(event: React.MouseEvent) => {
            event.preventDefault();
            setReading('terms');
          }}
        >
          {t('Login.TERMS')}
        </LoginFooterItem>
      </ListItem>
      <ListItem>
        <LoginFooterItem href={DOCS_URL} target="_blank" rel="noopener noreferrer">
          {t('Login.HELP')}
        </LoginFooterItem>
      </ListItem>
      <ListItem>
        <LoginFooterItem
          href="#"
          onClick={(event: React.MouseEvent) => {
            event.preventDefault();
            setReading('privacy');
          }}
        >
          {t('Login.PRIVACY')}
        </LoginFooterItem>
      </ListItem>

      {reading && (
        <Modal
          isOpen
          variant="small"
          onClose={() => setReading(undefined)}
          aria-label={t(reading === 'terms' ? 'Login.TERMS' : 'Login.PRIVACY')}
        >
          <ModalHeader title={t(reading === 'terms' ? 'Login.TERMS' : 'Login.PRIVACY')} />
          <ModalBody>
            <Content component="p">
              {t(reading === 'terms' ? 'Login.TERMS_BODY' : 'Login.PRIVACY_BODY')}
            </Content>
          </ModalBody>
          <ModalFooter>
            <Button variant="primary" onClick={() => setReading(undefined)}>
              {t('Login.CLOSE')}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
};

/** The providers an administrator has configured, under the password form. */
