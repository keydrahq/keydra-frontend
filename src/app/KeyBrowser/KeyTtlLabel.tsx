import type { FC } from 'react';
import { Label } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { NO_EXPIRY } from './types';

export interface KeyTtlLabelProps {
  ttl: number;
}

/** Formats seconds-to-expiry as something readable at a glance. */
const format = (ttl: number): string => {
  if (ttl < 60) {
    return `${ttl}s`;
  }
  if (ttl < 3600) {
    return `${Math.floor(ttl / 60)}m`;
  }
  if (ttl < 86400) {
    return `${Math.floor(ttl / 3600)}h`;
  }
  return `${Math.floor(ttl / 86400)}d`;
};

/** A key's time to live, or a plain dash when it has none. */
export const KeyTtlLabel: FC<KeyTtlLabelProps> = ({ ttl }) => {
  const { t } = useTranslation();

  if (ttl === NO_EXPIRY) {
    return <span aria-label={t('KeyBrowser.NO_EXPIRY')}>—</span>;
  }
  // Under a minute left is worth flagging: it may be gone before the user acts on it.
  return (
    <Label isCompact color={ttl < 60 ? 'red' : 'blue'}>
      {format(ttl)}
    </Label>
  );
};
