import { useState } from 'react';
import type { FC } from 'react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  Content,
  EmptyState,
  EmptyStateBody,
  Flex,
  FlexItem,
  Grid,
  GridItem,
  Label,
  LabelGroup,
  PageSection,
  Timestamp,
} from '@patternfly/react-core';
import { ActionsColumn, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { useConnections } from '@app/Connections/queries';
import { Permission, useHoldsPermission } from '@app/Login/queries';
import { ConfirmDialog } from '@app/Shared/Components/ConfirmDialog';
import { ErrorView } from '@app/Shared/Components/ErrorView';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import { PageHeader } from '@app/Shared/Components/PageHeader';
import { useDocumentTitle } from '@app/utils/hooks/useDocumentTitle';
import { InstanceGraph } from './InstanceGraph';
import {
  useCheckReachability,
  useDrainInstance,
  useInstances,
  useReachabilityHistory,
} from './queries';
import { dependencyDetail, dependencyKind, dependencyName } from './dependencyText';
import type { DependencyState, InstanceSummary } from './queries';

/**
 * How long ago, in the largest unit that leaves a whole number.
 *
 * <p>Relative rather than a timestamp: what a reader wants to know about a reading is how much to
 * trust it, and "six minutes ago" answers that where "21:04" needs them to work it out.
 */
const howLongAgo = (at: string): string => {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(at).getTime()) / 1000));
  if (seconds < 60) {
    return `${seconds}s`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m`;
  }
  return `${Math.floor(seconds / 3600)}h`;
};

/**
 * What one dependency is doing, as a label rather than a sentence.
 *
 * <p>Three states and not two. Something this deployment chose not to have is not broken, and
 * drawing it red would make a page that nags rather than one that reports — which is how somebody
 * learns to stop reading it.
 */
/**
 * What is known about one dependency beyond its state.
 *
 * <p>Composed from what the row carries rather than read off a sentence the backend wrote: every
 * part of it is a number that is already here, and a sentence sent from there is a sentence in one
 * language whatever language the page was asked for.
 *
 * <p>When, as well as what. "Reachable" on its own is a claim about a moment nobody is in;
 * "reachable, checked six minutes ago" is something a person can decide how much to trust.
 */
const DependencyDetail: FC<{ dependency: DependencyState }> = ({ dependency }) => {
  const { t } = useTranslation();
  const parts = dependencyDetail(dependency, t);
  if (dependency.reached) {
    parts.push(t('Instances.CHECKED_AGO', { ago: howLongAgo(dependency.reached.at) }));
  }
  return parts.length > 0 ? <Content component="small">{parts.join(' · ')}</Content> : <>—</>;
};

const DependencyLabel: FC<{ dependency: DependencyState }> = ({ dependency }) => {
  const { t } = useTranslation();
  if (!dependency.configured) {
    return (
      <Label isCompact color="grey">
        {t('Instances.NOT_CONFIGURED')}
      </Label>
    );
  }
  return dependency.reachable ? (
    <Label isCompact color="green" status="success">
      {t('Instances.REACHABLE')}
    </Label>
  ) : (
    <Label isCompact color="red" status="danger">
      {t('Instances.UNREACHABLE')}
    </Label>
  );
};

/**
 * What one instance is holding, as three numbers.
 *
 * <p>Together rather than as three columns, because they are read together: sockets alone says how
 * many visitors there are, and it is the streams and the jobs beside it that say whether this is an
 * instance somebody would mind losing.
 *
 * <p>A zero is shown rather than hidden. A row with nothing on it is a real answer — an instance
 * that has just started, or one a balancer has stopped sending to — and hiding it would make an
 * idle instance look like a broken reading.
 */
const Holding: FC<{ instance: InstanceSummary }> = ({ instance }) => {
  const { t } = useTranslation();
  return (
    <LabelGroup numLabels={3}>
      <Label isCompact color={instance.sockets > 0 ? 'blue' : 'grey'}>
        {t('Instances.SOCKETS', { count: instance.sockets })}
      </Label>
      <Label isCompact color={instance.streams > 0 ? 'blue' : 'grey'}>
        {t('Instances.STREAMS', { count: instance.streams })}
      </Label>
      <Label isCompact color={instance.jobs > 0 ? 'blue' : 'grey'}>
        {t('Instances.JOBS', { count: instance.jobs })}
      </Label>
    </LabelGroup>
  );
};

/**
 * How Keydra itself is doing.
 *
 * <p>Every target has a page saying how it is arranged and whether anything is wrong with it, and
 * Keydra had none — which is a strange gap in the thing doing the watching, and the one that bites
 * on the morning somebody asks why an alert did not fire and there is nowhere to see that the
 * instance holding the chores has been gone since three.
 *
 * <p>Two questions, and they are genuinely two. Who is running is not who is doing the work: a
 * rolling upgrade has two instances and one leader, and reading either number alone gives the wrong
 * picture of the same moment.
 */
export const Instances: FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('Instances.TITLE'));
  const health = useInstances();
  /*
   * Only to put names on the ids an instance reports. The roster carries ids because that is what
   * an instance can honestly know about itself; a name lives on the profile, and a target deleted
   * since the last beat has none — which is why an id with no name is shown as the id rather than
   * dropped.
   */
  const connections = useConnections();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const holds = useHoldsPermission(Permission.InstanceDrain);
  const drain = useDrainInstance();
  const check = useCheckReachability();
  const changes = useReachabilityHistory();
  /* The instance the confirmation is about, and nothing else: resuming one needs no confirming. */
  const [confirming, setConfirming] = useState<InstanceSummary | null>(null);

  if (health.isPending) {
    return <LoadingView />;
  }
  if (health.isError) {
    return (
      <PageSection>
        <ErrorView title={t('Instances.LOAD_ERROR')} message={health.error.message} />
      </PageSection>
    );
  }

  const { instances, dependencies, rates, choresStoppedSince, deployment } = health.data;
  /*
   * The graph and the count are about the fleet as it is; the table is about the roster, which is
   * wider on purpose. An instance that stopped without shutting down leaves its row behind, and a
   * page that showed only who is answering would be throwing away the one record of the thing
   * worth noticing.
   */
  const present = instances.filter((instance) => instance.present);
  const names = new Map((connections.data ?? []).map((profile) => [profile.id, profile.name]));

  return (
    <>
      <PageHeader title={t('Instances.TITLE')} description={t('Instances.DESCRIPTION')} />
      <PageSection isFilled>
        <Grid hasGutter>
          {/*
            First, and above the roster, because it is the one thing this page could otherwise be
            confidently wrong about: four healthy instances, none of them doing any work. The
            server decides when it counts rather than the browser, so the banner and the message
            sent to whoever is on call cannot disagree about one fact.
          */}
          {/*
            Nothing at all when there is nothing to say. A panel that reports no problems every
            day is one nobody reads on the day it reports one.
          */}
          {(deployment ?? []).map((note) => (
            <GridItem span={12} key={note.setting}>
              <Alert variant="warning" isInline title={note.saying}>
                <p>{note.costing}</p>
                <p className="pf-v6-u-mt-sm">
                  {t('Instances.NOTE_SETTING')} <code>{note.setting}</code>
                </p>
              </Alert>
            </GridItem>
          ))}

          {choresStoppedSince ? (
            <GridItem span={12}>
              <Alert variant="danger" isInline title={t('Instances.CHORES_STOPPED')}>
                {t('Instances.CHORES_STOPPED_BODY', {
                  since: new Date(choresStoppedSince).toLocaleString(),
                })}
              </Alert>
            </GridItem>
          ) : null}
          {/* The picture first, for the reason the topology page puts one first: a table says
              what is there, and the shape says what rests on what — which is the question
              somebody opens this page carrying. */}
          {present.length > 0 ? (
            <GridItem span={12}>
              <Card isCompact>
                <CardTitle>{t('Instances.GRAPH')}</CardTitle>
                <CardBody>
                  <InstanceGraph
                    instances={present}
                    dependencies={dependencies}
                    rates={rates}
                    // Room for a ring rather than a row: the dependencies are arranged around the
                    // instances, and a short canvas would fit that by shrinking it to a smear.
                    height={560}
                  />
                </CardBody>
              </Card>
            </GridItem>
          ) : null}

          <GridItem span={12}>
            <Card isCompact>
              <CardTitle>{t('Instances.RUNNING', { count: present.length })}</CardTitle>
              <CardBody>
                {/* Above the table rather than in the dialog, because the dialog is only on the
                    way in: putting an instance back takes no confirming, and a failure there
                    would otherwise be a menu item that quietly did nothing. */}
                {drain.isError ? (
                  <Alert
                    variant="danger"
                    isInline
                    title={t('Instances.DRAIN_FAILED')}
                    className="pf-v6-u-mb-md"
                  >
                    {drain.error.message}
                  </Alert>
                ) : null}
                {instances.length === 0 ? (
                  /*
                   * Which should be impossible — something answered this request — and is worth
                   * saying plainly rather than showing an empty table, because it means the roster
                   * is not being written and that is its own kind of wrong.
                   */
                  <EmptyState titleText={t('Instances.NONE')} headingLevel="h3">
                    <EmptyStateBody>{t('Instances.NONE_BODY')}</EmptyStateBody>
                  </EmptyState>
                ) : (
                  <Table aria-label={t('Instances.TABLE')} variant="compact">
                    <Thead>
                      <Tr>
                        <Th screenReaderText={t('Instances.EXPAND_COLUMN')} />
                        <Th width={20}>{t('Instances.ID')}</Th>
                        <Th width={15}>{t('Instances.VERSION')}</Th>
                        <Th width={10}>{t('Instances.ROLE')}</Th>
                        <Th width={10}>{t('Instances.STATE')}</Th>
                        <Th width={20}>{t('Instances.HOLDING')}</Th>
                        <Th width={10}>{t('Instances.STARTED')}</Th>
                        <Th>{t('Instances.LAST_SEEN')}</Th>
                        <Th screenReaderText={t('Instances.ACTIONS_COLUMN')} />
                      </Tr>
                    </Thead>
                    {instances.map((instance, row) => (
                      <Tbody key={instance.id} isExpanded={expanded.has(instance.id)}>
                        <Tr>
                          <Td
                            expand={{
                              rowIndex: row,
                              isExpanded: expanded.has(instance.id),
                              onToggle: () =>
                                setExpanded((open) => {
                                  const next = new Set(open);
                                  if (!next.delete(instance.id)) {
                                    next.add(instance.id);
                                  }
                                  return next;
                                }),
                              expandId: `instance-${instance.id}`,
                            }}
                          />
                          <Td
                            dataLabel={t('Instances.ID')}
                            className="pf-v6-u-font-family-monospace"
                          >
                            {instance.id}
                            {instance.self ? (
                              <>
                                {' '}
                                {/* Everything on this page came from this one, which is worth
                                    knowing when two instances disagree. */}
                                <Label isCompact variant="outline">
                                  {t('Instances.THIS_ONE')}
                                </Label>
                              </>
                            ) : null}
                          </Td>
                          <Td dataLabel={t('Instances.VERSION')}>
                            {instance.version}
                            {instance.commit ? (
                              <>
                                {' '}
                                <Content component="small">{instance.commit}</Content>
                              </>
                            ) : null}
                          </Td>
                          <Td dataLabel={t('Instances.ROLE')}>
                            {instance.leader ? (
                              <Label isCompact color="blue">
                                {t('Instances.LEADER')}
                              </Label>
                            ) : (
                              <Label isCompact color="grey">
                                {t('Instances.FOLLOWER')}
                              </Label>
                            )}
                          </Td>
                          {/* Beside the role rather than folded into it, because they are two
                              facts and the moment worth seeing is when an instance is both: still
                              the leader, already draining, about to stop being the first. */}
                          <Td dataLabel={t('Instances.STATE')}>
                            {/* Gone first, because it outranks the other two: an instance that
                                is not answering is not serving, and whether somebody had asked
                                it to drain stopped mattering when it stopped. */}
                            {!instance.present ? (
                              <Label isCompact color="red" status="danger">
                                {t('Instances.NOT_ANSWERING')}
                              </Label>
                            ) : instance.draining ? (
                              <Label isCompact color="orange" status="warning">
                                {t('Instances.DRAINING')}
                              </Label>
                            ) : (
                              <Label isCompact color="grey">
                                {t('Instances.SERVING')}
                              </Label>
                            )}
                          </Td>
                          <Td dataLabel={t('Instances.HOLDING')}>
                            <Holding instance={instance} />
                          </Td>
                          {/* With the time, not only the date: "last heard from" is a question
                              about minutes, and a column showing today's date for an instance
                              that stopped beating at three would be answering a different one. */}
                          <Td dataLabel={t('Instances.STARTED')}>
                            <Timestamp
                              date={new Date(instance.startedAt)}
                              dateFormat="short"
                              timeFormat="short"
                            />
                          </Td>
                          <Td dataLabel={t('Instances.LAST_SEEN')}>
                            <Timestamp
                              date={new Date(instance.lastSeenAt)}
                              dateFormat="short"
                              timeFormat="short"
                            />
                          </Td>
                          <Td isActionCell>
                            {/* Nothing to offer an instance that has stopped: draining asks a
                                running process to hand its work over, and this one is not there
                                to be asked. */}
                            {holds && instance.present ? (
                              <ActionsColumn
                                items={[
                                  instance.draining
                                    ? {
                                        title: t('Instances.RESUME'),
                                        onClick: () =>
                                          drain.mutate({ id: instance.id, draining: false }),
                                      }
                                    : {
                                        title: t('Instances.DRAIN'),
                                        onClick: () => setConfirming(instance),
                                      },
                                ]}
                              />
                            ) : null}
                          </Td>
                        </Tr>
                        {/* Which targets, rather than how many. A list belongs in a row that opens
                            rather than in a cell that truncates: an instance can hold twenty, and a
                            column showing three of them and an ellipsis answers nothing. */}
                        <Tr isExpanded={expanded.has(instance.id)}>
                          <Td />
                          <Td colSpan={8}>
                            <Content component="small">{t('Instances.WATCHING')}</Content>
                            {instance.watching.length === 0 ? (
                              <Content component="p">{t('Instances.WATCHING_NONE')}</Content>
                            ) : (
                              <LabelGroup numLabels={12}>
                                {instance.watching.map((id) => (
                                  <Label key={id} isCompact variant="outline">
                                    {names.get(id) ?? t('Instances.TARGET_ID', { id })}
                                  </Label>
                                ))}
                              </LabelGroup>
                            )}
                          </Td>
                        </Tr>
                      </Tbody>
                    ))}
                  </Table>
                )}
              </CardBody>
            </Card>
          </GridItem>

          <GridItem span={12}>
            <Card isCompact>
              <CardTitle>
                <Flex
                  justifyContent={{ default: 'justifyContentSpaceBetween' }}
                  alignItems={{ default: 'alignItemsCenter' }}
                >
                  <FlexItem>{t('Instances.DEPENDS_ON')}</FlexItem>
                  <FlexItem>
                    {/*
                      The asking happens on a clock so that a page load costs nobody anything. This
                      is for the moment somebody has just changed something and does not want to
                      wait ten minutes to find out whether it works.
                    */}
                    <Button
                      variant="secondary"
                      isInline
                      isDisabled={check.isPending}
                      isLoading={check.isPending}
                      onClick={() => check.mutate()}
                    >
                      {t('Instances.CHECK_NOW')}
                    </Button>
                  </FlexItem>
                </Flex>
              </CardTitle>
              <CardBody>
                {check.isError ? (
                  <Alert
                    variant="info"
                    isInline
                    isPlain
                    component="h3"
                    className="pf-v6-u-mb-sm"
                    title={t('Instances.CHECK_TOO_SOON')}
                  />
                ) : null}
                <Table aria-label={t('Instances.DEPENDS_TABLE')} variant="compact">
                  <Thead>
                    <Tr>
                      <Th width={20}>{t('Instances.WHAT')}</Th>
                      <Th width={20}>{t('Instances.KIND')}</Th>
                      <Th width={15}>{t('Instances.STATE')}</Th>
                      <Th>{t('Instances.DETAIL')}</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {dependencies.map((dependency) => (
                      <Tr key={dependency.id}>
                        <Td dataLabel={t('Instances.WHAT')}>{dependencyName(dependency, t)}</Td>
                        <Td dataLabel={t('Instances.KIND')}>
                          {dependencyKind(dependency, t)}
                          {dependency.count > 1 ? (
                            <>
                              {' '}
                              <Content component="small">
                                {t('Instances.OF_MANY', {
                                  healthy: dependency.healthy,
                                  count: dependency.count,
                                })}
                              </Content>
                            </>
                          ) : null}
                        </Td>
                        <Td dataLabel={t('Instances.STATE')}>
                          <DependencyLabel dependency={dependency} />
                        </Td>
                        <Td dataLabel={t('Instances.DETAIL')}>
                          <DependencyDetail dependency={dependency} />
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </CardBody>
            </Card>
          </GridItem>

          {/*
            Under the counts rather than on a page of its own. Phase 49 said a history of
            reachability was a different page; it is a dozen rows on the one page that already
            says what this installation reaches, and what it answers is the question somebody
            actually arrives with — not "is it reachable", which is above, but "when did it stop".
          */}
          <GridItem span={12}>
            <Card isCompact>
              <CardTitle>{t('Instances.CHANGES')}</CardTitle>
              <CardBody>
                {(changes.data ?? []).length === 0 ? (
                  <Content component="small">{t('Instances.CHANGES_NONE')}</Content>
                ) : (
                  <Table aria-label={t('Instances.CHANGES')} variant="compact">
                    <Thead>
                      <Tr>
                        <Th width={20}>{t('Instances.WHEN')}</Th>
                        <Th width={20}>{t('Instances.WHAT')}</Th>
                        <Th width={15}>{t('Instances.STATE')}</Th>
                        <Th>{t('Instances.DETAIL')}</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {(changes.data ?? []).map((change) => (
                        <Tr key={`${change.kind}-${change.subjectId}-${change.at}`}>
                          <Td dataLabel={t('Instances.WHEN')}>
                            <Timestamp
                              date={new Date(change.at)}
                              dateFormat="short"
                              timeFormat="short"
                            />
                          </Td>
                          {/* The name it had then, which the server keeps rather than resolves:
                              a destination somebody deleted last week still stopped answering
                              on Tuesday. */}
                          <Td dataLabel={t('Instances.WHAT')}>{change.name ?? change.subjectId}</Td>
                          <Td dataLabel={t('Instances.STATE')}>
                            <Label
                              isCompact
                              color={change.ok ? 'green' : 'red'}
                              status={change.ok ? 'success' : 'danger'}
                            >
                              {change.ok
                                ? t('Instances.STARTED_ANSWERING')
                                : t('Instances.STOPPED_ANSWERING')}
                            </Label>
                          </Td>
                          <Td dataLabel={t('Instances.DETAIL')}>
                            <Content component="small">{change.detail ?? '—'}</Content>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                )}
              </CardBody>
            </Card>
          </GridItem>
        </Grid>
      </PageSection>

      {confirming && (
        <ConfirmDialog
          isOpen
          title={t('Instances.DRAIN_TITLE', { id: confirming.id })}
          confirmLabel={t('Instances.DRAIN')}
          /* Reversible, so not ordinarily a danger — except where it is the only instance, which
             is the one case where draining stops the installation doing anything on its own. */
          // Counted among the ones still answering: draining the last one that works is the
          // case worth warning about, and a row left behind by an instance that stopped is not
          // one that would carry on doing the chores.
          isDestructive={present.length === 1}
          isBusy={drain.isPending}
          onConfirm={() => {
            drain.mutate({ id: confirming.id, draining: true });
            setConfirming(null);
          }}
          onCancel={() => setConfirming(null)}
        >
          {t('Instances.DRAIN_BODY')}
          {present.length === 1 ? ` ${t('Instances.DRAIN_ONLY_ONE')}` : ''}
        </ConfirmDialog>
      )}
    </>
  );
};
