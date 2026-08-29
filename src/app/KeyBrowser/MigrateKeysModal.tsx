import type { FC } from 'react';
import { useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  ExpandableSection,
  Form,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  Content,
  ContentVariants,
  Flex,
  FlexItem,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Progress,
  Radio,
  ProgressMeasureLocation,
  ProgressVariant,
  Spinner,
  Stack,
  StackItem,
  TextInput,
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { useConnections } from '@app/Connections/queries';
import { NameToProceed } from '@app/Shared/Components/NameToProceed';
import { ConnectionState } from '@app/Shared/Services/api.types';
import type { MigrationJob } from './types';
import { useMigration } from './useMigration';
import { MigrationShaping, emptyShape, shapeToRequest } from './MigrationShaping';
import type { MigrationShape } from './MigrationShaping';

export interface MigrateKeysModalProps {
  connectionId: number;
  /** The filter the browser is showing. */
  match: string;
  /** The keys that are ticked in the table, if any. */
  selectedKeys: string[];
  onClose: () => void;
}

/**
 * Which keys to move.
 *
 * <p>A choice rather than a pattern box, because by the time someone opens this they have usually
 * already said which keys they mean — by ticking rows, or by filtering the list. Making them
 * describe that selection again as a glob is asking them to write a pattern that matches exactly
 * those keys and nothing else.
 */
const Scope = {
  Selection: 'selection',
  Filter: 'filter',
  Pattern: 'pattern',
} as const;

type Scope = (typeof Scope)[keyof typeof Scope];

/**
 * Everything the job has dealt with, whichever way it went.
 *
 * <p>Including the keys a script turned down. They were reached, looked at and decided about — the
 * only thing that did not happen to them is being written — so leaving them out would put them in
 * the gap this count exists to close, and that gap is explained to the reader as keys that expired.
 */
const handledBy = (job: MigrationJob): number =>
  job.migrated + job.skipped + job.failed + job.dropped;

/**
 * How far along the job is, against a denominator that does not move.
 *
 * <p>That denominator is the server's: how many keys it expects to move, when it can say. Measuring
 * against what the walk has found instead puts the bar at full from the first batch — a key is
 * found and dealt with in the same breath, so the two numbers climb together and their ratio never
 * leaves 1.
 *
 * <p>A walk that reached the end is the exception, and it is finished at 100 whatever the estimate
 * said. The estimate is a reading of the keyspace taken when the job started, and a keyspace is
 * read while it is still being used — keys expire, keys are deleted, and neither is something the
 * job failed to do. Holding the bar at 98 for those put a green tick beside an unfinished bar and
 * left somebody to work out which of the two to believe.
 *
 * <p>Stopping short is a different thing and still reads as one: a job somebody cancelled, or one
 * that failed, handled the share it handled and the bar says so.
 *
 * <p>Where there is no total — a glob, whose size nothing knows until the walk ends — the job runs
 * without a bar rather than with one that is decoration.
 */
const percentOf = (job: MigrationJob): number => {
  if (job.state === 'DONE') {
    return 100;
  }
  // Without a denominator the only honest positions are "started" and "over".
  if (!job.total) {
    return job.state === 'RUNNING' ? 0 : 100;
  }
  return Math.min(100, Math.round((handledBy(job) / job.total) * 100));
};

/**
 * Whether a job ended having handled fewer keys than were expected of it.
 *
 * <p>Which is not a fault, and for a job that ran to the end it is not even a shortfall. Where the
 * job moves the whole keyspace the total is a reading taken as it started, and a walk misses only
 * what leaves the keyspace while it runs — SCAN returns everything that stays for the whole walk.
 * Where the job was handed a list of names, a name on it may simply have had nothing behind it.
 * Either way the line is worth having, because two counts that do not agree are the first thing
 * somebody notices.
 */
const endedShort = (job: MigrationJob): boolean =>
  job.state !== 'RUNNING' && !!job.total && handledBy(job) < job.total;

/** How many of the expected keys the walk never found. */
const missingFrom = (job: MigrationJob): number =>
  job.total ? Math.max(0, job.total - handledBy(job)) : 0;

/**
 * How fast it is going, and how long is left at that speed.
 *
 * <p>The two numbers a migration is actually watched for, and neither was shown. A percentage
 * answers "how far", which on a job of a million keys is the least useful of the three: somebody
 * standing over it wants to know whether to wait or come back after lunch.
 *
 * <p>Averaged since the job started rather than sampled over a window. A window is more responsive
 * and would mean keeping state that changes on every update, which is a lot of machinery for a
 * number read at a glance — and the average is honest as long as it is not shown before it means
 * anything, which is why the first seconds are skipped.
 */
const rateOf = (job: MigrationJob | undefined): { perSecond: number; secondsLeft?: number } => {
  if (!job || job.state !== 'RUNNING' || !job.startedAt) {
    return { perSecond: 0 };
  }
  const handled = job.migrated + job.skipped + job.failed;
  const seconds = (Date.now() - new Date(job.startedAt).getTime()) / 1000;
  // Nothing worth saying yet. The first seconds are the walk finding its first match, and a rate
  // averaged over those is a number that is about to be wrong.
  if (handled === 0 || seconds < 2) {
    return { perSecond: 0 };
  }
  const perSecond = Math.round(handled / seconds);
  if (perSecond <= 0 || !job.total) {
    return { perSecond: Math.max(0, perSecond) };
  }
  return { perSecond, secondsLeft: Math.max(0, Math.round((job.total - handled) / perSecond)) };
};

/** A duration a person reads at a glance, not a stopwatch. */
const readableTime = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m`;
  }
  const hours = Math.floor(seconds / 3600);
  return `${hours}h ${Math.round((seconds % 3600) / 60)}m`;
};

const variantOf = (job: MigrationJob): ProgressVariant | undefined => {
  if (job.state === 'FAILED' || job.failed > 0) {
    return ProgressVariant.danger;
  }
  return job.state === 'DONE' ? ProgressVariant.success : undefined;
};

/**
 * Moves keys to another target, and watches it happen.
 *
 * <p>The job is followed over the notification hub rather than by holding the request open: a
 * migration of a large keyspace runs for minutes, and a dialog that owned the request would lose
 * the job the moment the page was reloaded. Here the numbers come from the server's own broadcast,
 * so a second tab watching the same job sees exactly the same thing.
 */
export const MigrateKeysModal: FC<MigrateKeysModalProps> = ({
  connectionId,
  match,
  selectedKeys,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  // Grouped, in whichever language the interface is in. Six figures without separators is a
  // string somebody has to count digits in to read — and these are the numbers the dialog exists
  // to report. The interpolated counts are grouped by i18next's own number format for the same
  // reason; these are bare and need doing here.
  const grouped = (value: number): string => value.toLocaleString(i18n.language);
  const connections = useConnections();
  const { job, isStarting, error, recorded, start, cancel } = useMigration(connectionId);

  const [target, setTarget] = useState('');
  // Whatever was already said counts: the ticked rows first, then the filter on screen.
  const [scope, setScope] = useState<Scope>(
    selectedKeys.length > 0 ? Scope.Selection : Scope.Filter,
  );
  const [pattern, setPattern] = useState(match || '*');
  const [replace, setReplace] = useState(false);
  const [deleteFromSource, setDeleteFromSource] = useState(false);
  const [typedTarget, setTypedTarget] = useState('');
  const [typedSource, setTypedSource] = useState('');
  /*
   * The three that shape a migration rather than choose one, folded away because most migrations
   * do not shape anything: move these keys, to that server, done. A form that asked every question
   * up front would ask four more of everybody to serve the few who need them.
   */
  const [shaping, setShaping] = useState(false);
  const [shape, setShape] = useState(emptyShape);
  const patchShape = (patch: Partial<MigrationShape>) =>
    setShape((current) => ({ ...current, ...patch }));

  // Only targets that are answering, and never the one being read from.
  const candidates = (connections.data ?? []).filter(
    (profile) => profile.id !== connectionId && profile.status.state === ConnectionState.Up,
  );

  /*
   * Which ends of this move ask to be named.
   *
   * <p>The destination always, because a migration writes into it. The source only when the keys
   * are being taken off it — a copy reads and leaves everything where it was, and asking somebody
   * to name a server they are not changing is how a guard stops being read.
   */
  const destination = candidates.find((profile) => String(profile.id) === target);
  const source = (connections.data ?? []).find((profile) => profile.id === connectionId);
  const guardedDestination = Boolean(destination?.guarded);
  const guardedSource = deleteFromSource && Boolean(source?.guarded);
  const named =
    (!guardedDestination || typedTarget === destination?.name) &&
    (!guardedSource || typedSource === source?.name);

  const isRunning = job?.state === 'RUNNING';
  const rate = rateOf(job);

  return (
    <Modal isOpen variant="medium" onClose={onClose} aria-labelledby="migrate-keys-modal-title">
      <ModalHeader
        labelId="migrate-keys-modal-title"
        title={t('Migrate.TITLE')}
        description={t('Migrate.DESCRIPTION')}
      />
      <ModalBody>
        <Stack hasGutter>
          {error ? (
            <StackItem>
              <Alert variant="danger" isInline title={t('Migrate.FAILED')}>
                {error}
              </Alert>
            </StackItem>
          ) : null}

          {/* Not an error. The migration is arranged and a colleague has to agree to it, so
              this is the same news as "started" with a different next step. */}
          {recorded ? (
            <StackItem>
              <Alert variant="info" isInline title={t('Approvals.RECORDED')}>
                {recorded}
              </Alert>
            </StackItem>
          ) : null}

          {job ? (
            <StackItem>
              {job.total || job.state !== 'RUNNING' ? (
                <Stack hasGutter>
                  {/* The share on the outside, which is where PatternFly puts a percentage when
                      it is the headline rather than a footnote. A custom label replaces it, so
                      the count that used to sit there moves to the line underneath — where the
                      two numbers somebody actually waits on can sit beside it. */}
                  <StackItem>
                    <Progress
                      value={percentOf(job)}
                      title={t('Migrate.PROGRESS_TITLE')}
                      measureLocation={ProgressMeasureLocation.outside}
                      variant={variantOf(job)}
                      aria-label={t('Migrate.PROGRESS_TITLE')}
                    />
                  </StackItem>
                  <StackItem>
                    <Flex
                      spaceItems={{ default: 'spaceItemsMd' }}
                      justifyContent={{ default: 'justifyContentSpaceBetween' }}
                    >
                      <FlexItem>
                        <Content component={ContentVariants.small}>
                          {/* A job still running is measured against the estimate, because that
                              is what the bar beside it is measured against. One that finished
                              reports what it actually did: the estimate has been overtaken by
                              the walk, and "840,741 of 859,062" beside a full bar is the same
                              contradiction the other way round. */}
                          {!job.total || job.state === 'DONE'
                            ? t('Migrate.PROGRESS_COUNT_DONE', { handled: handledBy(job) })
                            : t('Migrate.PROGRESS_COUNT', {
                                handled: handledBy(job),
                                total: job.total,
                              })}
                        </Content>
                      </FlexItem>
                      {/* A job that failed has an alert of its own saying so, and a second line
                          repeating that it did not finish adds nothing. These two are the cases
                          where the numbers need a word: one somebody stopped, and one that ended
                          on its own having found fewer keys than were counted for it. */}
                      {endedShort(job) && (job.state === 'DONE' || job.state === 'CANCELLED') ? (
                        <FlexItem>
                          <Content component={ContentVariants.small}>
                            {job.state === 'CANCELLED'
                              ? t('Migrate.ENDED_STOPPED')
                              : t('Migrate.ENDED_SHORT', { missing: missingFrom(job) })}
                          </Content>
                        </FlexItem>
                      ) : null}
                      {rate.perSecond > 0 && job.state === 'RUNNING' ? (
                        <FlexItem>
                          <Content component={ContentVariants.small}>
                            {rate.secondsLeft === undefined
                              ? t('Migrate.RATE', { rate: rate.perSecond })
                              : t('Migrate.RATE_AND_LEFT', {
                                  rate: rate.perSecond,
                                  left: readableTime(rate.secondsLeft),
                                })}
                          </Content>
                        </FlexItem>
                      ) : null}
                    </Flex>
                  </StackItem>
                </Stack>
              ) : (
                // No denominator exists for a glob, so there is no bar to draw. A count that
                // climbs says the same thing honestly; a bar filled from what the walk has
                // found would sit at full from the first batch and mean nothing.
                <Flex
                  spaceItems={{ default: 'spaceItemsSm' }}
                  alignItems={{ default: 'alignItemsCenter' }}
                  flexWrap={{ default: 'nowrap' }}
                  justifyContent={{ default: 'justifyContentSpaceBetween' }}
                >
                  <Flex
                    spaceItems={{ default: 'spaceItemsSm' }}
                    alignItems={{ default: 'alignItemsCenter' }}
                    flexWrap={{ default: 'nowrap' }}
                  >
                    <FlexItem>
                      <Spinner size="md" aria-label={t('Migrate.PROGRESS_TITLE')} />
                    </FlexItem>
                    {/* Not a paragraph: a paragraph brings its own margins, which put the title
                        on a different line from the spinner beside it. */}
                    {/* Before the first batch there is nothing to report but the fact that
                        something is happening, and "0 moved so far" reads like a stall. What
                        takes the time is the walk starting — a selective pattern reads the
                        whole keyspace to find its first match — so say that instead. */}
                    <FlexItem>
                      {job.scanned === 0 ? t('Migrate.PREPARING') : t('Migrate.PROGRESS_TITLE')}
                    </FlexItem>
                  </Flex>
                  <FlexItem>
                    <Content component={ContentVariants.small}>
                      {job.scanned === 0
                        ? t('Migrate.PREPARING_HINT')
                        : t('Migrate.PROGRESS_LABEL_UNCOUNTED', { handled: handledBy(job) })}
                    </Content>
                  </FlexItem>
                </Flex>
              )}
              <DescriptionList isHorizontal isCompact isFluid>
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('Migrate.MIGRATED')}</DescriptionListTerm>
                  <DescriptionListDescription>{grouped(job.migrated)}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('Migrate.SKIPPED')}</DescriptionListTerm>
                  <DescriptionListDescription>{grouped(job.skipped)}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('Migrate.FAILED_COUNT')}</DescriptionListTerm>
                  <DescriptionListDescription>{grouped(job.failed)}</DescriptionListDescription>
                </DescriptionListGroup>
                {job.dropped > 0 ? (
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Migrate.DROPPED')}</DescriptionListTerm>
                    <DescriptionListDescription>{grouped(job.dropped)}</DescriptionListDescription>
                  </DescriptionListGroup>
                ) : null}
                {job.deleted > 0 ? (
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Migrate.DELETED')}</DescriptionListTerm>
                    <DescriptionListDescription>{grouped(job.deleted)}</DescriptionListDescription>
                  </DescriptionListGroup>
                ) : null}
              </DescriptionList>
              {job.reason ? <Alert variant="warning" isInline isPlain title={job.reason} /> : null}
            </StackItem>
          ) : (
            <StackItem>
              <Form>
                <FormGroup label={t('Migrate.TARGET')} isRequired fieldId="migrate-target">
                  <FormSelect
                    id="migrate-target"
                    value={target}
                    onChange={(_event, value) => setTarget(value)}
                  >
                    <FormSelectOption value="" label={t('Migrate.TARGET_PLACEHOLDER')} />
                    {candidates.map((profile) => (
                      <FormSelectOption
                        key={profile.id}
                        value={String(profile.id)}
                        label={`${profile.name} — ${profile.host}:${profile.port}`}
                      />
                    ))}
                  </FormSelect>
                  {candidates.length === 0 ? (
                    <FormHelperText>
                      <HelperText>
                        <HelperTextItem variant="warning">{t('Migrate.NO_TARGETS')}</HelperTextItem>
                      </HelperText>
                    </FormHelperText>
                  ) : null}
                </FormGroup>

                <FormGroup
                  label={t('Migrate.SCOPE')}
                  isStack
                  fieldId="migrate-scope"
                  role="radiogroup"
                >
                  {selectedKeys.length > 0 ? (
                    <Radio
                      id="migrate-scope-selection"
                      name="migrate-scope"
                      label={t('Migrate.SCOPE_SELECTION', { count: selectedKeys.length })}
                      isChecked={scope === Scope.Selection}
                      onChange={() => setScope(Scope.Selection)}
                    />
                  ) : null}
                  <Radio
                    id="migrate-scope-filter"
                    name="migrate-scope"
                    label={
                      match ? t('Migrate.SCOPE_FILTER', { match }) : t('Migrate.SCOPE_EVERYTHING')
                    }
                    isChecked={scope === Scope.Filter}
                    onChange={() => setScope(Scope.Filter)}
                  />
                  <Radio
                    id="migrate-scope-pattern"
                    name="migrate-scope"
                    label={t('Migrate.SCOPE_PATTERN')}
                    isChecked={scope === Scope.Pattern}
                    onChange={() => setScope(Scope.Pattern)}
                    body={
                      scope === Scope.Pattern ? (
                        <TextInput
                          id="migrate-pattern"
                          aria-label={t('Migrate.SCOPE_PATTERN')}
                          value={pattern}
                          onChange={(_event, value) => setPattern(value)}
                        />
                      ) : null
                    }
                  />
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem>{t('Migrate.PATTERN_HELP')}</HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>

                <FormGroup fieldId="migrate-options">
                  <Checkbox
                    id="migrate-replace"
                    label={t('Migrate.REPLACE')}
                    description={t('Migrate.REPLACE_HELP')}
                    isChecked={replace}
                    onChange={(_event, checked) => setReplace(checked)}
                  />
                  <Checkbox
                    id="migrate-delete"
                    label={t('Migrate.DELETE_SOURCE')}
                    description={t('Migrate.DELETE_SOURCE_HELP')}
                    isChecked={deleteFromSource}
                    onChange={(_event, checked) => setDeleteFromSource(checked)}
                  />
                </FormGroup>

                {guardedDestination && destination ? (
                  <NameToProceed
                    name={destination.name}
                    value={typedTarget}
                    onChange={setTypedTarget}
                    id="migrate-name-destination"
                  />
                ) : null}
                {guardedSource && source ? (
                  <NameToProceed
                    name={source.name}
                    value={typedSource}
                    onChange={setTypedSource}
                    id="migrate-name-source"
                  />
                ) : null}

                <ExpandableSection
                  toggleText={t('Migrate.SHAPING')}
                  isExpanded={shaping}
                  onToggle={(_event, expanded) => setShaping(expanded)}
                >
                  <MigrationShaping idPrefix="migrate" shape={shape} onChange={patchShape} />
                </ExpandableSection>
              </Form>
            </StackItem>
          )}
        </Stack>
      </ModalBody>
      <ModalFooter>
        {job ? (
          <>
            {isRunning ? (
              <Button variant="danger" onClick={cancel}>
                {t('Migrate.STOP')}
              </Button>
            ) : null}
            <Button variant="link" onClick={onClose}>
              {isRunning ? t('Migrate.RUN_IN_BACKGROUND') : t('Migrate.CLOSE')}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="primary"
              isDisabled={!target || isStarting || !named}
              isLoading={isStarting}
              onClick={() =>
                start({
                  targetConnectionId: Number(target),
                  // A selection is sent as names; the other two are globs the server walks.
                  ...(scope === Scope.Selection
                    ? { keys: selectedKeys }
                    : { match: scope === Scope.Filter ? match || '*' : pattern }),
                  // Left out entirely when not asked for, rather than sent as empty strings: an
                  // empty prefix is not a prefix, and the server should not have to know that.
                  ...shapeToRequest(shape),
                  replace,
                  deleteFromSource,
                  // Two names, because a move is two operations on two servers and one name
                  // cannot say which was meant when both of them ask.
                  confirmTarget: guardedDestination ? typedTarget : undefined,
                  confirmSource: guardedSource ? typedSource : undefined,
                })
              }
            >
              {t('Migrate.START')}
            </Button>
            <Button variant="link" onClick={onClose}>
              {t('Migrate.CANCEL')}
            </Button>
          </>
        )}
      </ModalFooter>
    </Modal>
  );
};
