import type { FC } from 'react';
import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Content,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  LoginPage,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import { PasswordInput } from '@app/Shared/Components/PasswordInput';
import { i18nLanguages } from '@i18n/i18nextUtil';
import { LoginBackdrop } from './LoginBackdrop';
import { useAcceptInvitation, useInvitationStanding } from './queries';

/** Shorter than this and a password is a guess away; the backend refuses one too. */
const MINIMUM_PASSWORD = 12;

/**
 * The page a link leads to.
 *
 * <p>Outside the sign-in wall, necessarily: whoever follows the link has no account to authenticate
 * with yet, which is the entire point of the link.
 *
 * <p>It asks what the link is worth before offering a form. Somebody who followed a mail from last
 * month should be told the link has expired, not be asked to think of a password and only then be
 * refused.
 *
 * <p>It also reads its language off the link, because the letter that carried the link was written
 * in one and a page in another would be a seam. `?lang=` rather than the `?lng=` the detector
 * already claims: that one is cached, so following a link would change what language the whole
 * application speaks from then on. This changes one page, and once somebody signs in their own
 * preference is the answer.
 */
export const AcceptInvitation: FC = () => {
  const { t: detected, i18n } = useTranslation();
  const { token = '' } = useParams();
  const [search] = useSearchParams();
  const asked = search.get('lang') ?? '';
  const t = useMemo(
    () => (i18nLanguages.includes(asked) ? i18n.getFixedT(asked) : detected),
    [asked, i18n, detected],
  );
  const standing = useInvitationStanding(token);
  const accept = useAcceptInvitation(token);

  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');

  const tooShort = password.length > 0 && password.length < MINIMUM_PASSWORD;
  const mismatch = repeat.length > 0 && password !== repeat;
  const ready = password.length >= MINIMUM_PASSWORD && password === repeat;

  const frame = (children: React.ReactNode) => (
    <>
      <LoginBackdrop />
      <LoginPage
        loginTitle={t(
          standing.data?.purpose === 'RESET' ? 'Invitation.RESET_TITLE' : 'Invitation.TITLE',
        )}
        loginSubtitle={
          standing.data?.username
            ? t('Invitation.SUBTITLE', { username: standing.data.username })
            : undefined
        }
      >
        {children}
      </LoginPage>
    </>
  );

  if (standing.isPending) {
    return frame(<LoadingView />);
  }

  // Three refusals and three sentences. "This link has already been used" and "there is no
  // such link" send somebody to different places, and telling them apart costs one word.
  if (standing.isError || !standing.data?.usable) {
    const refusal = standing.data?.refusal ?? 'UNKNOWN';
    return frame(
      <Alert
        variant="warning"
        isInline
        title={t(`Invitation.REFUSED_${refusal}` as const)}
        component="h2"
      >
        <Content component="p">{t('Invitation.REFUSED_HELP')}</Content>
      </Alert>,
    );
  }

  if (accept.isSuccess) {
    return frame(
      <Stack hasGutter>
        <StackItem>
          <Alert variant="success" isInline title={t('Invitation.DONE')} component="h2" />
        </StackItem>
        <StackItem>
          {/* A navigation rather than a route change: the application behind the wall loads
              as somebody, and the surest way to be somebody is to have loaded as them. */}
          <Button variant="primary" component="a" href="/" isBlock>
            {t('Invitation.GO_TO_SIGN_IN')}
          </Button>
        </StackItem>
      </Stack>,
    );
  }

  return frame(
    <Form
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) {
          accept.mutate(password);
        }
      }}
    >
      <FormGroup label={t('Invitation.PASSWORD')} isRequired fieldId="invitation-password">
        <PasswordInput
          id="invitation-password"
          value={password}
          onChange={(_event, value) => setPassword(value)}
          validated={tooShort ? 'error' : 'default'}
        />
        <FormHelperText>
          <HelperText>
            <HelperTextItem variant={tooShort ? 'error' : 'default'}>
              {t('Invitation.PASSWORD_RULE', { count: MINIMUM_PASSWORD })}
            </HelperTextItem>
          </HelperText>
        </FormHelperText>
      </FormGroup>

      <FormGroup label={t('Invitation.REPEAT')} isRequired fieldId="invitation-repeat">
        <PasswordInput
          id="invitation-repeat"
          value={repeat}
          onChange={(_event, value) => setRepeat(value)}
          validated={mismatch ? 'error' : 'default'}
        />
        {mismatch && (
          <FormHelperText>
            <HelperText>
              <HelperTextItem variant="error" icon={<ExclamationCircleIcon />}>
                {t('Invitation.MISMATCH')}
              </HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}
      </FormGroup>

      {accept.isError && (
        <Alert variant="danger" isInline title={t('Invitation.FAILED')} component="h2" />
      )}

      <Button
        type="submit"
        variant="primary"
        isBlock
        isDisabled={!ready || accept.isPending}
        isLoading={accept.isPending}
      >
        {t('Invitation.SUBMIT')}
      </Button>
    </Form>,
  );
};
