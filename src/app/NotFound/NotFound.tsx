import type { FC } from 'react';
import {
  Button,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  PageSection,
} from '@patternfly/react-core';
import { ExclamationTriangleIcon } from '@patternfly/react-icons';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@app/utils/hooks/useDocumentTitle';

export const NotFound: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useDocumentTitle(t('NotFound.TITLE'));

  return (
    <PageSection>
      <EmptyState
        status="warning"
        titleText={t('NotFound.TITLE')}
        icon={ExclamationTriangleIcon}
        headingLevel="h1"
      >
        <EmptyStateBody>{t('NotFound.DESCRIPTION')}</EmptyStateBody>
        <EmptyStateFooter>
          <EmptyStateActions>
            <Button variant="primary" onClick={() => void navigate('/')}>
              {t('NotFound.BACK_HOME')}
            </Button>
          </EmptyStateActions>
        </EmptyStateFooter>
      </EmptyState>
    </PageSection>
  );
};
