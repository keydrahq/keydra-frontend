import type { FC } from 'react';
import { FormGroup, HelperText, HelperTextItem, TextInput } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';

export interface NameToProceedProps {
  /** The target's name, which is the word that has to be typed. */
  name: string;
  value: string;
  onChange: (value: string) => void;
  /** Distinct per dialog, since more than one of these can exist on a page. */
  id?: string;
}

/**
 * Asks for a target's own name before something empties it.
 *
 * <p>The name rather than a word like DELETE. Typing DELETE proves that somebody can read; typing
 * `orders-cache` while looking at a page that says `orders-prod` tells them, by their own hands,
 * which server they are on — and having the wrong server is the mistake this is for.
 *
 * <p>What it collects goes to the server, which is where the refusal happens. A check that lived
 * only here would be a check absent from the product: anything holding the permission could make
 * the same request without a dialog in front of it.
 */
export const NameToProceed: FC<NameToProceedProps> = ({
  name,
  value,
  onChange,
  id = 'name-to-proceed',
}) => {
  const { t } = useTranslation('common');
  return (
    <FormGroup label={t('TYPE_THE_NAME', { name })} fieldId={id} className="pf-v6-u-mt-md">
      <TextInput
        id={id}
        value={value}
        // Neither autocompleted nor corrected: the point is that the person types the name they
        // are looking at, and a browser filling it in would be doing the one thing this asks of
        // them.
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        onChange={(_, typed) => onChange(typed)}
      />
      <HelperText>
        <HelperTextItem>{t('TYPE_THE_NAME_HELP')}</HelperTextItem>
      </HelperText>
    </FormGroup>
  );
};
