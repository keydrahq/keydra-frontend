import type { FC } from 'react';
import { useContext } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Label,
  Spinner,
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { Permission, useHoldsPermission } from '@app/Login/queries';
import { useNotifications } from '@app/Shared/Components/notificationStore';
import { ServiceContext } from '@app/Shared/Services/Services';

/** Which key the stored secrets are under, mirroring io.keydra.security.dto. */
interface RotationStatus {
  currentKeyId: string;
  onCurrentKey: number;
  onOtherKeys: number;
}

interface RotationResult {
  currentKeyId: string;
  rotated: number;
}

/**
 * The key that protects every stored credential, and moving off it.
 *
 * <p>A key that cannot be rotated is a key nobody rotates, which after the first person leaves is
 * the same as not having one. The whole procedure is three steps and the instance stays up for all
 * of them; this is the middle one, and the two counts around it are what say whether it is needed
 * and whether it worked.
 */
const STATUS = `
  query EncryptionStatus {
    encryptionStatus {
      currentKeyId
      onCurrentKey
      onOtherKeys
    }
  }
`;

const REENCRYPT = `
  mutation ReencryptSecrets {
    reencryptSecrets {
      currentKeyId
      rotated
    }
  }
`;

export const EncryptionCard: FC = () => {
  const { t } = useTranslation();
  const { graphql } = useContext(ServiceContext);
  const { notify } = useNotifications();
  const queryClient = useQueryClient();
  const mayRotate = useHoldsPermission(Permission.CryptoRotate);

  const status = useQuery({
    queryKey: ['encryption'],
    queryFn: () =>
      graphql
        .query<{ encryptionStatus: RotationStatus }>(STATUS)
        .then((answer) => answer.encryptionStatus),
    enabled: mayRotate,
    retry: false,
  });

  const rotate = useMutation({
    mutationFn: () =>
      graphql
        .query<{ reencryptSecrets: RotationResult }>(REENCRYPT)
        .then((answer) => answer.reencryptSecrets),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['encryption'] });
      notify({
        title: t('Settings.ROTATED'),
        description: t('Settings.ROTATED_BODY', {
          count: result.rotated,
          key: result.currentKeyId,
        }),
        variant: 'success',
      });
    },
    onError: (error: Error) =>
      notify({
        title: t('Settings.ROTATE_FAILED'),
        description: error.message,
        variant: 'danger',
      }),
  });

  if (!mayRotate) {
    return null;
  }

  const elsewhere = status.data?.onOtherKeys ?? 0;

  return (
    <Card isCompact isFullHeight>
      <CardTitle>{t('Settings.ENCRYPTION')}</CardTitle>
      <CardBody>
        <DescriptionList isHorizontal isCompact>
          <DescriptionListGroup>
            <DescriptionListTerm>{t('Settings.CURRENT_KEY')}</DescriptionListTerm>
            <DescriptionListDescription>
              {status.isPending ? <Spinner size="sm" /> : <code>{status.data?.currentKeyId}</code>}
            </DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>{t('Settings.STORED_SECRETS')}</DescriptionListTerm>
            <DescriptionListDescription>
              {t('Settings.ON_CURRENT', { count: status.data?.onCurrentKey ?? 0 })}
              {elsewhere > 0 && (
                <Label isCompact color="orange">
                  {t('Settings.ON_OTHERS', { count: elsewhere })}
                </Label>
              )}
            </DescriptionListDescription>
          </DescriptionListGroup>
        </DescriptionList>

        {elsewhere > 0 ? (
          <Alert
            variant="warning"
            isInline
            isPlain
            component="h3"
            title={t('Settings.ROTATION_PENDING')}
          >
            {t('Settings.ROTATION_PENDING_BODY')}
          </Alert>
        ) : (
          <Alert variant="info" isInline isPlain component="h3" title={t('Settings.ROTATION_HOW')}>
            {t('Settings.ROTATION_HOW_BODY')}
          </Alert>
        )}

        <Button
          variant={elsewhere > 0 ? 'primary' : 'secondary'}
          isDisabled={rotate.isPending || status.isPending}
          isLoading={rotate.isPending}
          onClick={() => rotate.mutate()}
        >
          {t('Settings.ROTATE')}
        </Button>
      </CardBody>
    </Card>
  );
};
