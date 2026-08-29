import type { FC } from 'react';
import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  ClipboardCopy,
  Content,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Stack,
  StackItem,
  TextInput,
} from '@patternfly/react-core';
/*
 * The browser build by name. The package's main entry is the Node one — it reaches for `fs` to
 * write a PNG to disk — and asking a bundler to optimise that fails outright rather than
 * tree-shaking its way out. The `browser` field in its manifest points here; naming it directly is
 * what makes that work without a resolver alias in the build config.
 */
import QRCode from 'qrcode/lib/browser';
import { useTranslation } from 'react-i18next';

/**
 * The QR code, drawn in the browser.
 *
 * <p>In the browser rather than on the server, and that is a decision rather than a convenience:
 * the enrolment URI carries the shared secret, and rendering it server-side would mean the secret
 * travelling a second time, in an image, through whatever caches an image passes.
 */
export const EnrolmentCode: FC<{ uri: string }> = ({ uri }) => {
  const { t } = useTranslation();
  const [drawn, setDrawn] = useState<string>();

  useEffect(() => {
    let current = true;
    void QRCode.toDataURL(uri, { margin: 1, width: 200 })
      .then((image: string) => {
        if (current) {
          setDrawn(image);
        }
      })
      // Drawing needs a canvas, and there are browsers and environments where asking for one
      // answers with nothing. Nothing is lost: the same secret is under this as text, which is
      // what a device with no camera uses anyway — so the failure is a missing convenience
      // rather than a pairing somebody cannot finish.
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [uri]);

  return drawn ? (
    <img
      src={drawn}
      alt={t('SecondFactor.QR_ALT')}
      // A white plate in both themes: a QR code is read by a camera that expects dark on light,
      // and inverting it in the dark theme would make it one no phone can read.
      style={{
        background: 'var(--pf-t--color--white)',
        padding: 'var(--pf-t--global--spacer--sm)',
        borderRadius: 'var(--pf-t--global--border--radius--small)',
      }}
    />
  ) : null;
};

/**
 * The codes, shown once.
 *
 * <p>Said plainly rather than implied, because there is no second chance and the page cannot give
 * one: only their hashes are kept, so nothing in Keydra can show these again.
 */
export const RecoveryCodes: FC<{ codes: string[] }> = ({ codes }) => {
  const { t } = useTranslation();
  return (
    <Alert variant="warning" isInline component="h3" title={t('SecondFactor.CODES_TITLE')}>
      <Stack hasGutter>
        <StackItem>{t('SecondFactor.CODES_BODY')}</StackItem>
        <StackItem>
          <ClipboardCopy
            isReadOnly
            isExpanded
            variant="expansion"
            hoverTip={t('SecondFactor.COPY')}
          >
            {codes.join('\n')}
          </ClipboardCopy>
        </StackItem>
      </Stack>
    </Alert>
  );
};

export interface SecondFactorPairingProps {
  secret: string;
  uri: string;
  onConfirm: (code: string) => void;
  isConfirming: boolean;
  /** What the server said about the last code, when it refused one. */
  error?: string;
}

/**
 * Scan this, then type what it says.
 *
 * <p>Shared by the settings card and by the wall an instance that requires a factor puts in front
 * of an account that has none — the same three steps in two places, because they are the same
 * three steps. Presentational: whoever draws it owns the request that began the pairing and the
 * one that proves it, since what happens after a confirmation is different in the two cases.
 */
export const SecondFactorPairing: FC<SecondFactorPairingProps> = ({
  secret,
  uri,
  onConfirm,
  isConfirming,
  error,
}) => {
  const { t } = useTranslation();
  const [code, setCode] = useState('');

  return (
    <Stack hasGutter>
      <StackItem>
        <Content component="p">{t('SecondFactor.SCAN')}</Content>
      </StackItem>
      <StackItem>
        <EnrolmentCode uri={uri} />
      </StackItem>
      <StackItem>
        {/* The same secret in text, for a device with no camera and for anybody who would
            rather type it than point a phone at their own screen. */}
        <FormGroup label={t('SecondFactor.SECRET')} fieldId="second-factor-secret">
          <ClipboardCopy isReadOnly hoverTip={t('SecondFactor.COPY')} id="second-factor-secret">
            {secret}
          </ClipboardCopy>
        </FormGroup>
      </StackItem>
      <StackItem>
        <FormGroup label={t('SecondFactor.CONFIRM_LABEL')} fieldId="second-factor-code">
          <TextInput
            id="second-factor-code"
            value={code}
            placeholder="000000"
            autoComplete="one-time-code"
            onChange={(_event, value) => setCode(value)}
          />
          <FormHelperText>
            <HelperText>
              <HelperTextItem variant={error ? 'error' : 'default'}>
                {error ?? t('SecondFactor.CONFIRM_HELP')}
              </HelperTextItem>
            </HelperText>
          </FormHelperText>
        </FormGroup>
      </StackItem>
      <StackItem>
        <Button
          variant="primary"
          isDisabled={!code || isConfirming}
          isLoading={isConfirming}
          onClick={() => onConfirm(code)}
        >
          {t('SecondFactor.CONFIRM')}
        </Button>
      </StackItem>
    </Stack>
  );
};
