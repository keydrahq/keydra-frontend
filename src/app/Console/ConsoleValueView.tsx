import type { FC } from 'react';
import { Label } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import type { ConsoleValue } from './types';

export interface ConsoleValueViewProps {
  value: ConsoleValue;
  /** Nesting level, so a nested array is indented rather than flattened. */
  depth?: number;
}

/**
 * Renders one reply.
 *
 * <p>Numbered like redis-cli, because that is the notation anyone reading a Redis console already
 * knows, and because position is meaningful in a reply that is a flat list of alternating names and
 * values.
 *
 * <p>The switch is exhaustive over the union: a reply shape the backend gains cannot silently
 * render as nothing.
 */
export const ConsoleValueView: FC<ConsoleValueViewProps> = ({ value, depth = 0 }) => {
  const { t } = useTranslation();

  switch (value.kind) {
    case 'text':
      return <span className="keydra-console__text">{value.value}</span>;
    case 'number':
    case 'decimal':
      return <span className="keydra-console__number">{value.value}</span>;
    case 'boolean':
      return <span className="keydra-console__number">{String(value.value)}</span>;
    case 'nil':
      // Distinct from an empty string, which is why it is not rendered as one.
      return <span className="keydra-console__nil">{t('Console.NIL')}</span>;
    case 'error':
      return (
        <Label isCompact color="red" status="danger">
          {value.message}
        </Label>
      );
    case 'sequence':
      if (value.items.length === 0) {
        return <span className="keydra-console__nil">{t('Console.EMPTY')}</span>;
      }
      return (
        <ol className="keydra-console__list" start={1}>
          {value.items.map((item, index) => (
            // Position is the identity here: replies are ordered and may repeat values.
            <li key={index}>
              <ConsoleValueView value={item} depth={depth + 1} />
            </li>
          ))}
        </ol>
      );
    default:
      return <span className="keydra-console__nil">{t('Console.UNKNOWN_REPLY')}</span>;
  }
};
