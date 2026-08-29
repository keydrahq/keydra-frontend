import type { FC } from 'react';
import { useState } from 'react';
import {
  Alert,
  AlertActionLink,
  Button,
  Divider,
  Dropdown,
  DropdownItem,
  DropdownList,
  DrawerActions,
  DrawerCloseButton,
  DrawerHead,
  DrawerPanelBody,
  DrawerPanelContent,
  Flex,
  FlexItem,
  Label,
  MenuToggle,
  Select,
  SelectList,
  SelectOption,
  Skeleton,
  Stack,
  StackItem,
  Title,
  Tooltip,
} from '@patternfly/react-core';
import { CopyIcon, EllipsisVIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@app/Shared/Services/Api.service';
import { ErrorView } from '@app/Shared/Components/ErrorView';
import { useNotifications } from '@app/Shared/Components/notificationStore';
import { useSupports } from '@app/Connections/capabilities';
import { Feature } from '@app/Topology/types';
import { KeyTtlLabel } from './KeyTtlLabel';
import { KeyTypeLabel } from './KeyTypeLabel';
import { ValueEditor } from './editors/ValueEditor';
import { IncompleteValueError, toJson, toRedisCli } from './copyAs';
import { useKeyChanged } from './useKeyspaceWatch';
import { useMutateValue, useEncodings, useValue } from './valueQueries';
import type { KeyEntry } from './types';
import { AUTO_ENCODING } from './valueTypes';

export interface KeyDetailPanelProps {
  connectionId: number;
  /** Which database this key is in, so a notice about another one is not read as being about it. */
  database?: number;
  entry: KeyEntry;
  onClose: () => void;
  onRename: (entry: KeyEntry) => void;
  onDuplicate: (entry: KeyEntry) => void;
  onSetTtl: (entry: KeyEntry) => void;
  onDelete: (entry: KeyEntry) => void;
}

/**
 * Whether what happened means the key is not there any more.
 *
 * <p>The store's own vocabulary, matched on the two words that mean gone rather than translated
 * into a set of our own: the words are the server's and it adds to them, so a reader that only
 * understood what it was taught would quietly stop recognising whatever came next. Anything
 * unrecognised is treated as a change, which is the safe half of being wrong.
 */
const isGone = (event: string): boolean => event === 'del' || event === 'expired';

/** Formats a byte count without pretending to more precision than it has. */
const formatBytes = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
};

/**
 * One key's value, alongside the keyspace rather than instead of it.
 *
 * <p>A drawer, not a page: inspecting a key is something done repeatedly while scanning a list, and
 * a route change per key would throw away the scroll position and the running scan each time.
 */
