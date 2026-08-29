import type { FC, FormEvent } from 'react';
import { useState } from 'react';
import {
  Alert,
  Button,
  Content,
  Divider,
  ExpandableSection,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  LoginForm,
  Split,
  SplitItem,
  Stack,
  StackItem,
  TextInput,
} from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';
import { PasswordInput } from '@app/Shared/Components/PasswordInput';
import { LoginShell } from './LoginShell';
import { blamesTheFields, whyItFailed } from './signInFailure';
import {
  signInHref,
  useCreateFirstAdministrator,
  useForgottenPassword,
  useSignIn,
  wantsSecondFactor,
  useSignInOptions,
} from './queries';

/** Shorter than this and a password is a guess away; the backend refuses one too. */
const MINIMUM_PASSWORD = 12;

export interface SignInProps {
  /** True on an instance that has no accounts at all, where the first thing to do is make one. */
  needsSetup: boolean;
}

/**
 * The page in front of everything else.
 *
 * <p>Two forms behind one door. An instance nobody has set up yet asks for its first administrator
 * instead of a password, because there is nothing to sign into and a login form on such an instance
 * is a wall with no key — the ordinary answer to "I have no account" is "ask an administrator", and
 * here there is not one yet.
 */
export const SignIn: FC<SignInProps> = ({ needsSetup }) => {
  const { t } = useTranslation();

  // Nothing to offer on an instance that has no accounts yet: the only thing to do there is
  // create the first administrator, and that is a local account by definition.
  const providers = useSignInOptions();
  const offered = needsSetup ? [] : (providers.data ?? []);

  return (
    <LoginShell
      title={needsSetup ? t('Login.SETUP_TITLE') : t('Login.TITLE')}
      subtitle={needsSetup ? t('Login.SETUP_SUBTITLE') : t('Login.SUBTITLE')}
      band={t('Login.FOOTER_NOTE')}
    >
      <SignInRefusal />
      {needsSetup ? <SetupForm /> : <CredentialsForm />}
      {/*
       * Under the form, inside the card. PatternFly's social-media slot is sized for logos —
       * a provider's name in it renders as a headline-sized link, which is what made a single
       * sign-in option the loudest thing on the page. What this is, in PatternFly's own
       * vocabulary, is "other login methods": a section below the fields, in ordinary buttons.
       */}
      {offered.length > 0 && <OtherWaysIn options={offered} />}
    </LoginShell>
  );
};

const OtherWaysIn: FC<{ options: { key: string; displayName: string }[] }> = ({ options }) => {
  const { t } = useTranslation();

  return (
    <Stack hasGutter>
      <StackItem>
        <Divider />
      </StackItem>
      <StackItem>
        {/* Centred, like everything else in the card: it is a heading over the buttons under
            it rather than a label beside something. */}
        <Split>
          <SplitItem isFilled />
          <SplitItem>
            <Content component="small">{t('Login.OTHER_WAYS')}</Content>
          </SplitItem>
          <SplitItem isFilled />
        </Split>
      </StackItem>
      {options.map((provider) => (
        <StackItem key={provider.key}>
          {/*
           * A link the browser follows rather than a button with a handler: the flow ends at
           * somebody else's site and comes back, so what has to happen is a navigation.
           */}
          <Button variant="secondary" component="a" href={signInHref(provider.key)} isBlock>
            {t('Login.CONTINUE_WITH', { name: provider.displayName })}
          </Button>
        </StackItem>
      ))}
    </Stack>
  );
};

/**
 * What went wrong the last time somebody came back from a provider.
 *
 * <p>Carried in the address because the flow ends in a redirect, which is the only channel a
 * provider leaves open. Read from there and left there: reloading the page and seeing it again is
 * less confusing than a message that vanishes while being read.
 */
const SignInRefusal: FC = () => {
  const message = new URLSearchParams(window.location.search).get('signInError');
  if (!message) {
    return null;
  }
  return <Alert variant="danger" isInline isPlain title={message} />;
};

