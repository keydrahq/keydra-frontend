import type { FC } from 'react';
import { useState } from 'react';
import { Alert, Button, Stack, StackItem } from '@patternfly/react-core';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import { RecoveryCodes, SecondFactorPairing } from '@app/Shared/Components/SecondFactorPairing';
/*
 * The pairing hooks live with the settings card that had them first. Imported rather than copied:
 * they are one surface — begin, then confirm — and a second copy would be a second cache key for
 * the same state, which is how a card and a wall end up disagreeing about whether a factor is on.
 */
import { useBeginSecondFactor, useConfirmSecondFactor } from '@app/Settings/secondFactor';
import { authQueryKey, useSignOut } from './queries';
import { LoginShell } from './LoginShell';

/**
 * The wall an instance that requires a second factor puts in front of an account with none.
 *
 * <p>Not a refusal at the password. Somebody who typed the right password and is told they may not
 * come in has nowhere to go, because the way out — pairing an authenticator — is something only a
 * signed-in account can do. So the sign-in succeeds, the session is real, and the server has taken
 * every role away from it: this is the page that says why, in place of an application in which
 * nothing works.
 *
 * <p>Three steps rather than two, and the third is not decoration. Confirming hands out ten
 * recovery codes that are shown once and cannot be shown again, so a wall that dropped somebody
 * into the application the moment their code was accepted would be a wall that ate them.
 */
export const EnrolSecondFactor: FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const begin = useBeginSecondFactor();
  const confirm = useConfirmSecondFactor();
  const signOut = useSignOut();
  const [started, setStarted] = useState(false);

  const codes = confirm.data?.codes;

  if (codes) {
    return (
      <LoginShell title={t('SecondFactor.REQUIRED_DONE_TITLE')}>
        <Stack hasGutter>
          <StackItem>
            <RecoveryCodes codes={codes} />
          </StackItem>
          <StackItem>
            <Button
              variant="primary"
              isBlock
              // Asking again is what lets the rest of the application in: the roles came back on
              // the server the moment the factor was confirmed, and this is the one question
              // everything else waits on.
              onClick={() => void queryClient.invalidateQueries({ queryKey: authQueryKey })}
            >
              {t('SecondFactor.REQUIRED_CONTINUE')}
            </Button>
          </StackItem>
        </Stack>
      </LoginShell>
    );
  }

  if (!started || begin.isPending) {
    return (
      <LoginShell
        title={t('SecondFactor.REQUIRED_TITLE')}
        subtitle={t('SecondFactor.REQUIRED_SUBTITLE')}
      >
        {begin.isPending ? (
          <LoadingView />
        ) : (
          <Stack hasGutter>
            <StackItem>
              <Alert
                variant="info"
                isInline
                isPlain
                component="h2"
                title={t('SecondFactor.REQUIRED_BODY')}
              />
            </StackItem>
            <StackItem>
              <Button
                variant="primary"
                isBlock
                onClick={() => {
                  setStarted(true);
                  begin.mutate();
                }}
              >
                {t('SecondFactor.TURN_ON')}
              </Button>
            </StackItem>
            <StackItem>
              {/* A way out that is not the application: somebody who cannot enrol right now
                  should be able to leave rather than close the tab on a page that refuses. */}
              <Button variant="link" isBlock isInline onClick={() => signOut.mutate()}>
                {t('SecondFactor.REQUIRED_SIGN_OUT')}
              </Button>
            </StackItem>
          </Stack>
        )}
      </LoginShell>
    );
  }

  if (!begin.data) {
    return (
      <LoginShell title={t('SecondFactor.REQUIRED_TITLE')}>
        <Alert variant="danger" isInline component="h2" title={t('SecondFactor.REQUIRED_FAILED')} />
      </LoginShell>
    );
  }

  return (
    <LoginShell
      title={t('SecondFactor.REQUIRED_TITLE')}
      subtitle={t('SecondFactor.REQUIRED_SUBTITLE')}
    >
      <SecondFactorPairing
        secret={begin.data.secret}
        uri={begin.data.uri}
        isConfirming={confirm.isPending}
        error={confirm.isError ? (confirm.error as Error).message : undefined}
        onConfirm={(code) => confirm.mutate(code)}
      />
    </LoginShell>
  );
};
