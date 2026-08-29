import type { FC, ReactNode } from 'react';
import { useState } from 'react';
import {
  Button,
  Dropdown,
  Divider,
  DropdownItem,
  DropdownList,
  Flex,
  FlexItem,
  Label,
  LabelGroup,
  MenuToggle,
  SearchInput,
  Select,
  SelectList,
  SelectOption,
  Spinner,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
  ToolbarToggleGroup,
  Tooltip,
} from '@patternfly/react-core';
import {
  ColumnsIcon,
  EllipsisVIcon,
  FilterIcon,
  PlusCircleIcon,
  SyncAltIcon,
  UploadIcon,
} from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';
import { KEY_TYPES } from './types';

export interface KeyToolbarProps {
  /** Whether the namespace tree is held open while a value is being read. */
  /** The database picker, when the target has more than one keyspace. */
  databaseSelect?: ReactNode;
  isTreePinned: boolean;
  /** The toggle only means anything while a value is open; otherwise the tree is always shown. */
  canPinTree: boolean;
  onToggleTree: () => void;
  search: string;
  type: string;
  /** The namespace the tree has narrowed to, shown as a filter so it can be cleared. */
  prefix: string;
  selectedCount: number;
  keyCount: number;
  isStreaming: boolean;
  isTruncated: boolean;
  canLoadMore: boolean;
  onSearch: (value: string) => void;
  onPrefix: (value: string) => void;
  onLoadMore: () => void;
  onType: (value: string) => void;
  onRefresh: () => void;
  onDeleteSelected: () => void;
  /** Opens the dialog that writes a key's first value. */
  onCreate: () => void;
  /** Exports the ticked keys, or everything the filter matches when nothing is ticked. */
  onExport: () => void;
  /** Opens a file and restores what is in it. */
  onImport: () => void;
  /** Opens the dialog that moves keys to another target. */
  onMigrate: () => void;
  /** Asked to empty the target completely. */
  onPurgeAll: () => void;
  isTransferring: boolean;
  /*
   * Whether this store can hand a value over as bytes. Import, export and migration all go through
   * that one capability, so all three stand or fall together — and on a store without it they are
   * not offered rather than offered and refused.
   */
  canTransfer: boolean;
}