/** The ordinary case: a username and a password. */
const CredentialsForm: FC = () => {
  const { t } = useTranslation();
  const signIn = useSignIn();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [askingForLink, setAskingForLink] = useState(false);

  /*
   * Shown only once the server has asked for it. The page cannot know in advance — knowing would
   * mean answering "does this account have a second factor?" to anybody who types a username, and
   * a form with a code box on it for everybody would be a form most people have to ignore.
   */
  const wantsCode = wantsSecondFactor(signIn.error);

  const submit = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    signIn.mutate({ username, password, code: code || undefined });
  };

  if (askingForLink) {
    return <ForgottenPasswordForm username={username} onDone={() => setAskingForLink(false)} />;
  }

  const form = (
    <LoginForm
      usernameLabel={t('Login.USERNAME')}
      usernameValue={username}
      onChangeUsername={(_event, value) => setUsername(value)}
      passwordLabel={t('Login.PASSWORD')}
      passwordValue={password}
      onChangePassword={(_event, value) => setPassword(value)}
      isShowPasswordEnabled
      showPasswordAriaLabel={t('Login.SHOW_PASSWORD')}
      hidePasswordAriaLabel={t('Login.HIDE_PASSWORD')}
      loginButtonLabel={signIn.isPending ? t('Login.SIGNING_IN') : t('Login.SIGN_IN')}
      isLoginButtonDisabled={signIn.isPending || !username || !password}
      onLoginButtonClick={submit}
      // One message for a wrong name and a wrong password alike: telling them apart tells
      // somebody guessing which half they have already got right. A instance that did not
      // answer at all is a different thing, and saying "wrong password" to somebody whose
      // password was never read sends them looking in the wrong place.
      /*
       * Silent the first time a code is asked for. The password was right — saying "wrong username
       * or password" underneath a field that has just appeared asking for something else would
       * send somebody back to check the one thing that was not the problem. Once a code has been
       * typed and refused, there is something true to say.
       */
      showHelperText={signIn.isError && !(wantsCode && !code)}
      helperText={t(wantsCode ? 'Login.SECOND_FACTOR_WRONG' : whyItFailed(signIn.error))}
      helperTextIcon={<ExclamationCircleIcon />}
      // Valid when a code is what is wanted: the name and the password were both right, and
      // marking them red would point at the two things that were not the problem.
      isValidUsername={wantsCode || !blamesTheFields(signIn.error)}
      isValidPassword={wantsCode || !blamesTheFields(signIn.error)}
    />
  );

  const secondFactor = (
    <FormGroup label={t('Login.SECOND_FACTOR')} fieldId="second-factor" isRequired>
      <TextInput
        id="second-factor"
        value={code}
        // The digits, or a recovery code. One field for both because they are one answer to one
        // question — "prove it is you" — and a second box would make somebody choose which of
        // their two ways in they are using before they have used it.
        placeholder={t('Login.SECOND_FACTOR_PLACEHOLDER')}
        autoComplete="one-time-code"
        autoFocus
        onChange={(_event, value) => setCode(value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && code) {
            signIn.mutate({ username, password, code });
          }
        }}
      />
      <FormHelperText>
        <HelperText>
          <HelperTextItem>{t('Login.SECOND_FACTOR_HELP')}</HelperTextItem>
        </HelperText>
      </FormHelperText>
    </FormGroup>
  );

  return (
    <Stack hasGutter>
      <StackItem>{form}</StackItem>
      {wantsCode ? <StackItem>{secondFactor}</StackItem> : null}
      <StackItem>
        {/* Under the form rather than beside a field: forgetting a password is the rare case,
            and a page offering two things at once makes the ordinary one harder to find. */}
        <Button variant="link" isInline onClick={() => setAskingForLink(true)}>
          {t('Invitation.FORGOTTEN')}
        </Button>
      </StackItem>
    </Stack>
  );
};

export interface ForgottenPasswordFormProps {
  /** Whatever was already typed into the sign-in form, so it is not typed twice. */
  username: string;
  onDone: () => void;
}

/**
 * Asking for a link because a password has been forgotten.
 *
 * <p>Says the same thing whether or not there is such an account, because the server answers the
 * same way either way. A form that reported "no such user" would be a way to ask Keydra who has an
 * account here, which is a question a login page must not answer.
 */
