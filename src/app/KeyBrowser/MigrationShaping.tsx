import type { FC } from 'react';
import {
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  TextArea,
  TextInput,
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { KEY_TYPES } from './types';

/**
 * The five answers that shape a copy rather than aim it.
 *
 * <p>Strings throughout, including the ceiling: these come from text inputs, and a number field
 * that has been emptied is not zero. What the request wants is built by {@link shapeToRequest},
 * which is the one place that decides what an empty box means.
 */
export interface MigrationShape {
  type: string;
  stripPrefix: string;
  addPrefix: string;
  script: string;
  maxKeysPerSecond: string;
}

export const emptyShape: MigrationShape = {
  type: '',
  stripPrefix: '',
  addPrefix: '',
  script: '',
  maxKeysPerSecond: '',
};

/**
 * What a shape is worth on the wire: the fields that were filled in, and nothing else.
 *
 * <p>An empty box is left out rather than sent as an empty string, because the two are different
 * questions at the other end — "every type" is not "the type whose name is nothing".
 */
export const shapeToRequest = (
  shape: MigrationShape,
): Partial<{
  type: string;
  stripPrefix: string;
  addPrefix: string;
  script: string;
  maxKeysPerSecond: number;
}> => ({
  ...(shape.type ? { type: shape.type } : {}),
  ...(shape.stripPrefix ? { stripPrefix: shape.stripPrefix } : {}),
  ...(shape.addPrefix ? { addPrefix: shape.addPrefix } : {}),
  ...(shape.script.trim() ? { script: shape.script } : {}),
  ...(Number(shape.maxKeysPerSecond) > 0
    ? { maxKeysPerSecond: Number(shape.maxKeysPerSecond) }
    : {}),
});

/** Reads a shape back out of what was stored, so an existing schedule opens on its own answers. */
export const shapeFrom = (stored: {
  type?: string;
  stripPrefix?: string;
  addPrefix?: string;
  script?: string;
  maxKeysPerSecond?: number;
}): MigrationShape => ({
  type: stored.type ?? '',
  stripPrefix: stored.stripPrefix ?? '',
  addPrefix: stored.addPrefix ?? '',
  script: stored.script ?? '',
  maxKeysPerSecond: stored.maxKeysPerSecond ? String(stored.maxKeysPerSecond) : '',
});

export interface MigrationShapingProps {
  /** Prefixes every field id, because two of these can be open on one page. */
  idPrefix: string;
  shape: MigrationShape;
  onChange: (patch: Partial<MigrationShape>) => void;
}

/**
 * The controls for shaping a copy, wherever a copy is arranged.
 *
 * <p>One component rather than two, because there are two places to arrange the same work — by
 * hand from the key browser, and on a schedule — and a copy that can be narrowed to a type in one
 * of them and not the other is a difference nobody chose. It renders the fields only; each caller
 * supplies its own way of folding them away, because a dialog and a wizard step hide things
 * differently.
 *
 * <p>Deliberately not a form of its own: it is a fragment, so the caller's `Form` keeps its
 * spacing and its labels line up with the fields above them.
 */
export const MigrationShaping: FC<MigrationShapingProps> = ({ idPrefix, shape, onChange }) => {
  const { t } = useTranslation();

  return (
    <>
      <FormGroup label={t('Migrate.TYPE')} fieldId={`${idPrefix}-type`}>
        <FormSelect
          id={`${idPrefix}-type`}
          value={shape.type}
          onChange={(_event, value) => onChange({ type: value })}
        >
          <FormSelectOption value="" label={t('Migrate.TYPE_ANY')} />
          {KEY_TYPES.map((name) => (
            <FormSelectOption key={name} value={name} label={name} />
          ))}
        </FormSelect>
        <FormHelperText>
          <HelperText>
            <HelperTextItem>{t('Migrate.TYPE_HELP')}</HelperTextItem>
          </HelperText>
        </FormHelperText>
      </FormGroup>

      <FormGroup label={t('Migrate.STRIP_PREFIX')} fieldId={`${idPrefix}-strip`}>
        <TextInput
          id={`${idPrefix}-strip`}
          value={shape.stripPrefix}
          placeholder="staging:"
          onChange={(_event, value) => onChange({ stripPrefix: value })}
        />
      </FormGroup>

      <FormGroup label={t('Migrate.ADD_PREFIX')} fieldId={`${idPrefix}-add`}>
        <TextInput
          id={`${idPrefix}-add`}
          value={shape.addPrefix}
          placeholder="prod:"
          onChange={(_event, value) => onChange({ addPrefix: value })}
        />
        <FormHelperText>
          <HelperText>
            <HelperTextItem>
              {shape.stripPrefix || shape.addPrefix
                ? t('Migrate.PREFIX_EXAMPLE', {
                    before: `${shape.stripPrefix}user:1`,
                    after: `${shape.addPrefix}user:1`,
                  })
                : t('Migrate.PREFIX_HELP')}
            </HelperTextItem>
          </HelperText>
        </FormHelperText>
      </FormGroup>

      <FormGroup label={t('Migrate.SCRIPT')} fieldId={`${idPrefix}-script`}>
        <TextArea
          id={`${idPrefix}-script`}
          value={shape.script}
          rows={5}
          resizeOrientation="vertical"
          placeholder={"if key.name:find('^tmp:') then return nil end\nreturn true"}
          onChange={(_event, value) => onChange({ script: value })}
        />
        <FormHelperText>
          <HelperText>
            <HelperTextItem>{t('Migrate.SCRIPT_HELP')}</HelperTextItem>
          </HelperText>
        </FormHelperText>
      </FormGroup>

      <FormGroup label={t('Migrate.RATE_LIMIT')} fieldId={`${idPrefix}-rate`}>
        <TextInput
          id={`${idPrefix}-rate`}
          type="number"
          value={shape.maxKeysPerSecond}
          placeholder={t('Migrate.RATE_LIMIT_NONE')}
          onChange={(_event, value) => onChange({ maxKeysPerSecond: value })}
        />
        <FormHelperText>
          <HelperText>
            <HelperTextItem>{t('Migrate.RATE_LIMIT_HELP')}</HelperTextItem>
          </HelperText>
        </FormHelperText>
      </FormGroup>
    </>
  );
};
