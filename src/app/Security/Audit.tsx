import type { FC } from 'react';
import { useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  EmptyState,
  EmptyStateBody,
  FormSelect,
  FormSelectOption,
  Label,
  PageSection,
  Pagination,
  SearchInput,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from '@patternfly/react-core';
import { Tooltip } from '@patternfly/react-core';
import { HistoryIcon } from '@patternfly/react-icons';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { ErrorView } from '@app/Shared/Components/ErrorView';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import { useDocumentTitle } from '@app/utils/hooks/useDocumentTitle';
import { describeAction } from './auditActions';
import { useAuditPage } from './queries';
import { useCursorPages } from '@app/Shared/Components/useCursorPages';
import { PageHeader } from '@app/Shared/Components/PageHeader';

/**
 * What has been done, and by whom.
 *
 * <p>Records changes, not reads: a log of every page view buries the four entries a month that
 * somebody will actually come looking for. Failed attempts are here too — a refused delete is
 * often the more interesting record.
 */
export const Audit: FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('Audit.TITLE'));

  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [perPage, setPerPage] = useState(20);
  const pages = useCursorPages();

  const log = useAuditPage({
    actor: actor || undefined,
    action: action || undefined,
    first: perPage,
    after: pages.after,
  });

  const entries = log.data?.auditLog.nodes ?? [];
  const total = log.data?.auditLog.totalCount ?? 0;
  const where = log.data?.auditLog.pageInfo;
  const actions = log.data?.auditActions ?? [];
  const connections = log.data?.connections ?? [];

  /**
   * Narrowing puts you back at the newest page.
   *
   * <p>A cursor is a position in one particular list. Carrying it into a differently filtered list
   * would resume from a row that is not in it, so the server refuses it — and the honest thing to
   * do is start again rather than hand it one it will refuse.
   */
  const narrow = (change: () => void) => {
    change();
    pages.first();
  };

  const pager = (variant: 'top' | 'bottom') => (
    <Pagination
      itemCount={total}
      page={pages.page}
      perPage={perPage}
      variant={variant}
      isCompact
      // Cursors can go forward and back and nowhere else: page seven has no name until pages one
      // to six have been read. That is the trade a growing list asks for, and the arrows say it
      // plainly rather than offering a jump that would land somewhere else.
      // The arrows enable themselves from the count and the page number, which is what
      // PatternFly does with them — there are no props to override that, and no need: the total
      // is exact, so "there is a next page" and "the count says so" agree.
      onNextClick={() => pages.forward(where?.endCursor ?? null)}
      onPreviousClick={() => pages.back()}
      onPerPageSelect={(_event, next) => narrow(() => setPerPage(next))}
      titles={{ paginationAriaLabel: t('Audit.PAGINATION') }}
    />
  );

  /**
   * What a target was called, rather than which row it was.
   *
   * <p>A deleted profile keeps its id, which is the point of recording one: the log outlives the
   * thing it is about, and `#4` is still better than nothing when there is no longer a name.
   */
  const targetName = (connectionId: number | null) => {
    if (connectionId === null) {
      return '—';
    }
    const profile = connections.find((one) => one.id === connectionId);
    return profile ? profile.name : `#${connectionId}`;
  };

  return (
    <>
      <PageHeader title={t('Audit.TITLE')} description={t('Audit.DESCRIPTION')} />

      <PageSection className="keydra-browser" isFilled>
        <Card isCompact isFullHeight className="keydra-pubsub__feed">
          <CardBody className="keydra-pubsub__feed-body">
            <Toolbar id="audit-toolbar" inset={{ default: 'insetNone' }}>
              <ToolbarContent alignItems="center">
                <ToolbarGroup variant="filter-group">
                  <ToolbarItem className="keydra-toolbar__search">
                    <SearchInput
                      aria-label={t('Audit.FILTER_ACTOR')}
                      placeholder={t('Audit.FILTER_ACTOR')}
                      value={actor}
                      onChange={(_event, value) => narrow(() => setActor(value))}
                      onClear={() => narrow(() => setActor(''))}
                    />
                  </ToolbarItem>
                  <ToolbarItem>
                    <FormSelect
                      aria-label={t('Audit.FILTER_ACTION')}
                      value={action}
                      onChange={(_event, value) => narrow(() => setAction(value))}
                    >
                      <FormSelectOption value="" label={t('Audit.ALL_ACTIONS')} />
                      {actions.map((name) => (
                        <FormSelectOption key={name} value={name} label={describeAction(name, t)} />
                      ))}
                    </FormSelect>
                  </ToolbarItem>
                </ToolbarGroup>
                <ToolbarGroup align={{ default: 'alignEnd' }}>
                  <ToolbarItem>
                    <Button variant="link" isInline onClick={() => void log.refetch()}>
                      {t('Audit.REFRESH')}
                    </Button>
                  </ToolbarItem>
                  <ToolbarItem>{pager('top')}</ToolbarItem>
                </ToolbarGroup>
              </ToolbarContent>
            </Toolbar>

            {log.isPending ? (
              <LoadingView />
            ) : log.isError ? (
              <ErrorView
                title={t('Audit.LOAD_ERROR')}
                failure={log.error}
                onRetry={() => void log.refetch()}
              />
            ) : entries.length === 0 ? (
              <EmptyState titleText={t('Audit.EMPTY_TITLE')} icon={HistoryIcon} headingLevel="h2">
                <EmptyStateBody>{t('Audit.EMPTY_BODY')}</EmptyStateBody>
              </EmptyState>
            ) : (
              <Table aria-label={t('Audit.TITLE')} variant="compact">
                <Thead>
                  <Tr>
                    <Th width={20}>{t('Audit.WHEN')}</Th>
                    <Th width={15}>{t('Audit.ACTOR')}</Th>
                    <Th width={20}>{t('Audit.ACTION')}</Th>
                    <Th width={10}>{t('Audit.TARGET')}</Th>
                    <Th width={10}>{t('Audit.OUTCOME')}</Th>
                    <Th>{t('Audit.DETAIL')}</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {entries.map((entry) => (
                    <Tr key={entry.id}>
                      <Td dataLabel={t('Audit.WHEN')} className="pf-v6-u-font-family-monospace">
                        {new Date(entry.at).toLocaleString()}
                      </Td>
                      <Td dataLabel={t('Audit.ACTOR')}>{entry.actor}</Td>
                      <Td dataLabel={t('Audit.ACTION')}>
                        {/* The identifier stays one hover away: it is what the API filters by
                            and what anybody grepping a database would search for. */}
                        <Tooltip content={<code>{entry.action}</code>}>
                          <span>{describeAction(entry.action, t)}</span>
                        </Tooltip>
                      </Td>
                      <Td dataLabel={t('Audit.TARGET')}>{targetName(entry.connectionId)}</Td>
                      <Td dataLabel={t('Audit.OUTCOME')}>
                        <Label
                          isCompact
                          color={entry.succeeded ? 'green' : 'red'}
                          status={entry.succeeded ? 'success' : 'danger'}
                        >
                          {entry.succeeded ? t('Audit.SUCCEEDED') : t('Audit.FAILED')}
                        </Label>
                      </Td>
                      <Td
                        dataLabel={t('Audit.DETAIL')}
                        className="keydra-value__text pf-v6-u-font-family-monospace"
                      >
                        {entry.detail ?? '—'}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}

            {total > 0 && pager('bottom')}
          </CardBody>
        </Card>
      </PageSection>
    </>
  );
};
