import { useTranslation } from 'react-i18next';
import { GraphQLError } from '@app/Shared/Services/GraphQL.service';
import { useNotifications } from '@app/Shared/Components/notificationStore';

/**
 * What the server calls a refusal that is not one.
 *
 * <p>On a surface where every answer is 200, this is the only thing separating "recorded, and
 * waiting for somebody" from "that did not work". Matching on the sentence instead would be one
 * translation away from breaking, and the sentence is the part meant for a person.
 */
export const APPROVAL_REQUIRED = 'approval-required';

/** The server's sentence, when what came back was a recording rather than a failure. */
export const recordedInstead = (error: unknown): string | undefined =>
  error instanceof GraphQLError && error.is(APPROVAL_REQUIRED) ? error.message : undefined;

/**
 * Says so, when an operation was recorded instead of performed.
 *
 * <p>Shared by every page that can raise one, because they would otherwise each decide separately
 * whether this is bad news. It is not: the operation is arranged, somebody else has to agree, and
 * a red toast saying "purge failed" would be describing the guard as a fault.
 *
 * @returns whether this was a recording, so a caller can leave its own failure handling alone
 */
export const useRecordedNotice = (): ((error: unknown, andThen?: () => void) => boolean) => {
  const { t } = useTranslation('public');
  const { notify } = useNotifications();
  return (error: unknown, andThen?: () => void) => {
    const message = recordedInstead(error);
    if (message === undefined) {
      return false;
    }
    notify({
      title: t('Approvals.RECORDED'),
      description: message,
      variant: 'info',
    });
    andThen?.();
    return true;
  };
};
