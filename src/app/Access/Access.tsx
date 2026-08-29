import type { FC } from 'react';
import { useState } from 'react';
import {
  Card,
  CardBody,
  PageSection,
  Tab,
  TabContent,
  TabContentBody,
  TabTitleText,
  Tabs,
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { Permission, useHoldsPermission } from '@app/Login/queries';
import { PageHeader } from '@app/Shared/Components/PageHeader';
import { useDocumentTitle } from '@app/utils/hooks/useDocumentTitle';
import { AccessMap } from './AccessMap';
import { GrantsTab } from './GrantsTab';
import { GroupsTab } from './GroupsTab';
import { ProvidersTab } from './ProvidersTab';
import { RolesTab } from './RolesTab';
import { ServerGroupsTab } from './ServerGroupsTab';
import { SignInTab } from './SignInTab';
import { UsersTab } from './UsersTab';

/**
 * Who may do what.
 *
 * <p>Six nouns behind one page, in the order somebody sets them up: the people, the groups they are
 * in, the sets of servers, the roles that name what can be done, the grants that join them, and the
 * places people arrive from. The map comes first because it is the one that answers the question
 * anybody actually arrives with — "how does this person reach that server?" — which none of the
 * others can be read off.
 *
 * <p>The tabs sit in their own page section below the header rather than inside the card, which is
 * PatternFly's anatomy for a page whose whole content is tabbed: primary tabs belong to the page,
 * `usePageInsets` lines them up with everything below, and each tab's content is then an ordinary
 * page section with a card in it. Nesting them inside the card instead made the tab bar look like a
 * control belonging to the table underneath it.
 */
export const Access: FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('Access.TITLE'));
  const [tab, setTab] = useState<string>('map');
  // Setting the terms everybody signs in under is its own permission, so the tab is only there
  // for somebody who holds it — a tab that answers 403 is worse than one that is not offered.
  const setsThePolicy = useHoldsPermission(Permission.PolicyManage);

  const tabs: { key: string; label: string; content: FC }[] = [
    { key: 'map', label: t('Access.MAP'), content: AccessMap },
    { key: 'users', label: t('Access.USERS'), content: UsersTab },
    { key: 'groups', label: t('Access.GROUPS'), content: GroupsTab },
    { key: 'server-groups', label: t('Access.SERVER_GROUPS'), content: ServerGroupsTab },
    { key: 'roles', label: t('Access.ROLES'), content: RolesTab },
    { key: 'grants', label: t('Access.GRANTS'), content: GrantsTab },
    { key: 'providers', label: t('Access.PROVIDERS'), content: ProvidersTab },
    ...(setsThePolicy ? [{ key: 'sign-in', label: t('Access.SIGN_IN'), content: SignInTab }] : []),
  ];

  const active = tabs.find((candidate) => candidate.key === tab) ?? tabs[0];
  const Content = active.content;

  return (
    <>
      <PageHeader title={t('Access.TITLE')} description={t('Access.INTRO')} />

      <PageSection type="tabs" hasBodyWrapper={false}>
        <Tabs
          activeKey={tab}
          onSelect={(_event, key) => setTab(String(key))}
          usePageInsets
          aria-label={t('Access.TITLE')}
        >
          {tabs.map((entry) => (
            <Tab
              key={entry.key}
              eventKey={entry.key}
              title={<TabTitleText>{entry.label}</TabTitleText>}
              tabContentId={`access-tab-${entry.key}`}
            />
          ))}
        </Tabs>
      </PageSection>

      <PageSection isFilled>
        <Card>
          <CardBody>
            {/* The content lives outside the tab list, so the tab bar spans the page while
                the panel it controls sits in a card like every other page's content. */}
            <TabContent id={`access-tab-${active.key}`} aria-label={active.label}>
              <TabContentBody>
                <Content />
              </TabContentBody>
            </TabContent>
          </CardBody>
        </Card>
      </PageSection>
    </>
  );
};
