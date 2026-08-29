import type { FC } from 'react';
import { Label } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import type { ConnectionStatus } from '@app/Shared/Services/api.types';
import { ConnectionState } from '@app/Shared/Services/api.types';
import { serverName } from './serverLogo';

export interface ServerFlavorLabelProps {
  status: ConnectionStatus;
}

/**
 * Shows the detected server flavor and version.
 *
 * <p>Takes the whole status rather than just the server so the cell can say "checking" while a
 * probe is in flight. Claiming "not detected yet" during an active check contradicts the status
 * column sitting right next to it.
 */
export const ServerFlavorLabel: FC<ServerFlavorLabelProps> = ({ status }) => {
  const { t } = useTranslation();

  if (!status.server) {
    return (
      <span>
        {status.state === ConnectionState.Connecting
          ? t('Connections.DETECTING')
          : t('Connections.NOT_DETECTED')}
      </span>
    );
  }

  const { flavor, version } = status.server;
  const color = flavor === 'valkey' ? 'purple' : flavor === 'redis' ? 'orange' : 'grey';
  const name = serverName(flavor);
  return (
    <Label color={color} isCompact>
      {version ? `${name} ${version}` : name}
    </Label>
  );
};
