import type { FC } from 'react';
import { Bullseye, Spinner } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';

/** Centred spinner for pending server state. */
export const LoadingView: FC = () => {
  const { t } = useTranslation('common');
  return (
    <Bullseye>
      <Spinner aria-label={t('LOADING')} />
    </Bullseye>
  );
};
