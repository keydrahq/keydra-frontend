import type { FC } from 'react';
import { useState } from 'react';
import {
  Divider,
  Dropdown,
  DropdownItem,
  DropdownList,
  Label,
  MenuToggle,
} from '@patternfly/react-core';
import { UserIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';
import { useAuthState, useSignOut } from '@app/Login/queries';
import { useCurrentUser } from './queries';

/**
 * Who Keydra thinks you are, and the way out.
 *
 * <p>Silent when nothing is being enforced: there is nobody to be and nothing to sign out of, and
 * the banner has already said so. An instance with security switched off that looks like a secured
 * one is how a deployment ends up exposed by somebody who believed it was not, so the state is on
 * screen rather than in a configuration file — once.
 */
export const IdentityIndicator: FC = () => {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const auth = useAuthState();
  const signOut = useSignOut();
  const [open, setOpen] = useState(false);

  if (!user.data?.securityEnabled || !auth.data?.authenticated) {
    return null;
  }

  return (
    <Dropdown
      isOpen={open}
      onOpenChange={setOpen}
      onSelect={() => setOpen(false)}
      popperProps={{ position: 'right' }}
      toggle={(toggleRef) => (
        <MenuToggle
          ref={toggleRef}
          onClick={() => setOpen((wasOpen) => !wasOpen)}
          isExpanded={open}
          variant="plainText"
          icon={<UserIcon />}
        >
          {/* No aria-label: the name is the label, and one here would replace it with a
              generic phrase for anybody using a screen reader. The toggle already says it
              opens a menu through aria-haspopup. */}
          {user.data.name}
        </MenuToggle>
      )}
    >
      <DropdownList>
        <DropdownItem isDisabled description={t('Security.SIGNED_IN_AS')}>
          {user.data.name}
        </DropdownItem>
        <DropdownItem isDisabled description={t('Security.YOUR_ROLES')}>
          {user.data.roles.map((role) => (
            <Label key={role} isCompact color={role === 'admin' ? 'purple' : 'blue'}>
              {role}
            </Label>
          ))}
        </DropdownItem>
        <Divider component="li" />
        <DropdownItem onClick={() => signOut.mutate()}>{t('Security.SIGN_OUT')}</DropdownItem>
      </DropdownList>
    </Dropdown>
  );
};
