import type { FC } from 'react';
import { useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Content,
  ExpandableSection,
  Form,
  FormGroup,
  FormHelperText,
  FormSection,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  NumberInput,
  Switch,
  TextInput,
  TimePicker,
} from '@patternfly/react-core';
import { FormSelect, FormSelectOption } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { useDestinations } from '@app/Backups/queries';
import { Permission, usePermissionCheck } from '@app/Login/queries';
import { MigrationShaping, shapeFrom } from '@app/KeyBrowser/MigrationShaping';
import type { MigrationShape } from '@app/KeyBrowser/MigrationShaping';
import { defaultCadence, fromCron, toCron } from './cron';
import type { Cadence, Every } from './cron';
import { useJobTypes, useSaveSchedule, useScheduleTargets } from './queries';
import { NameToProceed } from '@app/Shared/Components/NameToProceed';
import type { TargetChoice } from './queries';
import { parseSettings, serialiseSettings, settingsAreComplete } from './settings';
import { JobType } from './types';
import type { JobSettings, ScheduleSummary } from './types';

/** Sunday first, matching cron's own numbering. */
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

/** The 29th onwards is a month that sometimes has no such day, so the picker stops before it. */
const MONTH_DAYS = Array.from({ length: 28 }, (_unused, index) => index + 1);

const CADENCES: Every[] = ['minutes', 'hourly', 'daily', 'weekly', 'monthly', 'custom'];

export interface ScheduleDialogProps {
  /** Absent for a new schedule. */
  schedule?: ScheduleSummary;
  onClose: () => void;
}

/**
 * Writing a schedule.
 *
 * <p>Three questions in the order somebody thinks of them: what to do, where, and how often. The
 * target comes second rather than first because which servers can be offered depends on what is
 * being asked for — somebody may empty one cache and copy from another, and a list of every target
 * would be a list of refusals waiting to happen.
 *
 * <p>The cadence is a set of controls rather than a cron field, and still ends as a crontab line:
 * the schedules Keydra takes over come from somebody's crontab, so the expression stays the thing
 * being edited and "Custom" is one option among six rather than the only way in.
 */
