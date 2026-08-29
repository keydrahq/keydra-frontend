import type { FC, ReactNode } from 'react';
import {
  Card,
  CardBody,
  CardTitle,
  Form,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  Grid,
  GridItem,
  HelperText,
  HelperTextItem,
  PageSection,
  ToggleGroup,
  ToggleGroupItem,
} from '@patternfly/react-core';
import { Switch } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { i18nLanguageNames, i18nLanguages } from '@i18n/i18nextUtil';
import { PageHeader } from '@app/Shared/Components/PageHeader';
import { BrandTheme, ContrastSetting, ThemeSetting } from '@app/Shared/Services/service.types';
import { useDocumentTitle } from '@app/utils/hooks/useDocumentTitle';
import { EncryptionCard } from './EncryptionCard';
import { SessionsCard } from './SessionsCard';
import { SignInActivityCard } from './SignInActivityCard';
import { useTheme } from '@app/utils/hooks/useTheme';
import { useAppearance } from '@app/utils/hooks/useAppearance';
import { usePreference } from './usePreference';
import { usePreferences } from './preferences';
import { SecondFactorCard } from './SecondFactorCard';

/**
 * One question with a row of answers, and a line saying what choosing does.
 *
 * <p>A toggle group rather than a column of radio buttons, which is what these were. Three of
 * them stacked came to nine radios down one side of the page — a wall to read through for three
 * decisions, and it pushed everything else off the fold. PatternFly's own documentation switches
 * its theme with exactly this control, and it is the right one here for the same reason: a short
 * set of mutually exclusive answers reads faster along a row than down a column.
 *
 * <p>The helper line is not decoration. A group offering "default", "high contrast" and "glass"
 * gives no reason to prefer any of them, and a preference nobody can reason about is one people
 * click through rather than set.
 */
const Choice: FC<{
  label: string;
  help: string;
  fieldId: string;
  children: ReactNode;
}> = ({ label, help, fieldId, children }) => (
  <FormGroup label={label} fieldId={fieldId}>
    <ToggleGroup aria-label={label} id={fieldId}>
      {children}
    </ToggleGroup>
    <FormHelperText>
      <HelperText>
        <HelperTextItem>{help}</HelperTextItem>
      </HelperText>
    </FormHelperText>
  </FormGroup>
);

/**
 * The preferences that follow a person rather than a target.
 *
 * <p>Everything here is held in the browser rather than on the server: none of it is about the
 * servers being managed, and a preference stored per account would have to be fetched before the
 * first page could be painted.
 */
