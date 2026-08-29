import type { FC } from 'react';
import { useState } from 'react';
import { Button, InputGroup, InputGroupItem, TextInput } from '@patternfly/react-core';
import type { TextInputProps } from '@patternfly/react-core';
import { EyeIcon, EyeSlashIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';

export type PasswordInputProps = Omit<TextInputProps, 'type' | 'ref'>;

/**
 * A secret field that can be looked at.
 *
 * <p>Because the alternative is somebody typing a forty-character key into a row of dots and
 * finding out it was wrong from a failed connection. Hiding it by default is right — a password
 * on a screen in an office is a password several people have — but hiding it with no way back is
 * a guess dressed up as security.
 *
 * <p>One component rather than the pattern repeated at each of a dozen fields, so every secret in
 * the application behaves the same way and the next one added does too.
 */
export const PasswordInput: FC<PasswordInputProps> = ({ id, ...props }) => {
  const { t } = useTranslation();
  const [shown, setShown] = useState(false);

  return (
    <InputGroup>
      <InputGroupItem isFill>
        <TextInput id={id} type={shown ? 'text' : 'password'} {...props} />
      </InputGroupItem>
      <InputGroupItem>
        <Button
          variant="control"
          aria-label={shown ? t('Common.HIDE_PASSWORD') : t('Common.SHOW_PASSWORD')}
          // Told rather than shown: the icon says what pressing it does, and a screen reader
          // needs the state as well, which the label alone cannot carry.
          aria-pressed={shown}
          icon={shown ? <EyeSlashIcon /> : <EyeIcon />}
          onClick={() => setShown(!shown)}
          isDisabled={props.isDisabled}
        />
      </InputGroupItem>
    </InputGroup>
  );
};
