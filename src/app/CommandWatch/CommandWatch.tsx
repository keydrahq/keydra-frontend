import type { FC } from 'react';
import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  Label,
  PageSection,
  SearchInput,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { EyeIcon, PauseIcon, PlayIcon, TrashIcon } from '@patternfly/react-icons';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { useDocumentTitle } from '@app/utils/hooks/useDocumentTitle';
import { WatchState, useCommandWatch } from './useCommandWatch';

/**
 * Microseconds since the epoch, as a wall clock with the fraction that orders a busy second.
 *
 * <p>Twenty-four hour and fixed width, not the locale's own time: a column of times is read by
 * comparing them to each other, and "9:28:53 PM" is both longer and harder to line up than
 * "21:28:53" — while a thousand commands can share the second, so the milliseconds are the part
 * that actually orders them.
 */
const asTime = (atMicros: number): string => {
  const at = new Date(atMicros / 1000);
  const pad = (value: number, width = 2) => String(value).padStart(width, '0');
  return `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}.${pad(at.getMilliseconds(), 3)}`;
};

/**
 * Everything a target is being asked to do, as it happens.
 *
 * <p>Off until asked for, and stopped when the page is left. Watching copies every command the
 * server runs to this reader, which is a real cost on the server rather than only on the browser —
 * so it is a thing somebody starts, not a thing a page does on their behalf.
 */
export const CommandWatch: FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('CommandWatch.TITLE'));

  const { connectionId: idParam } = useParams();
  const connectionId = Number(idParam);
  const watch = useCommandWatch(connectionId);
  const [filter, setFilter] = useState('');

  const isRunning = watch.state === WatchState.Watching || watch.state === WatchState.Connecting;

  // Matched against the command and its arguments together, which is how somebody looks
  // for "everything touching session:" without knowing which command touched it.
  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) {
      return watch.commands;
    }
    return watch.commands.filter((command) =>
      `${command.name} ${command.arguments.join(' ')} ${command.client ?? ''}`
        .toLowerCase()
        .includes(needle),
    );
  }, [filter, watch.commands]);

  if (!Number.isFinite(connectionId)) {
    return (
      <PageSection>
        <EmptyState titleText={t('CommandWatch.NO_CONNECTION')} headingLevel="h2">
          <EmptyStateBody>{t('CommandWatch.NO_CONNECTION_BODY')}</EmptyStateBody>
        </EmptyState>
      </PageSection>
    );
  }

  return (
    <PageSection className="keydra-browser" hasBodyWrapper={false} isFilled>
      <Card isFullHeight className="keydra-browser__list">
        <CardHeader className="keydra-browser__list-header">
          <Toolbar id="command-watch-toolbar" inset={{ default: 'insetNone' }}>
            <ToolbarContent>
              <ToolbarItem>
                <Button
                  variant="primary"
                  icon={isRunning ? <PauseIcon /> : <PlayIcon />}
                  onClick={isRunning ? watch.stop : watch.start}
                >
                  {isRunning ? t('CommandWatch.STOP') : t('CommandWatch.START')}
                </Button>
              </ToolbarItem>
              <ToolbarItem>
                <SearchInput
                  aria-label={t('CommandWatch.FILTER')}
                  placeholder={t('CommandWatch.FILTER')}
                  value={filter}
                  onChange={(_event, value) => setFilter(value)}
                  onClear={() => setFilter('')}
                />
              </ToolbarItem>
              <ToolbarItem>
                <Button
                  variant="link"
                  icon={<TrashIcon />}
                  isDisabled={watch.commands.length === 0}
                  onClick={watch.clear}
                >
                  {t('CommandWatch.CLEAR')}
                </Button>
              </ToolbarItem>
              <ToolbarItem align={{ default: 'alignEnd' }} className="pf-v6-u-text-color-subtle">
                {t('CommandWatch.COUNT', { count: shown.length })}
              </ToolbarItem>
            </ToolbarContent>
          </Toolbar>
        </CardHeader>
        <Divider />
        <CardBody className="keydra-browser__list-body">
          {watch.dropped > 0 ? (
            // Said rather than hidden: a reader who has been shown ten thousand commands
            // needs to know when some were not shown, or the list reads as complete.
            <Alert
              variant="warning"
              isInline
              isPlain
              component="h3"
              title={t('CommandWatch.DROPPED', { count: watch.dropped })}
            />
          ) : null}

          {watch.commands.length === 0 ? (
            <EmptyState
              titleText={isRunning ? t('CommandWatch.WAITING_TITLE') : t('CommandWatch.IDLE_TITLE')}
              icon={EyeIcon}
              headingLevel="h2"
            >
              <EmptyStateBody>
                {isRunning ? t('CommandWatch.WAITING_BODY') : t('CommandWatch.IDLE_BODY')}
              </EmptyStateBody>
              {isRunning ? null : (
                <EmptyStateFooter>
                  <EmptyStateActions>
                    <Button variant="primary" icon={<PlayIcon />} onClick={watch.start}>
                      {t('CommandWatch.START')}
                    </Button>
                  </EmptyStateActions>
                </EmptyStateFooter>
              )}
            </EmptyState>
          ) : (
            <Table aria-label={t('CommandWatch.TABLE')} variant="compact" isStickyHeader>
              <Thead>
                <Tr>
                  <Th width={10}>{t('CommandWatch.AT')}</Th>
                  <Th width={15}>{t('CommandWatch.CLIENT')}</Th>
                  <Th width={10}>{t('CommandWatch.COMMAND')}</Th>
                  <Th>{t('CommandWatch.ARGUMENTS')}</Th>
                </Tr>
              </Thead>
              <Tbody>
                {shown.map((command) => (
                  <Tr key={command.id}>
                    <Td
                      dataLabel={t('CommandWatch.AT')}
                      className="pf-v6-u-font-family-monospace pf-v6-u-text-color-subtle"
                    >
                      {asTime(command.atMicros)}
                    </Td>
                    <Td
                      dataLabel={t('CommandWatch.CLIENT')}
                      className="pf-v6-u-font-family-monospace pf-v6-u-text-color-subtle"
                    >
                      {command.client ?? t('CommandWatch.SERVER_ITSELF')}
                    </Td>
                    <Td dataLabel={t('CommandWatch.COMMAND')}>
                      <Label isCompact color="blue">
                        {command.name}
                      </Label>
                    </Td>
                    <Td
                      dataLabel={t('CommandWatch.ARGUMENTS')}
                      className="pf-v6-u-font-family-monospace"
                      modifier="breakWord"
                    >
                      {command.arguments.join(' ')}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </CardBody>
      </Card>
    </PageSection>
  );
};
