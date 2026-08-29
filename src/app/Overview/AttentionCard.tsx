import type { FC } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardTitle,
  EmptyState,
  EmptyStateBody,
  Icon,
  Label,
  Timestamp,
} from '@patternfly/react-core';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
} from '@patternfly/react-icons';
import { Table, Tbody, Td, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { RouterLink } from '@app/Shared/Components/RouterLink';
import { Urgency } from './useAttention';
import type { Attention } from './useAttention';

/**
 * What is wrong, in one place.
 *
 * <p>First on the page, above the figures, because a dashboard is read in the order things
 * matter: somebody who arrives to find a target unreachable does not need to be told how many
 * keys the others are holding first.
 *
 * <p>Says so plainly when there is nothing — an empty list and a healthy fleet look identical
 * otherwise, and one of them is worth knowing.
 */
export const AttentionCard: FC<{ items: Attention[] }> = ({ items }) => {
  const { t } = useTranslation();

  return (
    <Card isCompact isFullHeight>
      <CardTitle>{t('Overview.ATTENTION')}</CardTitle>
      <CardBody>
        {items.length === 0 ? (
          <EmptyState
            titleText={t('Overview.ATTENTION_NONE')}
            icon={CheckCircleIcon}
            status="success"
            headingLevel="h3"
            variant="sm"
          >
            <EmptyStateBody>{t('Overview.ATTENTION_NONE_BODY')}</EmptyStateBody>
          </EmptyState>
        ) : (
          <Table aria-label={t('Overview.ATTENTION')} variant="compact" borders={false}>
            <Tbody>
              {items.map((item) => (
                <Tr key={item.id}>
                  <Td width={10}>
                    <Icon status={item.urgency === Urgency.Danger ? 'danger' : 'warning'}>
                      {item.urgency === Urgency.Danger ? (
                        <ExclamationCircleIcon />
                      ) : (
                        <ExclamationTriangleIcon />
                      )}
                    </Icon>
                  </Td>
                  <Td>
                    {item.title}
                    {item.count && item.count > 1 ? (
                      <Label isCompact className="pf-v6-u-ml-sm">
                        {t('Overview.ATTENTION_AND_MORE', { count: item.count - 1 })}
                      </Label>
                    ) : null}
                  </Td>
                  <Td>
                    <Label isCompact variant="outline">
                      {item.subject}
                    </Label>
                  </Td>
                  <Td width={20}>
                    {item.at ? (
                      <Timestamp date={new Date(item.at)} dateFormat="short" timeFormat="short" />
                    ) : null}
                  </Td>
                  <Td isActionCell>
                    <Button variant="link" isInline component={RouterLink} href={item.href}>
                      {t('Overview.OPEN')}
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
};
