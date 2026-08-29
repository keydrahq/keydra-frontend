import type { FC } from 'react';
import { useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Content,
  Form,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Switch,
  TextInput,
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { useAlertTargets } from './queries';
import { Permission, usePermissionCheck } from '@app/Login/queries';
import { useAlertDeliveries, useAlertMetrics, useSaveAlertRule } from './queries';
import { AlertBasis, AlertMetric, BASELINE_WINDOWS, Comparison, MetricUnit } from './types';
import type { AlertRuleSummary } from './types';
import { unitOf } from './wording';

/** The durations worth offering. Anything else is a number somebody made up. */
const DURATIONS = [0, 60, 300, 900, 3600];

export interface RuleDialogProps {
  /** Absent for a new rule. */
  rule?: AlertRuleSummary;
  onClose: () => void;
}

/**
 * Writing a rule.
 *
 * <p>Four questions in the order somebody thinks of them: which server, what about it, past what,
 * and for how long. The last one is the one people skip and then regret — without it every scrape
 * spike is an alert — so it has a default of five minutes rather than of zero.
 *
 * <p>A condition metric hides the threshold. "Not answering, above 0" is not a sentence anybody
 * means, and a form that asked for it would be inviting somebody to change a number that does
 * nothing.
 *
 * <p>The threshold can be a number or a share of what the metric did earlier, which is the same
 * question asked two ways: "above 800 MiB" needs somebody to already know this server, and "40%
 * above the same hour last week" does not. A rate between two readings and a yes-or-no condition
 * cannot have a baseline at all, so the choice is not offered for them.
 */
export const RuleDialog: FC<RuleDialogProps> = ({ rule, onClose }) => {
  const { t } = useTranslation();
  const save = useSaveAlertRule();
  const connections = useAlertTargets();
  const metrics = useAlertMetrics();
  const holds = usePermissionCheck();
  const maySend = holds(Permission.AlertDeliveryManage);
  // No argument: the one query behind this already answers null for the channels when the caller
  // may not manage them, and the hook reads that as none to offer. Passing the permission in as
  // well was asking the browser to decide something the server had already decided.
  const deliveries = useAlertDeliveries();

  const [name, setName] = useState(rule?.name ?? '');
  const [connectionId, setConnectionId] = useState<number | undefined>(rule?.connectionId);
  const [metric, setMetric] = useState<AlertMetric>(rule?.metric ?? AlertMetric.MemoryFillPercent);
  const [comparison, setComparison] = useState<Comparison>(rule?.comparison ?? Comparison.Above);
  const [basis, setBasis] = useState<AlertBasis>(rule?.basis ?? AlertBasis.Absolute);
  const [threshold, setThreshold] = useState(rule ? String(rule.threshold) : '80');
  const [baselineOffset, setBaselineOffset] = useState(rule?.baselineOffsetSeconds ?? 0);
  const [baselineWindow, setBaselineWindow] = useState(rule?.baselineWindowSeconds ?? 3600);
  const [forSeconds, setForSeconds] = useState(rule?.forSeconds ?? 300);
  const [deliveryIds, setDeliveryIds] = useState<number[]>(rule?.deliveryIds ?? []);
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);

  const targets = useMemo(
    () => (connections.data ?? []).filter((profile) => holds(Permission.AlertManage, profile.id)),
    // `holds` is rebuilt each render from the permissions query, so the dependency that
    // actually changes is the data behind it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connections.data],
  );

  const unit = metrics.data?.find((info) => info.name === metric)?.unit ?? unitOf(metric);
  const isCondition = unit === MetricUnit.Condition;
  // A rate is the difference between two readings, and an hour of them averaged into one
  // figure has no difference in it. The backend refuses these; the form does not offer them.
  const canCompareWithThePast =
    !isCondition &&
    metric !== AlertMetric.EvictedKeysPerMinute &&
    metric !== AlertMetric.ExpiredKeysPerMinute;
  const comparesWithThePast = canCompareWithThePast && basis === AlertBasis.Baseline;
  const ready =
    !!name.trim() && connectionId !== undefined && (isCondition || threshold.trim() !== '');

  const submit = () =>
    save.mutate(
      {
        id: rule?.id,
        request: {
          name: name.trim(),
          connectionId: connectionId as number,
          metric,
          comparison,
          basis: comparesWithThePast ? AlertBasis.Baseline : AlertBasis.Absolute,
          threshold: isCondition ? 0 : Number(threshold),
          baselineWindowSeconds: baselineWindow,
          baselineOffsetSeconds: baselineOffset,
          forSeconds,
          deliveryIds,
          enabled,
        },
      },
      { onSuccess: onClose },
    );

  return (
    <Modal isOpen variant="medium" onClose={onClose} aria-label={t('Alerts.ADD_TITLE')}>
      <ModalHeader title={rule ? t('Alerts.EDIT_TITLE') : t('Alerts.ADD_TITLE')} />
      <ModalBody>
        <Form
          id="alert-rule-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (ready) {
              submit();
            }
          }}
        >
          <FormGroup label={t('Alerts.NAME')} isRequired fieldId="alert-rule-name">
            <TextInput
              id="alert-rule-name"
              value={name}
              onChange={(_event, value) => setName(value)}
              placeholder={t('Alerts.NAME_PLACEHOLDER')}
            />
          </FormGroup>

          <FormGroup label={t('Alerts.TARGET')} isRequired fieldId="alert-rule-target">
            <FormSelect
              id="alert-rule-target"
              value={connectionId ?? ''}
              onChange={(_event, value) =>
                setConnectionId(value === '' ? undefined : Number(value))
              }
            >
              <FormSelectOption value="" label={t('Alerts.CHOOSE_TARGET')} isDisabled />
              {targets.map((profile) => (
                <FormSelectOption key={profile.id} value={profile.id} label={profile.name} />
              ))}
            </FormSelect>
            {targets.length === 0 && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="warning">{t('Alerts.NO_TARGETS')}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>

          <FormGroup label={t('Alerts.METRIC')} isRequired fieldId="alert-rule-metric">
            <FormSelect
              id="alert-rule-metric"
              value={metric}
              onChange={(_event, value) => setMetric(value as AlertMetric)}
            >
              {(metrics.data ?? []).map((info) => (
                <FormSelectOption
                  key={info.name}
                  value={info.name}
                  label={t(`Alerts.METRIC_${info.name}` as 'Alerts.METRIC_NO_ANSWER')}
                />
              ))}
            </FormSelect>
            <FormHelperText>
              <HelperText>
                <HelperTextItem>
                  {t(`Alerts.METRIC_HINT_${metric}` as 'Alerts.METRIC_HINT_NO_ANSWER', {
                    defaultValue: '',
                  })}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>

          {canCompareWithThePast && (
            <FormGroup label={t('Alerts.BASIS')} fieldId="alert-rule-basis">
              <FormSelect
                id="alert-rule-basis"
                value={basis}
                onChange={(_event, value) => {
                  const chosen = value as AlertBasis;
                  setBasis(chosen);
                  // A percentage where an amount was, and the other way round: 80 megabytes
                  // read as 80 per cent is a rule that fires on everything.
                  setThreshold(chosen === AlertBasis.Baseline ? '140' : '80');
                }}
                aria-label={t('Alerts.BASIS')}
              >
                <FormSelectOption value={AlertBasis.Absolute} label={t('Alerts.BASIS_ABSOLUTE')} />
                <FormSelectOption value={AlertBasis.Baseline} label={t('Alerts.BASIS_BASELINE')} />
              </FormSelect>
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>{t('Alerts.BASIS_HELP')}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>
          )}

          {comparesWithThePast && (
            <FormGroup label={t('Alerts.COMPARE_WITH')} fieldId="alert-rule-window">
              <FormSelect
                id="alert-rule-window"
                value={baselineOffset}
                onChange={(_event, value) => {
                  setBaselineOffset(Number(value));
                  setBaselineWindow(3600);
                }}
                aria-label={t('Alerts.COMPARE_WITH')}
              >
                {BASELINE_WINDOWS.map((window) => (
                  <FormSelectOption
                    key={window.offsetSeconds}
                    value={window.offsetSeconds}
                    label={t(window.labelKey)}
                  />
                ))}
              </FormSelect>
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>{t('Alerts.COMPARE_WITH_HELP')}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>
          )}

          {!isCondition && (
            <FormGroup
              label={comparesWithThePast ? t('Alerts.SHARE') : t('Alerts.THRESHOLD')}
              isRequired
              fieldId="alert-rule-threshold"
            >
              <div className="pf-v6-l-flex pf-m-space-items-sm">
                <FormSelect
                  id="alert-rule-comparison"
                  value={comparison}
                  onChange={(_event, value) => setComparison(value as Comparison)}
                  aria-label={t('Alerts.COMPARISON')}
                  style={{ maxWidth: '10rem' }}
                >
                  <FormSelectOption value={Comparison.Above} label={t('Alerts.ABOVE')} />
                  <FormSelectOption value={Comparison.Below} label={t('Alerts.BELOW')} />
                </FormSelect>
                <TextInput
                  id="alert-rule-threshold"
                  type="number"
                  value={threshold}
                  onChange={(_event, value) => setThreshold(value)}
                  aria-label={t('Alerts.THRESHOLD')}
                />
              </div>
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>
                    {comparesWithThePast
                      ? t('Alerts.SHARE_HELP')
                      : t(`Alerts.UNIT_${unit}` as 'Alerts.UNIT_PERCENT')}
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>
          )}

          <FormGroup label={t('Alerts.FOR')} fieldId="alert-rule-for">
            <FormSelect
              id="alert-rule-for"
              value={forSeconds}
              onChange={(_event, value) => setForSeconds(Number(value))}
            >
              {DURATIONS.map((seconds) => (
                <FormSelectOption
                  key={seconds}
                  value={seconds}
                  label={t(`Alerts.FOR_${seconds}` as 'Alerts.FOR_0')}
                />
              ))}
            </FormSelect>
            <FormHelperText>
              <HelperText>
                <HelperTextItem>{t('Alerts.FOR_HINT')}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>

          <FormGroup label={t('Alerts.SENDS_TO')} fieldId="alert-rule-delivery">
            {/*
              Checkboxes rather than a multiple-select. A rule names two or three destinations
              out of a handful, and a multiple-select hides what is chosen behind a scroll and
              needs a modifier key to add a second — which is exactly the interaction somebody
              gets wrong while writing an alert at the moment they most want it right.
            */}
            {(deliveries.data ?? []).length === 0 ? (
              <Content component="small">{t('Alerts.NO_DELIVERIES')}</Content>
            ) : (
              (deliveries.data ?? []).map((delivery) => (
                <Checkbox
                  key={delivery.id}
                  id={`alert-rule-delivery-${delivery.id}`}
                  label={`${delivery.name} — ${delivery.describedAs}`}
                  isChecked={deliveryIds.includes(delivery.id)}
                  isDisabled={!maySend}
                  onChange={(_event, checked) =>
                    setDeliveryIds((held) =>
                      checked ? [...held, delivery.id] : held.filter((id) => id !== delivery.id),
                    )
                  }
                />
              ))
            )}
            <FormHelperText>
              <HelperText>
                <HelperTextItem>
                  {!maySend
                    ? t('Alerts.DELIVERY_ADMIN_ONLY')
                    : deliveryIds.length === 0
                      ? t('Alerts.IN_APP_ONLY_HINT')
                      : t('Alerts.SENDS_TO_HINT', { count: deliveryIds.length })}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>

          <FormGroup fieldId="alert-rule-enabled">
            <Switch
              id="alert-rule-enabled"
              label={t('Alerts.ENABLED')}
              isChecked={enabled}
              onChange={(_event, checked) => setEnabled(checked)}
            />
            <FormHelperText>
              <HelperText>
                <HelperTextItem>{t('Alerts.ENABLED_HINT')}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>

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
        <Button
          variant="primary"
          form="alert-rule-form"
          onClick={submit}
          isDisabled={!ready || save.isPending}
          isLoading={save.isPending}
        >
          {t('Alerts.SAVE')}
        </Button>
        <Button variant="link" onClick={onClose}>
          {t('Alerts.CANCEL')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
