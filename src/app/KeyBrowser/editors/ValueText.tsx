import type { FC } from 'react';
import { Flex, FlexItem, Label, Tooltip } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import type { EncodedValue } from '../valueTypes';

export interface ValueTextProps {
  value: EncodedValue;
}

/**
 * One decoded value, as read.
 *
 * <p>The encoding is shown only when it is not `plain`: a badge on every row would be noise, but a
 * value that arrived through gzip or msgpack is not what is stored, and hiding that would let
 * someone edit a decoded form believing it is the raw one.
 */
export const ValueText: FC<ValueTextProps> = ({ value }) => {
  const { t } = useTranslation();

  return (
    <Flex
      spaceItems={{ default: 'spaceItemsSm' }}
      alignItems={{ default: 'alignItemsCenter' }}
      flexWrap={{ default: 'nowrap' }}
    >
      <FlexItem
        grow={{ default: 'grow' }}
        className="keydra-value__text pf-v6-u-font-family-monospace"
      >
        {value.text}
      </FlexItem>
      {value.encoding !== 'plain' ? (
        <FlexItem>
          <Label isCompact color="purple">
            {value.encoding}
          </Label>
        </FlexItem>
      ) : null}
      {value.truncated ? (
        <FlexItem>
          <Tooltip content={t('Value.TRUNCATED_HELP')}>
            <Label isCompact color="orange" status="warning">
              {t('Value.TRUNCATED')}
            </Label>
          </Tooltip>
        </FlexItem>
      ) : null}
    </Flex>
  );
};