export const Settings: FC = () => {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t('Settings.TITLE'));

  const [theme, setTheme] = useTheme();
  const { appearance, setBrand, setContrast } = useAppearance();
  // A preference like the others, so somebody who reads Keydra in Turkish reads it in Turkish on
  // the next machine too. i18next has its own browser detector, which is the fallback rather than
  // the answer: it knows what a browser is set to and not what a person chose.
  const [language, setLanguage] = usePreference('language', i18n.resolvedLanguage ?? 'en');
  const [confirmDestructive, setConfirmDestructive] = usePreference(
    'keydra.confirmDestructive',
    true,
  );
  const [pageSize, setPageSize] = usePreference('keydra.pageSize', 200);
  const preferences = usePreferences();

  return (
    <>
      {/*
       * Which sentence is true depends on whether there is an account to keep them with, and
       * saying the wrong one is worse than saying neither: somebody who is told their settings
       * follow them, and then finds they did not, has been misled by the page that promised it.
       */}
      <PageHeader
        title={t('Settings.TITLE')}
        description={t(
          preferences.data?.stored ? 'Settings.DESCRIPTION' : 'Settings.DESCRIPTION_LOCAL',
        )}
      />
      <PageSection isFilled isWidthLimited>
        <Grid hasGutter>
          {/* Appearance takes the full width rather than half of it. Three rows of toggles are
              wider than they are tall, and squeezing them into a column made every group wrap. */}
          <GridItem span={12}>
            <Card isCompact>
              <CardTitle>{t('Settings.APPEARANCE')}</CardTitle>
              <CardBody>
                <Grid hasGutter>
                  {/* Spans chosen by how wide each control actually is rather than by dividing
                      the row evenly: three answers, two answers, four answers and a select do
                      not want the same width, and an even split wrapped the widest group. */}
                  <GridItem md={6} lg={3}>
                    <Form>
                      {/* Named "colour scheme" rather than "theme", which is what it used to say
                          — directly above a second group also labelled "theme". Two controls with
                          one name is not a naming problem, it is two controls nobody can tell
                          apart. */}
                      <Choice
                        label={t('Settings.COLOUR_SCHEME')}
                        help={t('Settings.COLOUR_SCHEME_HELP')}
                        fieldId="colour-scheme"
                      >
                        {Object.values(ThemeSetting).map((option) => (
                          <ToggleGroupItem
                            key={option}
                            text={t(`Settings.THEME_${option}` as 'Settings.THEME_auto')}
                            buttonId={`theme-${option}`}
                            isSelected={theme === option}
                            onChange={() => setTheme(option)}
                          />
                        ))}
                      </Choice>
                    </Form>
                  </GridItem>

                  <GridItem md={6} lg={2}>
                    <Form>
                      <Choice
                        label={t('AppLayout.THEME')}
                        help={t('Settings.THEME_HELP')}
                        fieldId="brand-theme"
                      >
                        {Object.values(BrandTheme).map((option) => (
                          <ToggleGroupItem
                            key={option}
                            text={t(`AppLayout.BRAND_${option}` as 'AppLayout.BRAND_default')}
                            buttonId={`brand-theme-${option}`}
                            isSelected={appearance.brand === option}
                            onChange={() => setBrand(option)}
                          />
                        ))}
                      </Choice>
                    </Form>
                  </GridItem>

                  <GridItem md={6} lg={4}>
                    <Form>
                      {/* "Contrast and surface", because one of the four answers is glass, and
                          glass is not a contrast level. A group named after only half of what it
                          offers is how "glass" ended up filed under accessibility. */}
                      <Choice
                        label={t('Settings.SURFACE')}
                        help={t('Settings.SURFACE_HELP')}
                        fieldId="contrast"
                      >
                        {Object.values(ContrastSetting).map((option) => (
                          <ToggleGroupItem
                            key={option}
                            text={t(`AppLayout.CONTRAST_${option}` as 'AppLayout.CONTRAST_auto')}
                            buttonId={`contrast-${option}`}
                            isSelected={appearance.contrast === option}
                            onChange={() => setContrast(option)}
                          />
                        ))}
                      </Choice>
                    </Form>
                  </GridItem>

                  {/* Language belongs here, not under key browsing, which is where it had
                      drifted: what language the interface speaks is not a scanning preference. */}
                  <GridItem md={6} lg={3}>
                    <Form>
                      <FormGroup label={t('Settings.LANGUAGE')} fieldId="language">
                        <FormSelect
                          id="language"
                          value={language}
                          aria-label={t('Settings.LANGUAGE')}
                          onChange={(_event, value) => {
                            setLanguage(value);
                            void i18n.changeLanguage(value);
                          }}
                        >
                          {i18nLanguages.map((code) => (
                            <FormSelectOption
                              key={code}
                              value={code}
                              label={i18nLanguageNames[code] ?? code}
                            />
                          ))}
                        </FormSelect>
                        <FormHelperText>
                          <HelperText>
                            <HelperTextItem>{t('Settings.LANGUAGE_HELP')}</HelperTextItem>
                          </HelperText>
                        </FormHelperText>
                      </FormGroup>
                    </Form>
                  </GridItem>
                </Grid>
              </CardBody>
            </Card>
          </GridItem>

          <GridItem lg={6}>
            <Card isCompact isFullHeight>
              <CardTitle>{t('Settings.BROWSING')}</CardTitle>
              <CardBody>
                <Form>
                  <FormGroup label={t('Settings.PAGE_SIZE')} fieldId="page-size">
                    <FormSelect
                      id="page-size"
                      value={String(pageSize)}
                      aria-label={t('Settings.PAGE_SIZE')}
                      onChange={(_event, value) => setPageSize(Number(value))}
                    >
                      {[100, 200, 500, 1000].map((size) => (
                        <FormSelectOption key={size} value={size} label={String(size)} />
                      ))}
                    </FormSelect>
                    <FormHelperText>
                      <HelperText>
                        <HelperTextItem>{t('Settings.PAGE_SIZE_HELP')}</HelperTextItem>
                      </HelperText>
                    </FormHelperText>
                  </FormGroup>

                  <FormGroup fieldId="confirm-destructive">
                    <Switch
                      id="confirm-destructive"
                      label={t('Settings.CONFIRM_DESTRUCTIVE')}
                      isChecked={confirmDestructive}
                      onChange={(_event, checked) => setConfirmDestructive(checked)}
                    />
                    {/* PatternFly's own helper text rather than a styled div, which is what this
                        was: the same words, but now they carry the association a screen reader
                        needs to read them with the control. */}
                    <FormHelperText>
                      <HelperText>
                        <HelperTextItem>{t('Settings.CONFIRM_DESTRUCTIVE_HELP')}</HelperTextItem>
                      </HelperText>
                    </FormHelperText>
                  </FormGroup>
                </Form>
              </CardBody>
            </Card>
          </GridItem>

          <GridItem lg={6}>
            <EncryptionCard />
          </GridItem>

          {/* Above the sessions, because it is about what it takes to make one. A page that
              listed the browsers you are signed in on before saying how somebody signs in has the
              order of the story backwards. */}
          <GridItem span={12}>
            <SecondFactorCard />
          </GridItem>

          {/* Your own sessions, not an administrator's view of somebody's: what a person's
              sessions say is where they work and when. */}
          <GridItem span={12}>
            <SessionsCard />
          </GridItem>

          {/* Below the sessions and about the same thing from the other end. The sessions say
              which browsers can act as you now; this says how each of them got there, including
              the attempts that did not. Yours as well, for the same reason. */}
          <GridItem span={12}>
            <SignInActivityCard />
          </GridItem>
        </Grid>
      </PageSection>
    </>
  );
};