export const KeyToolbar: FC<KeyToolbarProps> = ({
  databaseSelect,
  isTreePinned,
  canPinTree,
  onToggleTree,
  search,
  type,
  prefix,
  selectedCount,
  keyCount,
  isStreaming,
  isTruncated,
  canLoadMore,
  onSearch,
  onPrefix,
  onLoadMore,
  onType,
  onRefresh,
  onDeleteSelected,
  onCreate,
  onExport,
  onImport,
  onMigrate,
  onPurgeAll,
  isTransferring,
  canTransfer,
}) => {
  const { t } = useTranslation();
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [isTypeOpen, setTypeOpen] = useState(false);

  return (
    /*
     * Every narrowing shows as a removable label under the controls, and one button clears
     * the lot. Three things narrow this list — a namespace picked in the tree, a glob typed
     * in the box, a type chosen from the menu — and until they were labelled, the only way
     * to tell why a key was missing was to remember what you had clicked.
     */
    /* No chip row under this toolbar: it appears when a filter is applied and moves the key
       list down by its own height, which is the thing being filtered. What the chips said is
       either already on the control that set it — the search box holds its text, the select
       holds its type — or shown here beside them, which is the namespace. */
    <Toolbar id="key-browser-toolbar" inset={{ default: 'insetNone' }}>
      <ToolbarContent alignItems="center">
        {/* Filters in a toggle group, which is how PatternFly makes a toolbar survive a
            narrow window: below the breakpoint they collapse behind the filter icon rather
            than reflowing one control at a time. This pane is often half a window wide,
            with a value open beside it. */}
        <ToolbarToggleGroup toggleIcon={<FilterIcon />} breakpoint="lg">
          <ToolbarItem className="keydra-toolbar__search">
            <SearchInput
              aria-label={t('KeyBrowser.SEARCH')}
              placeholder={t('KeyBrowser.SEARCH_PLACEHOLDER')}
              value={search}
              onChange={(_, value) => onSearch(value)}
              onClear={() => onSearch('')}
            />
          </ToolbarItem>

          <ToolbarItem>
            <Select
              isOpen={isTypeOpen}
              selected={type}
              onOpenChange={setTypeOpen}
              onSelect={(_event, value) => {
                onType(String(value));
                setTypeOpen(false);
              }}
              toggle={(toggleRef) => (
                <MenuToggle
                  ref={toggleRef}
                  icon={<FilterIcon />}
                  isExpanded={isTypeOpen}
                  onClick={() => setTypeOpen((open) => !open)}
                >
                  {type || t('KeyBrowser.FILTER_TYPE')}
                </MenuToggle>
              )}
            >
              <SelectList>
                <SelectOption value="">{t('KeyBrowser.FILTER_TYPE_ANY')}</SelectOption>
                {KEY_TYPES.map((keyType) => (
                  <SelectOption key={keyType} value={keyType}>
                    {keyType}
                  </SelectOption>
                ))}
              </SelectList>
            </Select>
          </ToolbarItem>

          {/* Shown only when the tree has narrowed the list, and the one filter worth a label
              of its own: it has no control here saying what it is, just a name and a way back
              out. Beside the others rather than in a row underneath them. */}
          {prefix ? (
            <ToolbarItem>
              <LabelGroup
                categoryName={t('KeyBrowser.FILTER_NAMESPACE')}
                isClosable
                onClick={() => onPrefix('')}
                closeBtnAriaLabel={t('KeyBrowser.CLEAR_FILTERS')}
              >
                <Label isCompact onClose={() => onPrefix('')}>
                  {prefix}
                </Label>
              </LabelGroup>
            </ToolbarItem>
          ) : null}
          {/* One way out of all of them, kept when the chip row went: three controls that
              each have to be cleared separately is three things to remember. */}
          {search || type || prefix ? (
            <ToolbarItem>
              <Button
                variant="link"
                isInline
                onClick={() => {
                  onPrefix('');
                  onSearch('');
                  onType('');
                }}
              >
                {t('KeyBrowser.CLEAR_FILTERS')}
              </Button>
            </ToolbarItem>
          ) : null}
        </ToolbarToggleGroup>

        {/* Before the filters in reading order, because it does not narrow the list — it
            chooses which list there is. */}
        {databaseSelect ? <ToolbarItem>{databaseSelect}</ToolbarItem> : null}

        {/* PatternFly's own order for a toolbar: filters, then the icon group, then the
            global actions, then the count. The primary button had been sitting between the
            filters and the icons, which put a call to action in the middle of the controls
            that narrow the list. */}
        <ToolbarGroup variant="action-group-plain">
          {canPinTree ? (
            <ToolbarItem>
              <Tooltip content={t('KeyBrowser.TOGGLE_TREE')}>
                <Button
                  variant="plain"
                  aria-label={t('KeyBrowser.TOGGLE_TREE')}
                  aria-pressed={isTreePinned}
                  icon={<ColumnsIcon />}
                  onClick={onToggleTree}
                />
              </Tooltip>
            </ToolbarItem>
          ) : null}
          <ToolbarItem>
            <Tooltip content={t('KeyBrowser.REFRESH')}>
              <Button
                variant="plain"
                aria-label={t('KeyBrowser.REFRESH')}
                icon={<SyncAltIcon />}
                isDisabled={isStreaming}
                onClick={onRefresh}
              />
            </Tooltip>
          </ToolbarItem>
        </ToolbarGroup>

        <ToolbarGroup variant="action-group">
          <ToolbarItem>
            {/* The one call to action here: everything else on this toolbar narrows the list
                or acts on what is already in it. */}
            {/* Full height, like every other control on this row: PatternFly's small
                button is 29px against their 37px, so a "sm" here sat four pixels low
                with a shorter body beside a search box and two menus. */}
            <Button variant="primary" icon={<PlusCircleIcon />} onClick={onCreate}>
              {t('CreateKey.ADD')}
            </Button>
          </ToolbarItem>
          {canTransfer ? (
            <ToolbarItem>
              {/* Beside the primary action rather than inside a menu: restoring a file is a
                  thing people arrive already meaning to do. */}
              <Tooltip content={t('ImportKeys.TITLE')}>
                <Button
                  variant="secondary"
                  aria-label={t('ImportKeys.TITLE')}
                  icon={<UploadIcon />}
                  isDisabled={isTransferring}
                  onClick={onImport}
                />
              </Tooltip>
            </ToolbarItem>
          ) : null}
          {/* Only once something is ticked. A permanently greyed-out danger button takes the
              same room as a live one and tells nobody anything. */}
          {selectedCount > 0 ? (
            <>
              <ToolbarItem className="pf-v6-u-text-color-subtle pf-v6-u-align-self-center">
                {t('KeyBrowser.SELECTED_COUNT', { count: selectedCount })}
              </ToolbarItem>
              <ToolbarItem>
                <Button variant="danger" onClick={onDeleteSelected}>
                  {t('KeyBrowser.DELETE_SELECTED', { count: selectedCount })}
                </Button>
              </ToolbarItem>
            </>
          ) : null}
          <ToolbarItem>
            {/* Import, export and migration are one menu rather than three more buttons:
                they are used rarely and would otherwise take as much room as the filters. */}
            <Dropdown
              isOpen={isMenuOpen}
              onOpenChange={setMenuOpen}
              onSelect={() => setMenuOpen(false)}
              popperProps={{
                // Aligned to the toggle's right edge and kept inside the window: this menu
                // sits at the end of the toolbar, so one growing rightwards runs off screen.
                position: 'right',
                preventOverflow: true,
                enableFlip: true,
                appendTo: () => document.body,
              }}
              toggle={(toggleRef) => (
                <MenuToggle
                  ref={toggleRef}
                  variant="plain"
                  aria-label={t('KeyBrowser.TRANSFER')}
                  isExpanded={isMenuOpen}
                  isDisabled={isTransferring}
                  onClick={() => setMenuOpen((open) => !open)}
                  icon={<EllipsisVIcon />}
                />
              )}
            >
              <DropdownList>
                {canTransfer ? (
                  <>
                    <DropdownItem onClick={onExport}>
                      {selectedCount > 0
                        ? t('KeyBrowser.EXPORT_SELECTED', { count: selectedCount })
                        : t('KeyBrowser.EXPORT_MATCHING')}
                    </DropdownItem>
                    <DropdownItem onClick={onMigrate}>{t('Migrate.TITLE')}</DropdownItem>
                    <Divider component="li" />
                  </>
                ) : null}
                {/* Last, and marked as dangerous: PatternFly puts a destructive action at
                    the end of a menu so it is never the neighbour of the one above it. */}
                <DropdownItem isDanger onClick={onPurgeAll}>
                  {t('KeyBrowser.PURGE_ALL')}
                </DropdownItem>
              </DropdownList>
            </Dropdown>
          </ToolbarItem>
        </ToolbarGroup>

        {/* The count is the toolbar's last element, which is where PatternFly puts it when
            there is no pagination. The "load more" affordance sits in the same item rather
            than its own: as two items they wrapped onto a line of their own, leaving a
            sentence and a link floating under the controls. */}
        <ToolbarItem
          align={{ default: 'alignEnd' }}
          className="keydra-toolbar__count pf-v6-u-align-self-center pf-v6-u-text-color-subtle"
        >
          <Flex
            spaceItems={{ default: 'spaceItemsSm' }}
            alignItems={{ default: 'alignItemsCenter' }}
            flexWrap={{ default: 'nowrap' }}
          >
            {isStreaming ? (
              <FlexItem>
                <Spinner size="sm" aria-label={t('KeyBrowser.SCANNING')} />
              </FlexItem>
            ) : null}
            <FlexItem>
              {isStreaming ? (
                t('KeyBrowser.FOUND_STREAMING', { count: keyCount })
              ) : isTruncated ? (
                /* Never present a truncated page as if it were the whole keyspace — but say
                   it in three words and put the explanation where it is asked for. A
                   sentence here is what pushed the count onto a line of its own. */
                <Tooltip content={t('KeyBrowser.FOUND_TRUNCATED_HELP', { count: keyCount })}>
                  <span>{t('KeyBrowser.FOUND_TRUNCATED', { count: keyCount })}</span>
                </Tooltip>
              ) : (
                t('KeyBrowser.FOUND', { count: keyCount })
              )}
            </FlexItem>
            {isTruncated ? (
              <FlexItem>
                {canLoadMore ? (
                  <Button variant="link" isInline onClick={onLoadMore}>
                    {t('KeyBrowser.LOAD_MORE')}
                  </Button>
                ) : (
                  // At the ceiling more rows are not on offer, so the toolbar says what is.
                  <Tooltip content={t('KeyBrowser.AT_LIMIT_HELP')}>
                    <Label color="orange" status="warning" isCompact>
                      {t('KeyBrowser.AT_LIMIT')}
                    </Label>
                  </Tooltip>
                )}
              </FlexItem>
            ) : null}
          </Flex>
        </ToolbarItem>
      </ToolbarContent>
    </Toolbar>
  );
};