export const KeyDetailPanel: FC<KeyDetailPanelProps> = ({
  connectionId,
  database,
  entry,
  onClose,
  onRename,
  onDuplicate,
  onSetTtl,
  onDelete,
}) => {
  const { t } = useTranslation();
  const { notify } = useNotifications();
  const [encoding, setEncoding] = useState(AUTO_ENCODING);
  const [isEncodingOpen, setEncodingOpen] = useState(false);
  const [isActionsOpen, setActionsOpen] = useState(false);

  const supports = useSupports(connectionId);
  const canRename = supports(Feature.RenameKey);
  const canDuplicate = supports(Feature.CopyKey);
  const canSetTtl = supports(Feature.Expiry);

  const encodings = useEncodings(connectionId);
  const value = useValue(connectionId, entry.key, encoding === AUTO_ENCODING ? '' : encoding);
  const changed = useKeyChanged(connectionId, database ?? 0, entry.key);
  const mutate = useMutateValue(connectionId);

  const pages = value.data?.pages ?? [];
  const total = pages[0]?.total ?? null;

  const copy = async (render: () => string, message: string) => {
    setActionsOpen(false);
    try {
      await navigator.clipboard.writeText(render());
      notify({ title: message, variant: 'success' });
    } catch (error) {
      notify({
        title:
          error instanceof IncompleteValueError
            ? t('Value.COPY_TRUNCATED')
            : t('Value.COPY_FAILED'),
        variant: 'danger',
      });
    }
  };

  const body = () => {
    if (value.isPending) {
      return <Skeleton screenreaderText={t('Value.LOADING')} height="12rem" />;
    }
    if (value.isError) {
      // A key can expire or be deleted between the scan and the click; that is not a
      // failure worth an error page, it is an answer.
      if (value.error instanceof ApiError && value.error.status === 404) {
        return <ErrorView title={t('Value.GONE_TITLE')} message={t('Value.GONE_BODY')} />;
      }
      return <ErrorView title={t('Value.LOAD_ERROR')} message={value.error.message} />;
    }
    if (pages.length === 0) {
      return null;
    }

    return (
      <Stack hasGutter>
        {/*
          Said, never done. The value may be in a box somebody is typing in, and this panel cannot
          tell a reader from an editor — the draft lives inside whichever of the editors the type
          selected. Replacing it would lose somebody's work to an event that was only ever a hint,
          so what arrives is a sentence and a button, and whoever is looking decides.
        */}
        {changed.event ? (
          <StackItem>
            <Alert
              variant={isGone(changed.event) ? 'warning' : 'info'}
              isInline
              title={
                isGone(changed.event)
                  ? t('Value.CHANGED_GONE', { event: changed.event })
                  : t('Value.CHANGED_ELSEWHERE', { event: changed.event })
              }
              actionLinks={
                <AlertActionLink
                  onClick={() => {
                    changed.clear();
                    void value.refetch();
                  }}
                >
                  {t('Value.CHANGED_LOAD')}
                </AlertActionLink>
              }
            />
          </StackItem>
        ) : null}
        <StackItem>
          <ValueEditor
            keyName={entry.key}
            pages={pages}
            isBusy={mutate.isPending}
            onMutate={(mutation) =>
              mutate.mutate(mutation, {
                onError: (error) =>
                  notify({
                    title: t('Value.MUTATE_FAILED'),
                    description: error.message,
                    variant: 'danger',
                  }),
              })
            }
          />
        </StackItem>
        {value.hasNextPage ? (
          <StackItem>
            <Button
              variant="secondary"
              isBlock
              isLoading={value.isFetchingNextPage}
              isDisabled={value.isFetchingNextPage}
              onClick={() => void value.fetchNextPage()}
            >
              {t('Value.LOAD_MORE')}
            </Button>
          </StackItem>
        ) : null}
      </Stack>
    );
  };

  return (
    <DrawerPanelContent isResizable defaultSize="55%" minSize="28rem">
      <DrawerHead>
        <Stack hasGutter>
          <StackItem>
            <Flex
              spaceItems={{ default: 'spaceItemsSm' }}
              alignItems={{ default: 'alignItemsCenter' }}
              flexWrap={{ default: 'nowrap' }}
            >
              <FlexItem>
                <KeyTypeLabel type={entry.type} />
              </FlexItem>
              <FlexItem grow={{ default: 'grow' }} className="keydra-detail__key">
                <Tooltip content={entry.key}>
                  <Title
                    headingLevel="h2"
                    size="lg"
                    className="keydra-detail__key-text pf-v6-u-font-family-monospace"
                  >
                    {entry.key}
                  </Title>
                </Tooltip>
              </FlexItem>
            </Flex>
          </StackItem>

          <StackItem>
            <Flex
              spaceItems={{ default: 'spaceItemsSm' }}
              alignItems={{ default: 'alignItemsCenter' }}
            >
              <FlexItem>
                <Label isCompact variant="outline">
                  {t('Value.TTL_META')}
                </Label>
              </FlexItem>
              <FlexItem>
                <KeyTtlLabel ttl={entry.ttl} />
              </FlexItem>
              {total !== null ? (
                <FlexItem>
                  <Label isCompact variant="outline">
                    {t('Value.ELEMENTS', { count: total })}
                  </Label>
                </FlexItem>
              ) : null}
              {pages[0]?.type === 'string' ? (
                <FlexItem>
                  <Label isCompact variant="outline">
                    {formatBytes(pages[0].value.size)}
                  </Label>
                </FlexItem>
              ) : null}
            </Flex>
          </StackItem>
        </Stack>

        <DrawerActions>
          <Dropdown
            isOpen={isActionsOpen}
            onOpenChange={setActionsOpen}
            popperProps={{
              // Appended to the body so a menu opened near the bottom of a scrolling
              // card is not clipped by it, which is PatternFly's own guidance for this.
              position: 'right',
              preventOverflow: true,
              enableFlip: true,
              appendTo: () => document.body,
            }}
            toggle={(toggleRef) => (
              <MenuToggle
                ref={toggleRef}
                variant="plain"
                aria-label={t('Value.ACTIONS')}
                isExpanded={isActionsOpen}
                onClick={() => setActionsOpen((open) => !open)}
                icon={<EllipsisVIcon />}
              />
            )}
          >
            <DropdownList>
              <DropdownItem
                icon={<CopyIcon />}
                onClick={() => void copy(() => entry.key, t('Value.COPIED_KEY'))}
              >
                {t('Value.COPY_KEY')}
              </DropdownItem>
              <DropdownItem
                icon={<CopyIcon />}
                isDisabled={pages.length === 0}
                onClick={() => void copy(() => toJson(pages), t('Value.COPIED_JSON'))}
              >
                {t('Value.COPY_JSON')}
              </DropdownItem>
              <DropdownItem
                icon={<CopyIcon />}
                isDisabled={pages.length === 0}
                onClick={() => void copy(() => toRedisCli(entry.key, pages), t('Value.COPIED_CLI'))}
              >
                {t('Value.COPY_CLI')}
              </DropdownItem>
              {/*
               * The same three the row menu offers, and offered on the same terms: a store with
               * no rename, no copy or no expiry does not get a menu item whose only outcome is
               * an error. The divider above them goes with them, or two would end up adjacent.
               */}
              {(canRename || canDuplicate || canSetTtl) && <Divider component="li" />}
              {canRename && (
                <DropdownItem
                  onClick={() => {
                    setActionsOpen(false);
                    onRename(entry);
                  }}
                >
                  {t('KeyBrowser.RENAME')}
                </DropdownItem>
              )}
              {canDuplicate && (
                <DropdownItem
                  onClick={() => {
                    setActionsOpen(false);
                    onDuplicate(entry);
                  }}
                >
                  {t('KeyBrowser.DUPLICATE')}
                </DropdownItem>
              )}
              {canSetTtl && (
                <DropdownItem
                  onClick={() => {
                    setActionsOpen(false);
                    onSetTtl(entry);
                  }}
                >
                  {t('KeyBrowser.SET_TTL')}
                </DropdownItem>
              )}
              <Divider component="li" />
              <DropdownItem
                isDanger
                onClick={() => {
                  setActionsOpen(false);
                  onDelete(entry);
                }}
              >
                {t('KeyBrowser.DELETE')}
              </DropdownItem>
            </DropdownList>
          </Dropdown>
          <DrawerCloseButton onClick={onClose} />
        </DrawerActions>
      </DrawerHead>

      <DrawerPanelBody>
        <Stack hasGutter>
          <StackItem>
            <Select
              isOpen={isEncodingOpen}
              selected={encoding}
              onSelect={(_event, selection) => {
                setEncoding(String(selection));
                setEncodingOpen(false);
              }}
              onOpenChange={setEncodingOpen}
              toggle={(toggleRef) => (
                <MenuToggle
                  ref={toggleRef}
                  onClick={() => setEncodingOpen((open) => !open)}
                  isExpanded={isEncodingOpen}
                  aria-label={t('Value.ENCODING')}
                >
                  {encoding === AUTO_ENCODING ? t('Value.ENCODING_AUTO') : encoding}
                </MenuToggle>
              )}
            >
              <SelectList>
                <SelectOption value={AUTO_ENCODING} description={t('Value.ENCODING_AUTO_HELP')}>
                  {t('Value.ENCODING_AUTO')}
                </SelectOption>
                {(encodings.data ?? []).map((name) => (
                  <SelectOption key={name} value={name}>
                    {name}
                  </SelectOption>
                ))}
              </SelectList>
            </Select>
          </StackItem>
          <StackItem isFilled>{body()}</StackItem>
        </Stack>
      </DrawerPanelBody>
    </DrawerPanelContent>
  );
};
