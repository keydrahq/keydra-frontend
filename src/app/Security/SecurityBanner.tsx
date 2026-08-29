import type { FC } from 'react';
import { Banner, Flex, FlexItem } from '@patternfly/react-core';
import { ExclamationTriangleIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';
import { useCurrentUser } from './queries';

/**
 * Says, once and quietly, that nothing is being enforced.
 *
 * <p>An instance with security switched off that looks like a secured one is how a deployment ends
 * up exposed by somebody who believed it was not, so the state belongs on screen rather than in a
 * configuration file.
 *
 * <p>A banner and not a label in the masthead. As a filled warning label it was the loudest thing
 * on every page — louder than a target being down, which is the thing that actually needs
 * attention — and it competed for the corner where the user's own identity goes.
 */
export const SecurityBanner: FC = () => {
  const { t } = useTranslation();
  const user = useCurrentUser();

  if (!user.data || user.data.securityEnabled) {
    return null;
  }

  return (
    <Banner status="warning">
      <Flex
        justifyContent={{ default: 'justifyContentCenter' }}
        spaceItems={{ default: 'spaceItemsSm' }}
        alignItems={{ default: 'alignItemsCenter' }}
      >
        <FlexItem>
          <ExclamationTriangleIcon />
        </FlexItem>
        <FlexItem>
          {t('Security.OPEN')} — {t('Security.OPEN_HELP')}
        </FlexItem>
      </Flex>
    </Banner>
  );
};
