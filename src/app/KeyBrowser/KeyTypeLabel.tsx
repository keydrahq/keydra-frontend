import type { FC } from 'react';
import { Label } from '@patternfly/react-core';

export interface KeyTypeLabelProps {
  type: string;
}

/** Colour per value type, so a mixed keyspace is scannable by eye. */
const COLORS: Record<string, 'blue' | 'green' | 'orange' | 'purple' | 'teal' | 'grey'> = {
  string: 'blue',
  hash: 'green',
  list: 'orange',
  set: 'purple',
  zset: 'teal',
  stream: 'grey',
};

export const KeyTypeLabel: FC<KeyTypeLabelProps> = ({ type }) => (
  <Label isCompact color={COLORS[type] ?? 'grey'}>
    {type}
  </Label>
);