export const ScheduleDialog: FC<ScheduleDialogProps> = ({ schedule, onClose }) => {
  const { t } = useTranslation();
  const save = useSaveSchedule();
  const connections = useScheduleTargets();
  const jobTypes = useJobTypes();
  const holds = usePermissionCheck();

  const [name, setName] = useState(schedule?.name ?? '');
  const [jobType, setJobType] = useState<JobType>(schedule?.jobType ?? JobType.FlushDatabase);
  const [connectionId, setConnectionId] = useState<number | undefined>(schedule?.connectionId);
  const [enabled, setEnabled] = useState(schedule?.enabled ?? true);
  const [settings, setSettings] = useState<JobSettings>(() => parseSettings(schedule?.settings));
  const [cadence, setCadence] = useState<Cadence>(() =>
    schedule ? fromCron(schedule.cron) : defaultCadence,
  );
  const [typed, setTyped] = useState('');
  const [typedSecond, setTypedSecond] = useState('');

  const patch = (change: Partial<JobSettings>) => setSettings((held) => ({ ...held, ...change }));
  const requires =
    jobTypes.data?.find((info) => info.name === jobType)?.requires ?? Permission.KeysDelete;

  /**
   * The targets this piece of work can be arranged on.
   *
   * <p>Both permissions, because both are asked: managing schedules is what the endpoint checks,
   * and the work's own permission is what the run checks every time it comes round.
   */
  const targets = useMemo(
    () =>
      (connections.data ?? []).filter(
        (profile: TargetChoice) =>
          holds(Permission.ScheduleManage, profile.id) && holds(requires, profile.id),
      ),
    // `holds` is rebuilt each render from the permissions query, so the dependency that
    // actually changes is the data behind it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connections.data, requires],
  );

  const cron = toCron(cadence);

  /*
   * A schedule that would empty a guarded target names it here, where the intent is. Nobody is
   * present when it fires, so asking then would be a schedule that looked arranged and silently
   * refused itself every night.
   *
   * Only the two job types that take something away. A backup or a sample reaches the same target
   * and leaves it as it was, and asking there is how a guard stops being read.
   */
  const chosen = targets.find((profile: TargetChoice) => profile.id === connectionId);
  const emptiesTheTarget = jobType === JobType.FlushDatabase || jobType === JobType.CopyKeys;
  const mustName = emptiesTheTarget && Boolean(chosen?.guarded);

  /*
   * And the far end of a copy, which is the same act on a different server: writing into it
   * unattended, every night, overwriting what is there. Phase 59 asked for the near one only, so
   * a nightly copy could overwrite a guarded server without anybody ever typing its name — the
   * job supplies both names itself when it fires, so this is the one moment a person is asked.
   */
  const destination =
    jobType === JobType.CopyKeys
      ? targets.find((profile: TargetChoice) => profile.id === settings.targetConnectionId)
      : undefined;
  const mustNameSecond = Boolean(destination?.guarded);

  const ready =
    !!name.trim() &&
    connectionId !== undefined &&
    !!cron &&
    settingsAreComplete(jobType, settings) &&
    (!mustName || typed === chosen?.name) &&
    (!mustNameSecond || typedSecond === destination?.name);

  const submit = () =>
    save.mutate(
      {
        id: schedule?.id,
        request: {
          name: name.trim(),
          connectionId: connectionId as number,
          jobType,
          cron,
          enabled,
          settings: serialiseSettings(jobType, settings),
          confirmTarget: mustName ? typed : undefined,
          confirmSecond: mustNameSecond ? typedSecond : undefined,
        },
      },
      { onSuccess: onClose },
    );

  const title = schedule ? t('Schedules.EDIT_TITLE') : t('Schedules.ADD_TITLE');

  return (
    <Modal isOpen variant="medium" onClose={onClose} aria-label={title}>
      <ModalHeader title={title} description={t('Schedules.DIALOG_INTRO')} />
      <ModalBody>
        <Form>
          <FormGroup label={t('Schedules.NAME')} isRequired fieldId="schedule-name">
            <TextInput
              id="schedule-name"
              value={name}
              onChange={(_event, value) => setName(value)}
              isRequired
            />
            <FormHelperText>
              <HelperText>
                <HelperTextItem>{t('Schedules.NAME_HELP')}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>

          <FormGroup label={t('Schedules.WHAT')} isRequired fieldId="schedule-job-type">
            <FormSelect
              id="schedule-job-type"
              value={jobType}
              onChange={(_event, value) => {
                setJobType(value as JobType);
                // The settings of the kind just left mean nothing to the kind just chosen,
                // and a target chosen for one may not be one this may run on.
                setSettings({});
                setConnectionId(undefined);
              }}
            >
              {Object.values(JobType).map((type) => (
                <FormSelectOption
                  key={type}
                  value={type}
                  label={t(`Schedules.JOB_${type}` as 'Schedules.JOB_FLUSH_DATABASE')}
                />
              ))}
            </FormSelect>
            <FormHelperText>
              <HelperText>
                <HelperTextItem>
                  {t(`Schedules.JOB_${jobType}_HELP` as 'Schedules.JOB_FLUSH_DATABASE_HELP')}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>

          <FormGroup label={t('Schedules.TARGET')} isRequired fieldId="schedule-connection">
            <FormSelect
              id="schedule-connection"
              value={connectionId ?? ''}
              isDisabled={targets.length === 0}
              onChange={(_event, value) => setConnectionId(value ? Number(value) : undefined)}
            >
              <FormSelectOption value="" label={t('Schedules.CHOOSE_TARGET')} isPlaceholder />
              {targets.map((profile) => (
                <FormSelectOption key={profile.id} value={profile.id} label={profile.name} />
              ))}
            </FormSelect>
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant={targets.length === 0 ? 'warning' : 'default'}>
                  {targets.length === 0
                    ? t('Schedules.NO_TARGETS_FOR_JOB')
                    : t('Schedules.TARGET_HELP')}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>

          <FormSection title={t('Schedules.SETTINGS')} titleElement="h3">
            <JobFields
              jobType={jobType}
              settings={settings}
              patch={patch}
              connectionId={connectionId}
            />
          </FormSection>

          <FormSection title={t('Schedules.WHEN')} titleElement="h3">
            <FormGroup label={t('Schedules.CADENCE')} fieldId="schedule-cadence">
              <FormSelect
                id="schedule-cadence"
                value={cadence.every}
                onChange={(_event, value) =>
                  setCadence((held) => ({
                    ...held,
                    every: value as Every,
                    // Switching into Custom starts from the line the controls were
                    // already describing, so nothing is lost by looking.
                    expression: value === 'custom' ? toCron(held) : held.expression,
                  }))
                }
              >
                {CADENCES.map((every) => (
                  <FormSelectOption
                    key={every}
                    value={every}
                    label={t(`Schedules.EVERY_${every}` as 'Schedules.EVERY_daily')}
                  />
                ))}
              </FormSelect>
            </FormGroup>

            {cadence.every === 'minutes' && (
              <FormGroup label={t('Schedules.INTERVAL')} fieldId="schedule-interval">
                <NumberInput
                  id="schedule-interval"
                  value={cadence.interval}
                  min={1}
                  max={59}
                  unit={t('Schedules.MINUTES')}
                  onMinus={() =>
                    setCadence((held) => ({ ...held, interval: Math.max(1, held.interval - 1) }))
                  }
                  onPlus={() =>
                    setCadence((held) => ({ ...held, interval: Math.min(59, held.interval + 1) }))
                  }
                  onChange={(event) =>
                    setCadence((held) => ({
                      ...held,
                      interval: Number((event.target as HTMLInputElement).value) || 1,
                    }))
                  }
                  inputAriaLabel={t('Schedules.INTERVAL')}
                  minusBtnAriaLabel={t('Schedules.FEWER')}
                  plusBtnAriaLabel={t('Schedules.MORE')}
                />
              </FormGroup>
            )}

            {cadence.every === 'hourly' && (
              <FormGroup label={t('Schedules.MINUTE_PAST')} fieldId="schedule-minute">
                <NumberInput
                  id="schedule-minute"
                  value={cadence.minute}
                  min={0}
                  max={59}
                  onMinus={() =>
                    setCadence((held) => ({ ...held, minute: Math.max(0, held.minute - 1) }))
                  }
                  onPlus={() =>
                    setCadence((held) => ({ ...held, minute: Math.min(59, held.minute + 1) }))
                  }
                  onChange={(event) =>
                    setCadence((held) => ({
                      ...held,
                      minute: Number((event.target as HTMLInputElement).value) || 0,
                    }))
                  }
                  inputAriaLabel={t('Schedules.MINUTE_PAST')}
                  minusBtnAriaLabel={t('Schedules.FEWER')}
                  plusBtnAriaLabel={t('Schedules.MORE')}
                />
              </FormGroup>
            )}

            {cadence.every === 'weekly' && (
              <FormGroup label={t('Schedules.WEEKDAY')} fieldId="schedule-weekday">
                <FormSelect
                  id="schedule-weekday"
                  value={cadence.weekday}
                  onChange={(_event, value) =>
                    setCadence((held) => ({ ...held, weekday: Number(value) }))
                  }
                >
                  {WEEKDAYS.map((day) => (
                    <FormSelectOption
                      key={day}
                      value={day}
                      label={t(`Schedules.DAY_${day}` as 'Schedules.DAY_0')}
                    />
                  ))}
                </FormSelect>
              </FormGroup>
            )}

            {cadence.every === 'monthly' && (
              <FormGroup label={t('Schedules.DAY_OF_MONTH')} fieldId="schedule-day">
                <FormSelect
                  id="schedule-day"
                  value={cadence.day}
                  onChange={(_event, value) =>
                    setCadence((held) => ({ ...held, day: Number(value) }))
                  }
                >
                  {MONTH_DAYS.map((day) => (
                    <FormSelectOption key={day} value={day} label={String(day)} />
                  ))}
                </FormSelect>
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>{t('Schedules.DAY_OF_MONTH_HELP')}</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>
            )}

            {['daily', 'weekly', 'monthly'].includes(cadence.every) && (
              <FormGroup label={t('Schedules.TIME_OF_DAY')} fieldId="schedule-time">
                <TimePicker
                  id="schedule-time"
                  time={cadence.time}
                  is24Hour
                  // The menu belongs to the document rather than to the form, or the
                  // modal's own scroll container clips it.
                  menuAppendTo={() => document.body}
                  onChange={(_event, value) => setCadence((held) => ({ ...held, time: value }))}
                  aria-label={t('Schedules.TIME_OF_DAY')}
                />
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>{t('Schedules.TIME_ZONE_HELP')}</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>
            )}

            {cadence.every === 'custom' && (
              <FormGroup label={t('Schedules.EXPRESSION')} isRequired fieldId="schedule-cron">
                <TextInput
                  id="schedule-cron"
                  value={cadence.expression}
                  onChange={(_event, value) =>
                    setCadence((held) => ({ ...held, expression: value }))
                  }
                  isRequired
                />
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>{t('Schedules.EXPRESSION_HELP')}</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>
            )}

            <FormGroup fieldId="schedule-cron-preview">
              <Content component="small" className="pf-v6-u-text-color-subtle">
                {t('Schedules.CRON_PREVIEW')} <code>{cron || '—'}</code>
              </Content>
            </FormGroup>
          </FormSection>

          <FormGroup fieldId="schedule-enabled">
            <Switch
              id="schedule-enabled"
              label={t('Schedules.ENABLED')}
              isChecked={enabled}
              onChange={(_event, checked) => setEnabled(checked)}
            />
            <FormHelperText>
              <HelperText>
                <HelperTextItem>{t('Schedules.ENABLED_HELP')}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>

          {mustName && chosen ? (
            <NameToProceed
              name={chosen.name}
              value={typed}
              onChange={setTyped}
              id="schedule-name-target"
            />
          ) : null}

          {mustNameSecond && destination ? (
            <NameToProceed
              name={destination.name}
              value={typedSecond}
              onChange={setTypedSecond}
              id="schedule-name-destination"
            />
          ) : null}

          {save.isError && (
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant="error">{save.error.message}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" isDisabled={!ready || save.isPending} onClick={submit}>
          {t('Schedules.SAVE')}
        </Button>
        <Button variant="link" onClick={onClose}>
          {t('Schedules.CANCEL')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

/**
 * One shaping answer as a settings patch.
 *
 * <p>Only the rate needs translating: it is a number in the settings and a text box in the form,
 * and a box somebody emptied is not a ceiling of zero. Written out rather than spread, so clearing
 * a field clears it — a patch that left an emptied field out would merge the old value back.
 */
const asSettings = ({
  maxKeysPerSecond,
  ...rest
}: Partial<MigrationShape>): Partial<JobSettings> => ({
  ...rest,
  ...(maxKeysPerSecond === undefined
    ? {}
    : {
        maxKeysPerSecond: Number(maxKeysPerSecond) > 0 ? Number(maxKeysPerSecond) : undefined,
      }),
});

interface JobFieldsProps {
  jobType: JobType;
  settings: JobSettings;
  patch: (change: Partial<JobSettings>) => void;
  /** The source, so a copy cannot offer it as its own destination. */
  connectionId?: number;
}

/**
 * What one kind of work needs, and only that.
 *
 * <p>Each block reads the same JSON column and writes different fields of it, which is why changing
 * the kind clears it: leaving the old fields behind would send a copy's destination along with a
 * flush, where it would be ignored until somebody read the row and wondered.
 */
const JobFields: FC<JobFieldsProps> = ({ jobType, settings, patch, connectionId }) => {
  const { t } = useTranslation();
  const connections = useScheduleTargets();
  const holds = usePermissionCheck();
  // Open when the schedule already shapes something, so editing one does not hide its own answers.
  const [isShaping, setShaping] = useState(
    Boolean(
      settings.type ||
      settings.stripPrefix ||
      settings.addPrefix ||
      settings.script ||
      settings.maxKeysPerSecond,
    ),
  );
  // Read here rather than inside the branch below: a hook has to be called the same number
  // of times on every render, and the branch is a job type somebody can change.
  const places = useDestinations();

  const pattern = (
    <FormGroup label={t('Schedules.MATCH')} fieldId="schedule-match">
      <TextInput
        id="schedule-match"
        value={settings.match ?? '*'}
        onChange={(_event, value) => patch({ match: value })}
      />
      <FormHelperText>
        <HelperText>
          <HelperTextItem>{t('Schedules.MATCH_HELP')}</HelperTextItem>
        </HelperText>
      </FormHelperText>
    </FormGroup>
  );

  if (jobType === JobType.FlushDatabase) {
    return (
      <>
        {pattern}
        <FormGroup label={t('Schedules.DATABASE')} fieldId="schedule-database">
          <TextInput
            id="schedule-database"
            type="number"
            min={0}
            value={settings.database ?? ''}
            onChange={(_event, value) =>
              patch({ database: value === '' ? undefined : Number(value) })
            }
          />
          <FormHelperText>
            <HelperText>
              <HelperTextItem>{t('Schedules.DATABASE_HELP')}</HelperTextItem>
            </HelperText>
          </FormHelperText>
        </FormGroup>
      </>
    );
  }

  if (jobType === JobType.CopyKeys) {
    const destinations = (connections.data ?? []).filter(
      (profile: TargetChoice) =>
        profile.id !== connectionId && holds(Permission.MigrationRun, profile.id),
    );
    return (
      <>
        <FormGroup label={t('Schedules.DESTINATION')} isRequired fieldId="schedule-destination">
          <FormSelect
            id="schedule-destination"
            value={settings.targetConnectionId ?? ''}
            onChange={(_event, value) =>
              patch({ targetConnectionId: value ? Number(value) : undefined })
            }
          >
            <FormSelectOption value="" label={t('Schedules.CHOOSE_TARGET')} isPlaceholder />
            {destinations.map((profile) => (
              <FormSelectOption key={profile.id} value={profile.id} label={profile.name} />
            ))}
          </FormSelect>
          <FormHelperText>
            <HelperText>
              <HelperTextItem>{t('Schedules.DESTINATION_HELP')}</HelperTextItem>
            </HelperText>
          </FormHelperText>
        </FormGroup>
        {pattern}
        <FormGroup fieldId="schedule-replace">
          <Checkbox
            id="schedule-replace"
            label={t('Schedules.REPLACE')}
            description={t('Schedules.REPLACE_HELP')}
            isChecked={settings.replace ?? true}
            onChange={(_event, checked) => patch({ replace: checked })}
          />
          <Checkbox
            id="schedule-move"
            label={t('Schedules.MOVE')}
            description={t('Schedules.MOVE_HELP')}
            isChecked={settings.deleteFromSource ?? false}
            onChange={(_event, checked) => patch({ deleteFromSource: checked })}
          />
        </FormGroup>
        {/*
         * Folded away for the same reason it is in the migration dialog: most copies shape
         * nothing, and asking five more questions of everybody to serve the few who need them is
         * how a form becomes something people click past.
         */}
        <ExpandableSection
          toggleText={t('Migrate.SHAPING')}
          isExpanded={isShaping}
          onToggle={(_event, expanded) => setShaping(expanded)}
        >
          <MigrationShaping
            idPrefix="schedule"
            shape={shapeFrom(settings)}
            onChange={(change) => patch(asSettings(change))}
          />
        </ExpandableSection>
      </>
    );
  }

  const destinations = (places.data ?? []).filter((destination) => destination.enabled);

  return (
    <>
      <FormGroup label={t('Schedules.DESTINATION_PLACE')} isRequired fieldId="schedule-place">
        <FormSelect
          id="schedule-place"
          value={settings.destinationId ?? ''}
          isDisabled={destinations.length === 0}
          onChange={(_event, value) => patch({ destinationId: value ? Number(value) : undefined })}
        >
          <FormSelectOption value="" label={t('Schedules.CHOOSE_TARGET')} isPlaceholder />
          {destinations.map((destination) => (
            <FormSelectOption
              key={destination.id}
              value={destination.id}
              label={`${destination.name} — ${destination.describedAs}`}
            />
          ))}
        </FormSelect>
        <FormHelperText>
          <HelperText>
            <HelperTextItem variant={destinations.length === 0 ? 'warning' : 'default'}>
              {destinations.length === 0
                ? t('Schedules.NO_DESTINATIONS')
                : t('Schedules.DESTINATION_PLACE_HELP')}
            </HelperTextItem>
          </HelperText>
        </FormHelperText>
      </FormGroup>
      {pattern}
      <FormGroup label={t('Schedules.KEEP_LAST')} fieldId="schedule-keep">
        <TextInput
          id="schedule-keep"
          type="number"
          min={0}
          value={settings.keepLast ?? ''}
          onChange={(_event, value) =>
            patch({ keepLast: value === '' ? undefined : Number(value) })
          }
          placeholder={t('Schedules.KEEP_EVERYTHING')}
        />
        <FormHelperText>
          <HelperText>
            <HelperTextItem>{t('Schedules.KEEP_LAST_HELP')}</HelperTextItem>
          </HelperText>
        </FormHelperText>
      </FormGroup>
      <FormGroup label={t('Schedules.FILE_PREFIX')} fieldId="schedule-prefix">
        <TextInput
          id="schedule-prefix"
          value={settings.filePrefix ?? ''}
          placeholder={t('Schedules.FILE_PREFIX_DEFAULT')}
          validated={/[/\\]|\.\./.test(settings.filePrefix ?? '') ? 'error' : 'default'}
          onChange={(_event, value) => patch({ filePrefix: value })}
        />
        <FormHelperText>
          <HelperText>
            <HelperTextItem
              variant={/[/\\]|\.\./.test(settings.filePrefix ?? '') ? 'error' : 'default'}
            >
              {/[/\\]|\.\./.test(settings.filePrefix ?? '')
                ? t('Schedules.FILE_PREFIX_INVALID')
                : t('Schedules.FILE_PREFIX_HELP')}
            </HelperTextItem>
          </HelperText>
        </FormHelperText>
      </FormGroup>
    </>
  );
};
