import type { FC } from 'react';
import {
  Button,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  ExpandableSection,
} from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';
import { describeFailure } from './describeFailure';

export interface ErrorViewProps {
  title: string;
  /** The failure itself, so the wording can be chosen from what actually happened. */
  failure?: unknown;
  /**
   * A line the caller adds.
   *
   * <p>Alongside the failure's own sentence rather than instead of it, when both are given: what
   * went wrong is the same wherever it happens, but what happens next can be particular to the
   * screen — "this page continues on its own" is true here and nowhere else.
   */
  message?: string;
  onRetry?: () => void;
}

/**
 * Uniform failure state for any view whose data could not be loaded.
 *
 * <p>Two lines, in the order PatternFly asks for: what happened, then what to do about it. What
 * used to be here was the exception's own words — "Request to /graphql failed: 500 Internal Server
 * Error" — which names an internal path, quotes a status code and offers nothing to act on.
 *
 * <p>The technical text is not thrown away, only moved. It sits behind a disclosure below the
 * sentence, because the person who needs "500" is not the person reading the first line, and the
 * first line is the one everybody reads.
 *
 * <p>The retry button appears only when trying again could work. Offering it after "you do not have
 * permission" is offering somebody a button that cannot help them.
 */
export const ErrorView: FC<ErrorViewProps> = ({ title, failure, message, onRetry }) => {
  const { t } = useTranslation();
  const { t: common } = useTranslation('common');

  const described = failure === undefined ? undefined : describeFailure(failure, t);
  const body = described?.body ?? message;
  const alsoSay = described && message && message !== body ? message : undefined;
  const detail = described?.detail;
  const worthRetrying = described?.worthRetrying ?? true;

  return (
    <EmptyState status="danger" titleText={title} icon={ExclamationCircleIcon} headingLevel="h2">
      {body ? <EmptyStateBody>{body}</EmptyStateBody> : null}
      {alsoSay ? <EmptyStateBody>{alsoSay}</EmptyStateBody> : null}
      {detail && detail !== body ? (
        <EmptyStateBody>
          <ExpandableSection toggleText={t('Failure.DETAIL')}>
            <code className="pf-v6-u-font-size-sm">{detail}</code>
          </ExpandableSection>
        </EmptyStateBody>
      ) : null}
      {onRetry && worthRetrying ? (
        <EmptyStateFooter>
          <EmptyStateActions>
            <Button variant="primary" onClick={onRetry}>
              {common('RETRY')}
            </Button>
          </EmptyStateActions>
        </EmptyStateFooter>
      ) : null}
    </EmptyState>
  );
};
