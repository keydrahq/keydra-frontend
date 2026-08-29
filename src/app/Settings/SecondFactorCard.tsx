import type { FC } from 'react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  Content,
  Flex,
  FlexItem,
  Label,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { RecoveryCodes, SecondFactorPairing } from '@app/Shared/Components/SecondFactorPairing';
import {
  useBeginSecondFactor,
  useConfirmSecondFactor,
  useDisableSecondFactor,
  useRegenerateRecoveryCodes,
  useSecondFactor,
} from './secondFactor';

/**
 * Pairing an authenticator, and everything that follows from having one.
 *
 * <p>Three states in one card, because they are three points on one line rather than three
 * features: not paired, pairing, paired. What changes between them is what there is to do.
 *
 * <p>Nothing is enforced until a code has been typed correctly. Somebody who opens this, does not
 * scan, and closes the page has not locked themselves out — which is why the secret alone turns
 * nothing on.
 */
export const SecondFactorCard: FC = () => {
  const { t } = useTranslation();
  const state = useSecondFactor();
  const begin = useBeginSecondFactor();
  const confirm = useConfirmSecondFactor();
  const regenerate = useRegenerateRecoveryCodes();
  const disable = useDisableSecondFactor();

  const codes = confirm.data?.codes ?? regenerate.data?.codes;
  const pairing = begin.data !== undefined && !state.data?.enabled;

  return (
    <Card isCompact>
      <CardTitle>{t('SecondFactor.TITLE')}</CardTitle>
      <CardBody>
        <Stack hasGutter>
          <StackItem>
            <Content component="p">{t('SecondFactor.DESCRIPTION')}</Content>
          </StackItem>

          {state.data?.enabled ? (
            <>
              <StackItem>
                <Flex gap={{ default: 'gapSm' }} alignItems={{ default: 'alignItemsCenter' }}>
                  <FlexItem>
                    <Label isCompact color="green" status="success">
                      {t('SecondFactor.ON')}
                    </Label>
                  </FlexItem>
                  <FlexItem>
                    <Content component="small">
                      {t('SecondFactor.CODES_LEFT', { count: state.data.recoveryCodesLeft })}
                    </Content>
                  </FlexItem>
                </Flex>
              </StackItem>
              {/*
               * Two of the codes left is the point at which somebody should be told rather than
               * left to notice. It is not an error — nothing is wrong yet — which is what makes
               * it a warning about a thing that has not happened.
               */}
              {state.data.recoveryCodesLeft <= 2 ? (
                <StackItem>
                  <Alert
                    variant="warning"
                    isInline
                    isPlain
                    component="h3"
                    title={t('SecondFactor.CODES_RUNNING_OUT')}
                  >
                    {t('SecondFactor.CODES_RUNNING_OUT_BODY')}
                  </Alert>
                </StackItem>
              ) : null}
              {codes ? (
                <StackItem>
                  <RecoveryCodes codes={codes} />
                </StackItem>
              ) : null}
              <StackItem>
                <Flex gap={{ default: 'gapSm' }}>
                  <FlexItem>
                    <Button
                      variant="secondary"
                      isLoading={regenerate.isPending}
                      onClick={() => regenerate.mutate()}
                    >
                      {t('SecondFactor.NEW_CODES')}
                    </Button>
                  </FlexItem>
                  <FlexItem>
                    <Button
                      variant="danger"
                      isLoading={disable.isPending}
                      onClick={() => disable.mutate()}
                    >
                      {t('SecondFactor.TURN_OFF')}
                    </Button>
                  </FlexItem>
                </Flex>
              </StackItem>
            </>
          ) : pairing ? (
            <StackItem>
              <SecondFactorPairing
                secret={begin.data!.secret}
                uri={begin.data!.uri}
                isConfirming={confirm.isPending}
                error={confirm.isError ? (confirm.error as Error).message : undefined}
                onConfirm={(code) => confirm.mutate(code)}
              />
            </StackItem>
          ) : (
            <>
              {codes ? (
                <StackItem>
                  <RecoveryCodes codes={codes} />
                </StackItem>
              ) : null}
              <StackItem>
                <Button
                  variant="primary"
                  isLoading={begin.isPending}
                  onClick={() => begin.mutate()}
                >
                  {t('SecondFactor.TURN_ON')}
                </Button>
              </StackItem>
            </>
          )}
        </Stack>
      </CardBody>
    </Card>
  );
};
