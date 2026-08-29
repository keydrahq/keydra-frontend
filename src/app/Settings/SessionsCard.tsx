import type { FC } from 'react';
import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  Content,
  DataList,
  DataListCell,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  Label,
  Pagination,
  Spinner,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@app/Shared/Components/ConfirmDialog';
import { ErrorView } from '@app/Shared/Components/ErrorView';
import { useEndOtherSessions, useEndSession, useSessions } from './sessionQueries';
import type { Session } from './sessionQueries';

/**
 * How a browser describes itself, shortened to something a person recognises.
 *
 * <p>A user agent is a paragraph of history — every browser claims to be several others — and what
 * somebody needs from it is "this is my laptop" or "this is not". So the browser and the platform,
 * and nothing else.
 */
const describe = (agent: string | null): string => {
  if (!agent) {
    return '';
  }
  const browser =
    /(Firefox|Edg|OPR|Chrome|Safari)\/[\d.]+/.exec(agent)?.[1]?.replace('Edg', 'Edge') ?? '';
  const platform =
    /\(([^;)]+)/.exec(agent)?.[1]?.replace('Macintosh', 'Mac').replace('X11', 'Linux') ?? '';
  return [browser, platform].filter(Boolean).join(' · ');
};

/** When something happened, in the reader's own locale. */
const when = (moment: string | null): string => (moment ? new Date(moment).toLocaleString() : '');

/**
 * The browsers you are signed in on.
 *
 * <p>Under your own settings rather than an administrator's page, because these are yours. Each row
 * says where and when; the one reading the page is marked, because ending that one is signing out
 * and a list that did not say which is which invites doing it by accident.
 */
export const SessionsCard: FC = () => {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const sessions = useSessions(perPage, (page - 1) * perPage);
  const endOne = useEndSession();
  const endOthers = useEndOtherSessions();
  const [ending, setEnding] = useState<Session | undefined>();
  const [endingOthers, setEndingOthers] = useState(false);

  const total = sessions.data?.mySessionCount ?? 0;
  /*
   * From the total rather than from this page, which is the whole difference paging makes here:
   * counting the rows in front of somebody would have the button say "end 9 others" on a page of
   * ten and "end 2" on the last one. The session reading the page is always one of the total, and
   * always the first of them, so the others are everything else.
   */
  const others = Math.max(0, total - 1);

  const finish = (session: Session) => {
    endOne.mutate(session.id, {
      onSuccess: () => {
        setEnding(undefined);
        // Ending your own session is signing out, and the surest way to be signed out is to
        // have loaded nothing as the person you no longer are.
        if (session.current) {
          window.location.assign('/');
        }
      },
    });
  };

  return (
    <Card isCompact isFullHeight>
      <CardTitle>{t('Settings.SESSIONS')}</CardTitle>
      <CardBody>
        <Stack hasGutter>
          <StackItem>
            <Content component="p">{t('Settings.SESSIONS_HELP')}</Content>
          </StackItem>

          {sessions.isPending && (
            <StackItem>
              <Spinner size="md" aria-label={t('Settings.SESSIONS')} />
            </StackItem>
          )}

          {sessions.isError && (
            <StackItem>
              <ErrorView title={t('Settings.SESSIONS_ERROR')} message={sessions.error.message} />
            </StackItem>
          )}

          {sessions.data && (
            <StackItem>
              <DataList aria-label={t('Settings.SESSIONS')} isCompact>
                {sessions.data.mySessions.map((session) => (
                  <DataListItem key={session.id}>
                    <DataListItemRow>
                      <DataListItemCells
                        dataListCells={[
                          <DataListCell key="what" width={2}>
                            <Stack>
                              <StackItem>
                                {describe(session.userAgent) || t('Settings.SESSION_UNKNOWN')}
                                {session.current && (
                                  <>
                                    {' '}
                                    <Label isCompact color="blue">
                                      {t('Settings.SESSION_CURRENT')}
                                    </Label>
                                  </>
                                )}
                              </StackItem>
                              <StackItem>
                                <Content component="small">
                                  {[
                                    session.network,
                                    t('Settings.SESSION_SEEN', {
                                      when: when(session.lastSeenAt ?? session.issuedAt),
                                    }),
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </Content>
                              </StackItem>
                            </Stack>
                          </DataListCell>,
                          <DataListCell key="end" alignRight>
                            <Button
                              variant="secondary"
                              isDanger
                              isInline
                              onClick={() => setEnding(session)}
                            >
                              {t(
                                session.current
                                  ? 'Settings.SESSION_SIGN_OUT'
                                  : 'Settings.SESSION_END',
                              )}
                            </Button>
                          </DataListCell>,
                        ]}
                      />
                    </DataListItemRow>
                  </DataListItem>
                ))}
              </DataList>
            </StackItem>
          )}

          {sessions.data && sessions.data.mySessions.length > 0 && (
            <StackItem>
              <Pagination
                itemCount={total}
                page={page}
                perPage={perPage}
                onSetPage={(_event, next) => setPage(next)}
                onPerPageSelect={(_event, next) => {
                  setPerPage(next);
                  setPage(1);
                }}
                variant="bottom"
                titles={{ paginationAriaLabel: t('Settings.SESSIONS_PAGINATION') }}
              />
            </StackItem>
          )}

          {others > 0 && (
            <StackItem>
              <Button variant="secondary" isDanger onClick={() => setEndingOthers(true)}>
                {t('Settings.SESSIONS_END_OTHERS', { count: others })}
              </Button>
            </StackItem>
          )}

          {endOthers.isSuccess && endOthers.data > 0 && (
            <StackItem>
              <Alert
                variant="success"
                isInline
                isPlain
                title={t('Settings.SESSIONS_ENDED', { count: endOthers.data })}
              />
            </StackItem>
          )}
        </Stack>
      </CardBody>

      {ending && (
        <ConfirmDialog
          title={t(ending.current ? 'Settings.SIGN_OUT_TITLE' : 'Settings.END_SESSION_TITLE')}
          confirmLabel={t(ending.current ? 'Settings.SESSION_SIGN_OUT' : 'Settings.SESSION_END')}
          isOpen
          isDestructive
          isBusy={endOne.isPending}
          onConfirm={() => finish(ending)}
          onCancel={() => setEnding(undefined)}
        >
          {t(ending.current ? 'Settings.SIGN_OUT_BODY' : 'Settings.END_SESSION_BODY', {
            what: describe(ending.userAgent) || t('Settings.SESSION_UNKNOWN'),
          })}
        </ConfirmDialog>
      )}

      {endingOthers && (
        <ConfirmDialog
          title={t('Settings.END_OTHERS_TITLE')}
          confirmLabel={t('Settings.SESSIONS_END_OTHERS', { count: others })}
          isOpen
          isDestructive
          isBusy={endOthers.isPending}
          onConfirm={() => endOthers.mutate(undefined, { onSuccess: () => setEndingOthers(false) })}
          onCancel={() => setEndingOthers(false)}
        >
          {t('Settings.END_OTHERS_BODY')}
        </ConfirmDialog>
      )}
    </Card>
  );
};
