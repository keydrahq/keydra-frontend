import type { FC } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  Chart,
  ChartAxis,
  ChartGroup,
  ChartLine,
  ChartVoronoiContainer,
} from '@patternfly/react-charts/victory';
import { useTranslation } from 'react-i18next';
import { EmptyState, EmptyStateBody } from '@patternfly/react-core';
import type { MetricsSample } from './types';

export interface MetricChartProps {
  samples: MetricsSample[];
  /** Reads the number to plot; null for a reading that does not carry it. */
  pick: (sample: MetricsSample) => number | null;
  /** Formats a value for the axis and the tooltip. */
  format: (value: number) => string;
  label: string;
  height?: number;
}

/**
 * One measurement over time.
 *
 * <p>Readings that do not carry the number are dropped rather than plotted as zero: a server that
 * does not report a figure is not a server reporting nothing happening, and a line falling to the
 * axis says the second thing.
 */
export const MetricChart: FC<MetricChartProps> = ({
  samples,
  pick,
  format,
  label,
  height = 180,
}) => {
  const { t } = useTranslation();

  // Victory draws at a fixed size and, left to itself, scales the finished SVG to fit —
  // which stretches the tick labels along with the plot. Measuring the card instead means
  // the chart is drawn at the size it is shown at, so the text stays the size it was set.
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = container.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const points = samples
    .map((sample) => ({ x: new Date(sample.at), y: pick(sample) }))
    .filter((point): point is { x: Date; y: number } => point.y !== null);

  // Time labels are chosen for the window on screen. A dashboard opened a minute ago has
  // every reading inside the same minute, and an axis reading "04:06" six times says
  // nothing about when anything happened.
  const spanMs =
    points.length === 0 ? 0 : points[points.length - 1].x.getTime() - points[0].x.getTime();
  const timeFormat: Intl.DateTimeFormatOptions =
    spanMs < 10 * 60 * 1000
      ? { minute: '2-digit', second: '2-digit' }
      : { hour: '2-digit', minute: '2-digit' };

  // A flat series would otherwise be given four ticks that all round to the same label.
  const values = points.map((point) => point.y);
  const isFlat = values.length === 0 || Math.max(...values) === Math.min(...values);

  return (
    /*
     * The measured element is always here, whether there is anything to draw or not. It used
     * to be replaced by the empty state while a series was empty, which is a swap the resize
     * observer cannot survive: it watches one element, that element goes away, and the chart
     * that replaces it is measured as zero wide and draws nothing. The symptom was a card
     * that stayed blank after switching to a window whose readings had not arrived yet.
     */
    <div ref={container} style={{ height }}>
      {points.length === 0 ? (
        <EmptyState titleText={t('Monitoring.NO_DATA')} headingLevel="h4" variant="xs">
          <EmptyStateBody>{t('Monitoring.NO_DATA_BODY')}</EmptyStateBody>
        </EmptyState>
      ) : width > 0 ? (
        <Chart
          ariaTitle={label}
          containerComponent={
            <ChartVoronoiContainer
              labels={({ datum }) => `${format(datum.y as number)}`}
              constrainToVisibleArea
            />
          }
          height={height}
          padding={{ top: 12, bottom: 34, left: 72, right: 16 }}
          width={width}
        >
          <ChartAxis
            tickCount={4}
            // Victory hands ticks back as numbers rather than the Dates it was given, so the
            // value is normalised rather than assumed: assuming cost the whole chart, which
            // threw and took the dashboard's subtree down with it.
            tickFormat={(tick: unknown) =>
              new Date(tick as number | string | Date).toLocaleTimeString(undefined, timeFormat)
            }
          />
          <ChartAxis
            dependentAxis
            tickCount={isFlat ? 1 : 4}
            tickFormat={(tick: unknown) => format(Number(tick))}
          />
          <ChartGroup>
            {/* Straight lines between measured points. A smoothed curve invents readings
              between samples — with a counter alternating between 0 and 1 it draws a sine
              wave, which is a picture of something that never happened. */}
            <ChartLine data={points} name={label} interpolation="linear" />
          </ChartGroup>
        </Chart>
      ) : null}
    </div>
  );
};
