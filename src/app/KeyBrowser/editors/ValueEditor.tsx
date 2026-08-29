import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@patternfly/react-core';
import type { ValueMutation, ValuePage } from '../valueTypes';
import { HashEditor } from './HashEditor';
import { ListEditor } from './ListEditor';
import { SetEditor } from './SetEditor';
import { StreamEditor } from './StreamEditor';
import { StringEditor } from './StringEditor';
import { ZSetEditor } from './ZSetEditor';

export interface ValueEditorProps {
  keyName: string;
  /** Every page read so far; a collection's editor shows them as one list. */
  pages: ValuePage[];
  isBusy: boolean;
  onMutate: (mutation: ValueMutation) => void;
}

/**
 * Picks the editor for the value's type.
 *
 * <p>The switch is exhaustive over the discriminated union, so adding a type to the backend's
 * sealed `ValuePage` and its TypeScript mirror makes this fail to compile until an editor exists
 * for it — the same guarantee the Java side gets.
 */
export const ValueEditor: FC<ValueEditorProps> = ({ keyName, pages, isBusy, onMutate }) => {
  const { t } = useTranslation();
  const first = pages[0];

  switch (first.type) {
    case 'string':
      return (
        <StringEditor
          page={first}
          isBusy={isBusy}
          onSave={(value) => onMutate({ operation: 'setString', key: keyName, value })}
        />
      );
    case 'hash':
      return (
        <HashEditor
          keyName={keyName}
          fields={pages.flatMap((page) => (page.type === 'hash' ? page.fields : []))}
          isBusy={isBusy}
          onMutate={onMutate}
        />
      );
    case 'list':
      return (
        <ListEditor
          keyName={keyName}
          elements={pages.flatMap((page) => (page.type === 'list' ? page.elements : []))}
          isBusy={isBusy}
          onMutate={onMutate}
        />
      );
    case 'set':
      return (
        <SetEditor
          keyName={keyName}
          members={pages.flatMap((page) => (page.type === 'set' ? page.members : []))}
          isBusy={isBusy}
          onMutate={onMutate}
        />
      );
    case 'zset':
      return (
        <ZSetEditor
          keyName={keyName}
          members={pages.flatMap((page) => (page.type === 'zset' ? page.members : []))}
          isBusy={isBusy}
          onMutate={onMutate}
        />
      );
    case 'stream':
      return (
        <StreamEditor
          keyName={keyName}
          entries={pages.flatMap((page) => (page.type === 'stream' ? page.entries : []))}
          isBusy={isBusy}
          onMutate={onMutate}
        />
      );
    default:
      // Unreachable while the union is exhaustive; kept so a server that grows a new
      // type says so instead of rendering nothing.
      return <Alert variant="warning" isInline title={t('Value.UNKNOWN_TYPE')} component="h3" />;
  }
};
