import type { FC } from 'react';
import { useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardTitle,
  Content,
  EmptyState,
  EmptyStateBody,
  Flex,
  FlexItem,
  Form,
  FormGroup,
  Grid,
  GridItem,
  Label,
  LabelGroup,
  PageSection,
  TextArea,
  TextInput,
} from '@patternfly/react-core';
import { BellIcon, PlusCircleIcon } from '@patternfly/react-icons';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { useNotifications } from '@app/Shared/Components/notificationStore';
import { useDocumentTitle } from '@app/utils/hooks/useDocumentTitle';
import { useChannelMessages } from './useChannelMessages';
import { usePublish, useSubscribe, useSubscription, useUnsubscribe } from './queries';

/** Splits a comma or space separated list into names, dropping the blanks. */
const parseNames = (input: string): string[] =>
  input
    .split(/[\s,]+/)
    .map((name) => name.trim())
    .filter((name) => name !== '');

/**
 * Watching and publishing on a target's channels.
 *
 * <p>The subscription belongs to the server, not to this page: closing the tab does not close it,
 * and a second tab sees the same messages. That is deliberate — a subscription is a connection held
 * open, and tying it to a browser tab would leak one every time someone navigated away.
 */
export const PubSub: FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('PubSub.TITLE'));

  const { connectionId: idParam } = useParams();
  const connectionId = Number(idParam);

  const { notify } = useNotifications();
  const subscription = useSubscription(connectionId);
  const subscribe = useSubscribe(connectionId);
  const unsubscribe = useUnsubscribe(connectionId);
  const publish = usePublish(connectionId);
  const { messages, clear } = useChannelMessages(connectionId);

  const [channels, setChannels] = useState('');
  const [patterns, setPatterns] = useState('');
  const [publishChannel, setPublishChannel] = useState('');
  const [publishPayload, setPublishPayload] = useState('');

  const open = subscription.data ?? null;

  if (!Number.isFinite(connectionId)) {
    return (
      <PageSection>
        <EmptyState titleText={t('PubSub.NO_CONNECTION')} headingLevel="h2">
          <EmptyStateBody>{t('PubSub.NO_CONNECTION_BODY')}</EmptyStateBody>
        </EmptyState>
      </PageSection>
    );
  }

  const startListening = () => {
    const request = { channels: parseNames(channels), patterns: parseNames(patterns) };
    if (request.channels.length === 0 && request.patterns.length === 0) {
      return;
    }
    subscribe.mutate(request, {
      onError: (error) =>
        notify({
          title: t('PubSub.SUBSCRIBE_FAILED'),
          description: error.message,
          variant: 'danger',
        }),
    });
  };

  const send = () => {
    if (publishChannel.trim() === '') {
      return;
    }
    publish.mutate(
      { channel: publishChannel, payload: publishPayload },
      {
        onSuccess: (result) =>
          notify({
            title: t('PubSub.PUBLISHED', { count: result.receivers }),
            // Zero receivers is worth saying plainly rather than presenting as success.
            variant: result.receivers > 0 ? 'success' : 'warning',
          }),
        onError: (error) =>
          notify({
            title: t('PubSub.PUBLISH_FAILED'),
            description: error.message,
            variant: 'danger',
          }),
      },
    );
  };

  return (
    <PageSection isFilled>
      <Grid hasGutter className="keydra-pubsub">
        <GridItem lg={4}>
          <Flex
            direction={{ default: 'column' }}
            spaceItems={{ default: 'spaceItemsMd' }}
            className="keydra-pubsub__controls"
          >
            <FlexItem>
              <Card isCompact>
                <CardTitle>{t('PubSub.LISTEN')}</CardTitle>
                <CardBody>
                  <Form
                    onSubmit={(event) => {
                      event.preventDefault();
                      startListening();
                    }}
                  >
                    <FormGroup label={t('PubSub.CHANNELS')} fieldId="pubsub-channels">
                      <TextInput
                        id="pubsub-channels"
                        value={channels}
                        placeholder={t('PubSub.CHANNELS_PLACEHOLDER')}
                        onChange={(_event, value) => setChannels(value)}
                      />
                    </FormGroup>
                    <FormGroup label={t('PubSub.PATTERNS')} fieldId="pubsub-patterns">
                      <TextInput
                        id="pubsub-patterns"
                        value={patterns}
                        placeholder={t('PubSub.PATTERNS_PLACEHOLDER')}
                        onChange={(_event, value) => setPatterns(value)}
                      />
                    </FormGroup>
                    <Flex spaceItems={{ default: 'spaceItemsSm' }}>
                      <FlexItem>
                        <Button
                          variant="primary"
                          type="submit"
                          isLoading={subscribe.isPending}
                          isDisabled={subscribe.isPending}
                        >
                          {open ? t('PubSub.REPLACE') : t('PubSub.SUBSCRIBE')}
                        </Button>
                      </FlexItem>
                      {open ? (
                        <FlexItem>
                          <Button
                            variant="secondary"
                            isLoading={unsubscribe.isPending}
                            onClick={() => unsubscribe.mutate()}
                          >
                            {t('PubSub.UNSUBSCRIBE')}
                          </Button>
                        </FlexItem>
                      ) : null}
                    </Flex>
                  </Form>
                </CardBody>
              </Card>
            </FlexItem>

            {open ? (
              <FlexItem>
                <Card isCompact>
                  <CardTitle>{t('PubSub.LISTENING')}</CardTitle>
                  <CardBody>
                    <LabelGroup categoryName={t('PubSub.CHANNELS')} numLabels={8}>
                      {open.channels.map((channel) => (
                        <Label key={channel} isCompact color="blue">
                          {channel}
                        </Label>
                      ))}
                    </LabelGroup>
                    <LabelGroup categoryName={t('PubSub.PATTERNS')} numLabels={8}>
                      {open.patterns.map((pattern) => (
                        <Label key={pattern} isCompact color="purple">
                          {pattern}
                        </Label>
                      ))}
                    </LabelGroup>
                    <Content component="small">
                      {t('PubSub.RECEIVED', { count: open.messagesReceived })}
                    </Content>
                  </CardBody>
                </Card>
              </FlexItem>
            ) : null}

            <FlexItem>
              <Card isCompact>
                <CardTitle>{t('PubSub.PUBLISH')}</CardTitle>
                <CardBody>
                  <Form
                    onSubmit={(event) => {
                      event.preventDefault();
                      send();
                    }}
                  >
                    <FormGroup label={t('PubSub.CHANNEL')} isRequired fieldId="publish-channel">
                      <TextInput
                        id="publish-channel"
                        value={publishChannel}
                        onChange={(_event, value) => setPublishChannel(value)}
                        isRequired
                      />
                    </FormGroup>
                    <FormGroup label={t('PubSub.MESSAGE')} fieldId="publish-payload">
                      <TextArea
                        id="publish-payload"
                        value={publishPayload}
                        rows={3}
                        onChange={(_event, value) => setPublishPayload(value)}
                      />
                    </FormGroup>
                    <Button
                      variant="secondary"
                      type="submit"
                      icon={<PlusCircleIcon />}
                      isLoading={publish.isPending}
                      isDisabled={publishChannel.trim() === '' || publish.isPending}
                    >
                      {t('PubSub.SEND')}
                    </Button>
                  </Form>
                </CardBody>
              </Card>
            </FlexItem>
          </Flex>
        </GridItem>

        <GridItem lg={8}>
          <Card isCompact isFullHeight className="keydra-pubsub__feed">
            <CardTitle>
              <Flex
                alignItems={{ default: 'alignItemsCenter' }}
                spaceItems={{ default: 'spaceItemsSm' }}
              >
                <FlexItem grow={{ default: 'grow' }}>{t('PubSub.FEED')}</FlexItem>
                <FlexItem>
                  {/* A control on a card header, so a button — an underlined word there
                        reads as text that happens to be clickable. */}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={clear}
                    isDisabled={messages.length === 0}
                  >
                    {t('PubSub.CLEAR_FEED')}
                  </Button>
                </FlexItem>
              </Flex>
            </CardTitle>
            <CardBody className="keydra-pubsub__feed-body">
              {messages.length === 0 ? (
                <EmptyState
                  titleText={t('PubSub.FEED_EMPTY_TITLE')}
                  icon={BellIcon}
                  headingLevel="h2"
                >
                  <EmptyStateBody>
                    {open ? t('PubSub.FEED_EMPTY_LISTENING') : t('PubSub.FEED_EMPTY_IDLE')}
                  </EmptyStateBody>
                </EmptyState>
              ) : (
                <Table aria-label={t('PubSub.FEED')} variant="compact">
                  <Thead>
                    <Tr>
                      <Th width={20}>{t('PubSub.AT')}</Th>
                      <Th width={20}>{t('PubSub.CHANNEL')}</Th>
                      <Th>{t('PubSub.MESSAGE')}</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {messages.map((message) => (
                      <Tr key={message.id}>
                        <Td dataLabel={t('PubSub.AT')} className="pf-v6-u-font-family-monospace">
                          {message.at.toLocaleTimeString()}
                        </Td>
                        <Td dataLabel={t('PubSub.CHANNEL')}>
                          <Label isCompact color={message.pattern ? 'purple' : 'blue'}>
                            {message.channel}
                          </Label>
                        </Td>
                        <Td
                          dataLabel={t('PubSub.MESSAGE')}
                          className="keydra-value__text pf-v6-u-font-family-monospace"
                        >
                          {message.payload}
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              )}
            </CardBody>
          </Card>
        </GridItem>
      </Grid>
    </PageSection>
  );
};