const ForgottenPasswordForm: FC<ForgottenPasswordFormProps> = ({ username, onDone }) => {
  const { t } = useTranslation();
  const ask = useForgottenPassword();
  const [name, setName] = useState(username);

  if (ask.isSuccess) {
    return (
      <Stack hasGutter>
        <StackItem>
          <Alert variant="info" isInline isPlain title={t('Invitation.FORGOTTEN_SENT')} />
        </StackItem>
        <StackItem>
          <Button variant="secondary" isBlock onClick={onDone}>
            {t('Invitation.CANCEL')}
          </Button>
        </StackItem>
      </Stack>
    );
  }

  return (
    <Form
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) {
          ask.mutate(name.trim());
        }
      }}
    >
      <Content component="p">{t('Invitation.FORGOTTEN_BODY')}</Content>
      <FormGroup label={t('Login.USERNAME')} isRequired fieldId="forgotten-username">
        <TextInput
          id="forgotten-username"
          value={name}
          onChange={(_event, value) => setName(value)}
        />
      </FormGroup>
      <Button
        type="submit"
        variant="primary"
        isBlock
        isDisabled={!name.trim() || ask.isPending}
        isLoading={ask.isPending}
      >
        {t('Invitation.FORGOTTEN_SEND')}
      </Button>
      <Button variant="link" isBlock onClick={onDone}>
        {t('Invitation.CANCEL')}
      </Button>
    </Form>
  );
};

/** The first-run case: there is nobody, so somebody has to be made. */
const SetupForm: FC = () => {
  const { t } = useTranslation();
  const create = useCreateFirstAdministrator();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeated, setRepeated] = useState('');

  const tooShort = password.length > 0 && password.length < MINIMUM_PASSWORD;
  const mismatched = repeated.length > 0 && repeated !== password;
  const ready = !!username && password.length >= MINIMUM_PASSWORD && repeated === password;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (ready) {
      create.mutate({
        username,
        displayName: displayName || undefined,
        email: email || undefined,
        password,
      });
    }
  };

  return (
    <Form onSubmit={submit}>
      <FormGroup label={t('Login.USERNAME')} isRequired fieldId="setup-username">
        <TextInput
          id="setup-username"
          value={username}
          onChange={(_event, value) => setUsername(value)}
          isRequired
          autoFocus
        />
      </FormGroup>

      <FormGroup label={t('Login.NEW_PASSWORD')} isRequired fieldId="setup-password">
        <PasswordInput
          id="setup-password"
          value={password}
          onChange={(_event, value) => setPassword(value)}
          validated={tooShort ? 'error' : 'default'}
          isRequired
        />
        <FormHelperText>
          <HelperText>
            <HelperTextItem variant={tooShort ? 'error' : 'default'}>
              {t('Login.PASSWORD_RULE', { count: MINIMUM_PASSWORD })}
            </HelperTextItem>
          </HelperText>
        </FormHelperText>
      </FormGroup>

      <FormGroup label={t('Login.REPEAT_PASSWORD')} isRequired fieldId="setup-repeat">
        <PasswordInput
          id="setup-repeat"
          value={repeated}
          onChange={(_event, value) => setRepeated(value)}
          validated={mismatched ? 'error' : 'default'}
          isRequired
        />
        {mismatched && (
          <FormHelperText>
            <HelperText>
              <HelperTextItem variant="error">{t('Login.PASSWORD_MISMATCH')}</HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}
      </FormGroup>

      <ExpandableSection toggleText={t('Login.OPTIONAL_DETAILS')}>
        <FormGroup label={t('Access.DISPLAY_NAME')} fieldId="setup-display-name">
          <TextInput
            id="setup-display-name"
            value={displayName}
            onChange={(_event, value) => setDisplayName(value)}
          />
        </FormGroup>
        <FormGroup label={t('Access.EMAIL')} fieldId="setup-email">
          <TextInput
            id="setup-email"
            type="email"
            value={email}
            onChange={(_event, value) => setEmail(value)}
          />
        </FormGroup>
      </ExpandableSection>

      {create.isError && (
        <FormHelperText>
          <HelperText>
            <HelperTextItem variant="error" icon={<ExclamationCircleIcon />}>
              {create.error.message}
            </HelperTextItem>
          </HelperText>
        </FormHelperText>
      )}

      <Button type="submit" variant="primary" isBlock isDisabled={!ready || create.isPending}>
        {create.isPending ? t('Login.CREATING') : t('Login.CREATE_ADMINISTRATOR')}
      </Button>
    </Form>
  );
};
