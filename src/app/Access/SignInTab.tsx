import type { FC } from 'react';
import { useState } from 'react';
import {
  Alert,
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Stack,
  StackItem,
  Switch,
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ConfirmDialog } from '@app/Shared/Components/ConfirmDialog';
import { ErrorView } from '@app/Shared/Components/ErrorView';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import { useRequireSecondFactor, useSignInPolicy } from './queries';

/**
 * What this instance asks of whoever signs in.
 *
 * <p>One switch so far, and the page around it is what makes the switch safe to press. Turning a
 * second factor on takes every role away from every local account that has not paired one until it
 * does, so the two things somebody needs before pressing it are how many accounts that is and
 * whether they are one of them.
 *
 * <p>The server refuses the second case outright — nobody may require a factor they do not have —
 * and this says so before the press rather than after it, because a refusal you could have been
 * warned about reads as a fault.
 */
export const SignInTab: FC = () => {
  const { t } = useTranslation();
  const policy = useSignInPolicy();
  const require = useRequireSecondFactor();
  const [confirming, setConfirming] = useState(false);

  if (policy.isPending) {
    return <LoadingView />;
  }
  if (policy.isError || !policy.data) {
    return <ErrorView title={t('Access.POLICY_FAILED')} message={policy.error?.message} />;
  }

  const { secondFactorRequired, accountsOwingAFactor, changedAt, changedBy } = policy.data;

  return (
    <Stack hasGutter>
      <StackItem>
        <Content component="p">{t('Access.POLICY_INTRO')}</Content>
      </StackItem>

      {require.isError ? (
        <StackItem>
          <Alert variant="danger" isInline component="h3" title={t('Access.POLICY_REFUSED')}>
            <Stack hasGutter>
              <StackItem>{require.error.message}</StackItem>
              <StackItem>
                <Link to="/settings">{t('Access.POLICY_PAIR_YOURS')}</Link>
              </StackItem>
            </Stack>
          </Alert>
        </StackItem>
      ) : null}

      <StackItem>
        <Switch
          id="require-second-factor"
          label={t('Access.REQUIRE_SECOND_FACTOR')}
          isChecked={secondFactorRequired}
          isDisabled={require.isPending}
          onChange={(_event, checked) => {
            if (checked) {
              setConfirming(true);
            } else {
              require.mutate(false);
            }
          }}
        />
      </StackItem>

      <StackItem>
        <Content component="small">{t('Access.REQUIRE_SECOND_FACTOR_HELP')}</Content>
      </StackItem>

      {/*
       * The number the page exists for. A warning rather than plain text when it is not zero,
       * because it is the count of people who will find the application empty on their next
       * request — and it is not an error, because it is also the point of turning this on.
       */}
      <StackItem>
        {accountsOwingAFactor > 0 ? (
          <Alert
            variant="warning"
            isInline
            isPlain
            component="h3"
            title={t('Access.POLICY_OWING', { count: accountsOwingAFactor })}
          >
            {t('Access.POLICY_OWING_BODY')}
          </Alert>
        ) : (
          <Alert
            variant="success"
            isInline
            isPlain
            component="h3"
            title={t('Access.POLICY_ALL_ENROLLED')}
          />
        )}
      </StackItem>

      {changedAt ? (
        <StackItem>
          <DescriptionList isHorizontal isCompact>
            <DescriptionListGroup>
              <DescriptionListTerm>{t('Access.POLICY_CHANGED')}</DescriptionListTerm>
              <DescriptionListDescription>
                {t('Access.POLICY_CHANGED_BY', {
                  who: changedBy ?? t('Access.POLICY_CHANGED_BY_NOBODY'),
                  when: new Date(changedAt).toLocaleString(),
                })}
              </DescriptionListDescription>
            </DescriptionListGroup>
          </DescriptionList>
        </StackItem>
      ) : null}

      <ConfirmDialog
        isOpen={confirming}
        title={t('Access.POLICY_CONFIRM_TITLE')}
        confirmLabel={t('Access.POLICY_CONFIRM')}
        isDestructive={accountsOwingAFactor > 0}
        onConfirm={() => {
          setConfirming(false);
          require.mutate(true);
        }}
        onCancel={() => setConfirming(false)}
      >
        {t('Access.POLICY_CONFIRM_BODY', { count: accountsOwingAFactor })}
      </ConfirmDialog>
    </Stack>
  );
};
