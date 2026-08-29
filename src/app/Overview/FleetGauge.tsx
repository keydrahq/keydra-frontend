import type { FC } from 'react';
import { ChartDonutUtilization } from '@patternfly/react-charts/victory';
import { useTranslation } from 'react-i18next';

export interface FleetGaugeProps {
  used: number;
  total: number;
  label: string;
}

/**
 * How much of a limit is in use, as a ring.
 *
 * <p>A ring rather than a number because the question is a proportion: "eleven gigabytes" means
 * nothing without the ceiling beside it, and a reader comparing several targets is comparing
 * fullness rather than size.
 *
 * <p>PatternFly's utilization donut carries its own thresholds, so the colour changes on its own as
 * a target fills — nothing here decides what "nearly full" looks like.
 */
export const FleetGauge: FC<FleetGaugeProps> = ({ used, total, label }) => {
  const { t } = useTranslation();
  const percent = total > 0 ? Math.round((used / total) * 100) : 0;

  return (
    <ChartDonutUtilization
      ariaDesc={label}
      ariaTitle={label}
      constrainToVisibleArea
      data={{ x: label, y: percent }}
      name={`fleet-gauge-${label}`}
      subTitle={t('Overview.OF_LIMIT')}
      title={`${percent}%`}
      thresholds={[{ value: 60 }, { value: 85 }]}
      height={180}
      width={230}
    />
  );
};
