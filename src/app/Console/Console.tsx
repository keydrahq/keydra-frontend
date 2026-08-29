import type { FC } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import {
  Alert,
  Button,
  EmptyState,
  EmptyStateBody,
  Label,
  PageSection,
  Spinner,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Tooltip,
} from '@patternfly/react-core';
import { TerminalIcon, TrashIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { useDocumentTitle } from '@app/utils/hooks/useDocumentTitle';
import { CommandInput } from './CommandInput';
import { ConsoleValueView } from './ConsoleValueView';
import { ConsoleState, useConsoleSocket } from './useConsoleSocket';
import { useClearHistory, useCommandHistory, useDeniedCommands } from './queries';

/**
 * An interactive session against one target.
 *
 * <p>The transcript is the page: what was typed and what came back, in order, the way a terminal
 * reads. History survives the session because it lives on the server — reopening the page and
 * pressing the up arrow finds what was run yesterday.
 */
export const Console: FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('Console.TITLE'));

  const { connectionId: idParam } = useParams();
  const connectionId = Number(idParam);

  const { transcript, state, send, clear, refuse } = useConsoleSocket(connectionId);
  const history = useCommandHistory(connectionId);
  const denied = useDeniedCommands(connectionId);
  const forget = useClearHistory(connectionId);
  const bottom = useRef<HTMLDivElement>(null);

  // Follow the transcript as it grows, the way a terminal does.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [transcript]);

  /**
   * Lines the up arrow walks: this session's first, then what the server remembers.
   *
   * <p>Both, because a line just typed is the most likely one to want back, and the server's copy
   * only arrives on load.
   */
  const recallable = useMemo(() => {
    const thisSession = transcript.map((entry) => entry.line).reverse();
    const persisted = (history.data ?? []).map((entry) => entry.line);
    return [...thisSession, ...persisted];
  }, [history.data, transcript]);

  if (!Number.isFinite(connectionId)) {
    return (
      <PageSection>
        <EmptyState titleText={t('Console.NO_CONNECTION')} headingLevel="h2">
          <EmptyStateBody>{t('Console.NO_CONNECTION_BODY')}</EmptyStateBody>
        </EmptyState>
      </PageSection>
    );
  }

  return (
    <PageSection className="keydra-browser" isFilled>
      <div className="keydra-console">
        {/* The session's state and the one action that belongs to it. In a toolbar above
            the transcript rather than in the page header: the header names the target now,
            and it says nothing about the socket this one tool holds open. */}
        <Toolbar
          id="console-toolbar"
          className="keydra-tool-toolbar"
          inset={{ default: 'insetNone' }}
        >
          <ToolbarContent>
            <ToolbarItem>
              {state === ConsoleState.Open ? (
                <Label isCompact color="green" status="success">
                  {t('Console.CONNECTED')}
                </Label>
              ) : state === ConsoleState.Connecting ? (
                <Label isCompact color="blue" icon={<Spinner size="sm" />}>
                  {t('Console.CONNECTING')}
                </Label>
              ) : (
                <Label isCompact color="red" status="danger">
                  {t('Console.DISCONNECTED')}
                </Label>
              )}
            </ToolbarItem>
            <ToolbarItem align={{ default: 'alignEnd' }}>
              <Tooltip content={t('Console.CLEAR')}>
                <Button
                  variant="plain"
                  aria-label={t('Console.CLEAR')}
                  icon={<TrashIcon />}
                  onClick={() => {
                    clear();
                    forget.mutate();
                  }}
                />
              </Tooltip>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>

        {state === ConsoleState.Closed ? (
          <Alert variant="warning" isInline component="h2" title={t('Console.DISCONNECTED_TITLE')}>
            {t('Console.DISCONNECTED_BODY')}
          </Alert>
        ) : null}

        <div className="keydra-console__transcript" role="log" aria-label={t('Console.TRANSCRIPT')}>
          {transcript.length === 0 ? (
            <EmptyState titleText={t('Console.EMPTY_TITLE')} icon={TerminalIcon} headingLevel="h2">
              <EmptyStateBody>
                {t('Console.EMPTY_BODY', { count: denied.data?.length ?? 0 })}
              </EmptyStateBody>
            </EmptyState>
          ) : (
            transcript.map((entry) => (
              <div key={entry.id} className="keydra-console__entry">
                <div className="keydra-console__echo">
                  <span className="keydra-console__prompt" aria-hidden="true">
                    &gt;
                  </span>{' '}
                  {entry.line}
                </div>
                <div className="keydra-console__reply">
                  {entry.result ? (
                    <>
                      <ConsoleValueView value={entry.result.value} />
                      <span className="keydra-console__timing">
                        {t('Console.TOOK', { ms: entry.result.durationMs })}
                      </span>
                    </>
                  ) : (
                    <Spinner size="sm" aria-label={t('Console.RUNNING')} />
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={bottom} />
        </div>

        <div className="keydra-console__input-row">
          <CommandInput
            isDisabled={state !== ConsoleState.Open}
            history={recallable}
            onSubmit={(line) => {
              // Refused here as well as on the server: the policy is already known, so
              // spending a round trip to be told no — and to be told in the server's
              // language rather than the reader's — helps nobody.
              const command = line.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
              if ((denied.data ?? []).includes(command)) {
                refuse(line, t('Console.REFUSED', { command: command.toUpperCase() }));
                return;
              }
              send(line);
            }}
          />
        </div>
      </div>
    </PageSection>
  );
};
