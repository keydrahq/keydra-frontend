import type { FC } from 'react';
import { useState } from 'react';
import { Card, CardBody, PageSection, Tab, TabTitleText, Tabs } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { Permission, usePermissionCheck } from '@app/Login/queries';
import { PageHeader } from '@app/Shared/Components/PageHeader';
import { useDocumentTitle } from '@app/utils/hooks/useDocumentTitle';
import { DeliveriesTab } from './DeliveriesTab';
import { HistoryTab } from './HistoryTab';
import { RulesTab } from './RulesTab';

/**
 * Conditions worth being told about.
 *
 * <p>Three tabs in the order somebody sets them up: what to watch for, what has happened, and where
 * to send it. The rules come first because they are the point — the deliveries are optional, and a
 * rule with none still shows up here and in the notification drawer the moment it fires.
 *
 * <p>The last tab is for administrators, and hidden rather than disabled for everybody else:
 * choosing where a server's troubles get announced is a decision about Keydra rather than about the
 * server, and a tab that only ever answers "no" is a tab nobody should have to click.
 */
export const Alerts: FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('Alerts.TITLE'));
  // Deliberately not subscribing to the hub here: the layout already does, for every page, and
  // a second listener would announce every alert twice to whoever happened to be on this one.

  const holds = usePermissionCheck();
  const maySend = holds(Permission.AlertDeliveryManage);
  const [tab, setTab] = useState<string>('rules');

  const tabs: { key: string; label: string; content: FC }[] = [
    { key: 'rules', label: t('Alerts.RULES'), content: RulesTab },
    { key: 'history', label: t('Alerts.HISTORY'), content: HistoryTab },
    ...(maySend
      ? [{ key: 'deliveries', label: t('Alerts.DELIVERIES'), content: DeliveriesTab }]
      : []),
  ];

  const active = tabs.find((candidate) => candidate.key === tab) ?? tabs[0];
  const Content = active.content;

  return (
    <>
      <PageHeader title={t('Alerts.TITLE')} description={t('Alerts.DESCRIPTION')} />

      <PageSection type="tabs" hasBodyWrapper={false}>
        <Tabs
          activeKey={active.key}
          onSelect={(_event, key) => setTab(String(key))}
          usePageInsets
          aria-label={t('Alerts.TITLE')}
        >
          {tabs.map((entry) => (
            <Tab
              key={entry.key}
              eventKey={entry.key}
              title={<TabTitleText>{entry.label}</TabTitleText>}
            />
          ))}
        </Tabs>
      </PageSection>

      <PageSection isFilled>
        <Card isCompact>
          <CardBody>
            <Content />
          </CardBody>
        </Card>
      </PageSection>
    </>
  );
};
