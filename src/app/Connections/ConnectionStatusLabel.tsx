import type { FC } from 'react';
import { Label, Spinner, Tooltip } from '@patternfly/react-core';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  QuestionCircleIcon,
} from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';
import type { ConnectionStatus } from '@app/Shared/Services/api.types';
import { ConnectionState } from '@app/Shared/Services/api.types';

export interface ConnectionStatusLabelProps {
  status: ConnectionStatus;
}

/** Renders one profile's health as a PatternFly status label. */
export const ConnectionStatusLabel: FC<ConnectionStatusLabelProps> = ({ status }) => {
  const { t } = useTranslation();

  const label = (() => {
    switch (status.state) {
      case ConnectionState.Up:
        return (
          <Label color="green" icon={<CheckCircleIcon />}>
            {t('Connections.STATE_UP')}
          </Label>
        );
      case ConnectionState.Down:
        return (
          <Label color="red" icon={<ExclamationCircleIcon />}>
            {t('Connections.STATE_DOWN')}
          </Label>
        );
      case ConnectionState.Connecting:
        return (
          // A spinner rather than a static icon: this is the one state that is going to
          // change on its own, and something that says "checking" while standing perfectly
          // still reads as something that has stopped.
          <Label
            color="blue"
            icon={<Spinner size="sm" aria-valuetext={t('Connections.STATE_CONNECTING')} />}
          >
            {t('Connections.STATE_CONNECTING')}
          </Label>
        );
      default:
        return (
          <Label color="grey" icon={<QuestionCircleIcon />}>
            {t('Connections.STATE_UNKNOWN')}
          </Label>
        );
    }
  })();

  // The failure reason is the useful part when a target is down, but it is far too
  // long for a table cell, so it lives in a tooltip.
  return status.message ? <Tooltip content={status.message}>{label}</Tooltip> : label;
};
