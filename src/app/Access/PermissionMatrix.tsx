import type { FC } from 'react';
import { Fragment, useMemo, useState } from 'react';
import { Checkbox, Content } from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import type { TranslationKey } from '@i18n/keys';
import type { PermissionInfo } from './types';

/**
 * The columns a permission can fall into.
 *
 * <p>Five, and every one of them a thing somebody would say out loud. The alternative — a column
 * per verb — is fourteen columns for twenty-eight permissions, which is a grid that is almost
 * entirely empty and reads as a wall rather than as a question anybody can answer.
 */
const COLUMNS = ['view', 'change', 'create', 'delete', 'run', 'other'] as const;

type Column = (typeof COLUMNS)[number];

/**
 * What each column is called.
 *
 * <p>Written out rather than built from the column name, so the translation keys are the checked
 * literals the rest of the application uses and a missing one fails the build.
 */
const COLUMN_LABEL: Record<Column, TranslationKey> = {
  view: 'Access.COLUMN_VIEW',
  change: 'Access.COLUMN_CHANGE',
  create: 'Access.COLUMN_CREATE',
  delete: 'Access.COLUMN_DELETE',
  run: 'Access.COLUMN_RUN',
  other: 'Access.COLUMN_OTHER',
};

/**
 * What each resource is called.
 *
 * <p>A domain the backend adds and this map has not caught up with shows its own identifier —
 * reading a little rough is the right failure, and not appearing at all is not.
 */
const RESOURCE_LABEL: Record<string, TranslationKey> = {
  connection: 'Access.RESOURCE_CONNECTION',
  keys: 'Access.RESOURCE_KEYS',
  values: 'Access.RESOURCE_VALUES',
  console: 'Access.RESOURCE_CONSOLE',
  pubsub: 'Access.RESOURCE_PUBSUB',
  commands: 'Access.RESOURCE_COMMANDS',
  monitoring: 'Access.RESOURCE_MONITORING',
  analysis: 'Access.RESOURCE_ANALYSIS',
  server: 'Access.RESOURCE_SERVER',
  acl: 'Access.RESOURCE_ACL',
  migration: 'Access.RESOURCE_MIGRATION',
  transfer: 'Access.RESOURCE_TRANSFER',
  groups: 'Access.RESOURCE_GROUPS',
  users: 'Access.RESOURCE_USERS',
  grants: 'Access.RESOURCE_GRANTS',
  idp: 'Access.RESOURCE_IDP',
  audit: 'Access.RESOURCE_AUDIT',
  schedule: 'Access.RESOURCE_SCHEDULE',
  alert: 'Access.RESOURCE_ALERT',
  'alert-delivery': 'Access.RESOURCE_ALERT_DELIVERY',
  backup: 'Access.RESOURCE_BACKUP',
  tunnel: 'Access.RESOURCE_TUNNEL',
  crypto: 'Access.RESOURCE_CRYPTO',
};

/**
 * Which column each verb belongs in.
 *
 * <p>Reading and writing are the two things most of these are, and the rest are the exceptions
 * worth their own column. Exporting is a read of the data and importing is a write of it, so they
 * sit with reads and writes rather than in a category of their own; publishing changes the world
 * and subscribing does not, so they part company here even though they are one feature.
 *
 * <p>A verb nobody mapped falls into "other" rather than disappearing. A permission that is not on
 * this screen is a permission nobody can grant, and a silent omission is the one failure a role
 * editor must not have.
 */
const COLUMN_OF: Record<string, Column> = {
  view: 'view',
  read: 'view',
  subscribe: 'view',
  watch: 'view',
  export: 'view',
  edit: 'change',
  write: 'change',
  manage: 'change',
  configure: 'change',
  publish: 'change',
  import: 'change',
  create: 'create',
  delete: 'delete',
  run: 'run',
  // Rotating every stored credential is not a change to a thing, it is an operation on the
  // instance — and the one this application would most like somebody to have thought about.
  rotate: 'run',
};

/**
 * Which section each resource belongs to.
 *
 * <p>Two groups of a dozen rows each is still two walls. What the rows divide into is what somebody
 * is actually deciding about — the data, the things you make the server do, the things you watch,
 * and the server itself — and those are separate decisions made by separate people.
 *
 * <p>A resource nobody placed falls into the level's own catch-all rather than vanishing, for the
 * same reason an unmapped verb does.
 */
const SECTION_OF: Record<string, TranslationKey> = {
  keys: 'Access.SECTION_DATA',
  values: 'Access.SECTION_DATA',
  transfer: 'Access.SECTION_DATA',
  console: 'Access.SECTION_OPERATING',
  pubsub: 'Access.SECTION_OPERATING',
  migration: 'Access.SECTION_OPERATING',
  commands: 'Access.SECTION_WATCHING',
  monitoring: 'Access.SECTION_WATCHING',
  analysis: 'Access.SECTION_WATCHING',
  connection: 'Access.SECTION_THE_SERVER',
  server: 'Access.SECTION_THE_SERVER',
  acl: 'Access.SECTION_THE_SERVER',
  users: 'Access.SECTION_PEOPLE',
  groups: 'Access.SECTION_PEOPLE',
  grants: 'Access.SECTION_PEOPLE',
  idp: 'Access.SECTION_PEOPLE',
  audit: 'Access.SECTION_WATCHING',
  schedule: 'Access.SECTION_OPERATING',
  alert: 'Access.SECTION_WATCHING',
  'alert-delivery': 'Access.SECTION_WATCHING',
  backup: 'Access.SECTION_DATA',
  tunnel: 'Access.SECTION_THE_SERVER',
  crypto: 'Access.SECTION_THE_SERVER',
};

/** The order sections appear in, which is the order somebody works through them. */
const SECTION_ORDER: TranslationKey[] = [
  'Access.SECTION_DATA',
  'Access.SECTION_OPERATING',
  'Access.SECTION_WATCHING',
  'Access.SECTION_THE_SERVER',
  'Access.SECTION_PEOPLE',
  'Access.SECTION_OTHER',
];

/** One resource, and the permission that sits in each column for it. */
interface Row {
  domain: string;
  cells: Partial<Record<Column, PermissionInfo>>;
}

export interface PermissionMatrixProps {
  /** Every permission there is, as the server describes them. */
  catalog: PermissionInfo[];
  /** The permission names currently held, by API name. */
  chosen: string[];
  /** Absent for a role that cannot be edited, which is how the built-in ones are shown. */
  onChange?: (chosen: string[]) => void;
}

/**
 * What a role may do, as a grid rather than a list.
 *
 * <p>Twenty-eight checkboxes in a column is a wall: nothing groups, nothing lines up, and the only
 * way to answer "may this role delete keys?" is to read all of it. The permissions are already
 * <em>resource</em> and <em>action</em> — that is literally what {@code keys:delete} says — so the
 * grid is not a layout imposed on them, it is the shape they were in all along. Down the side is
 * what is being acted on; across the top is what may be done to it; a cell exists only where that
 * combination is a real permission, so the empty ones say "there is no such thing" rather than "not
 * granted".
 *
 * <p>Built from the server's list rather than a copy kept here, so a permission added to the
 * backend appears without a second change, and one that was removed cannot be granted from a stale
 * screen.
 */
export const PermissionMatrix: FC<PermissionMatrixProps> = ({ catalog, chosen, onChange }) => {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState<string[]>([]);

  const levels = useMemo(() => build(catalog), [catalog]);
  const used = useMemo(
    () =>
      COLUMNS.filter((column) =>
        levels.some((level) =>
          level.sections.some((section) => section.rows.some((row) => row.cells[column])),
        ),
      ),
    [levels],
  );

  const held = useMemo(() => new Set(chosen), [chosen]);
  const readOnly = onChange === undefined;

  const toggle = (permission: string, checked: boolean) =>
    onChange?.(checked ? [...chosen, permission] : chosen.filter((name) => name !== permission));

  /** A whole level or a whole section, on or off together. */
  const toggleMany = (names: string[], checked: boolean) =>
    onChange?.(
      checked
        ? [...new Set([...chosen, ...names])]
        : chosen.filter((name) => !names.includes(name)),
    );

  return (
    <Table aria-label={t('Access.PERMISSIONS')} variant="compact" gridBreakPoint="">
      <Thead>
        <Tr>
          {/* The caret's own column, so a group heading and the rows under it line up. */}
          <Th screenReaderText={t('Access.EXPAND')} />
          <Th width={30}>{t('Access.RESOURCE')}</Th>
          {used.map((column) => (
            <Th key={column} modifier="fitContent" textCenter>
              {t(COLUMN_LABEL[column])}
            </Th>
          ))}
        </Tr>
      </Thead>

      {levels.map((level, index) => {
        const rows = level.sections.flatMap((section) => section.rows);
        const names = namesOf(rows, used);
        const all = names.length > 0 && names.every((name) => held.has(name));
        const some = names.some((name) => held.has(name));
        const isOpen = !collapsed.includes(level.level);

        return (
          <Tbody key={level.level} isExpanded={isOpen}>
            <Tr>
              <Td
                // PatternFly's own caret rather than a character in a plain button: this is the
                // expandable-row control the table component provides, and it comes with the
                // right size, the right hit area and the right accessible state.
                expand={{
                  rowIndex: index,
                  isExpanded: isOpen,
                  onToggle: () =>
                    setCollapsed((current) =>
                      isOpen
                        ? [...current, level.level]
                        : current.filter((key) => key !== level.level),
                    ),
                }}
              />
              <Td colSpan={used.length + 1}>
                {/* One checkbox for the whole group. The only control here that is about a set
                    of rows rather than a single cell, so it is the only one on this line. */}
                <Checkbox
                  id={`level-${level.level}`}
                  label={t(
                    level.level === 'INSTANCE' ? 'Access.ABOUT_KEYDRA' : 'Access.ABOUT_A_SERVER',
                  )}
                  isChecked={all ? true : some ? null : false}
                  isDisabled={readOnly}
                  onChange={(_event, checked) => toggleMany(names, checked)}
                />
              </Td>
            </Tr>

            {isOpen &&
              level.sections.map((section) => {
                const sectionNames = namesOf(section.rows, used);
                const allOfSection =
                  sectionNames.length > 0 && sectionNames.every((name) => held.has(name));
                const someOfSection = sectionNames.some((name) => held.has(name));

                return (
                  <Fragment key={`${level.level}-${String(section.key)}`}>
                    <Tr>
                      {/* Under the caret, so a section heading sits inside its level rather
                          than beside it. */}
                      <Td />
                      <Td colSpan={used.length + 1}>
                        <Checkbox
                          id={`section-${level.level}-${String(section.key)}`}
                          label={t(section.key)}
                          isChecked={allOfSection ? true : someOfSection ? null : false}
                          isDisabled={readOnly}
                          onChange={(_event, checked) => toggleMany(sectionNames, checked)}
                        />
                      </Td>
                    </Tr>

                    {section.rows.map((row) => (
                      <Tr key={`${level.level}-${row.domain}`}>
                        <Td />
                        <Td dataLabel={t('Access.RESOURCE')}>
                          <Content component="small">
                            {RESOURCE_LABEL[row.domain]
                              ? t(RESOURCE_LABEL[row.domain])
                              : row.domain}
                          </Content>
                        </Td>
                        {used.map((column) => {
                          const permission = row.cells[column];
                          return (
                            <Td key={column} dataLabel={t(COLUMN_LABEL[column])} textCenter>
                              {permission ? (
                                <Checkbox
                                  id={`permission-${permission.name}`}
                                  // The column heading is the label; repeating it in every cell
                                  // would have a screen reader read it out on all of them.
                                  aria-label={permission.id}
                                  isChecked={held.has(permission.name)}
                                  isDisabled={readOnly}
                                  onChange={(_event, checked) => toggle(permission.name, checked)}
                                />
                              ) : (
                                /* No such permission — said as absence, so it cannot be read
                                   as "allowed but not granted". */
                                <Content component="small">—</Content>
                              )}
                            </Td>
                          );
                        })}
                      </Tr>
                    ))}
                  </Fragment>
                );
              })}
          </Tbody>
        );
      })}
    </Table>
  );
};

/** A level, its sections, and the rows in each. */
interface Section {
  key: TranslationKey;
  rows: Row[];
}

interface Level {
  level: string;
  sections: Section[];
}

const build = (catalog: PermissionInfo[]): Level[] => {
  const byLevel = new Map<string, Map<string, Row>>();

  catalog.forEach((permission) => {
    const [domain, verb] = permission.id.split(':');
    const rows = byLevel.get(permission.level) ?? new Map<string, Row>();
    const row = rows.get(domain) ?? { domain, cells: {} };
    row.cells[COLUMN_OF[verb] ?? 'other'] = permission;
    rows.set(domain, row);
    byLevel.set(permission.level, rows);
  });

  // Servers first: it is what most roles are about, and scrolling past the instance
  // permissions to reach them would mean scrolling past the dangerous ones.
  return ['CONNECTION', 'INSTANCE']
    .filter((level) => byLevel.has(level))
    .map((level) => {
      const bySection = new Map<TranslationKey, Row[]>();
      [...byLevel.get(level)!.values()].forEach((row) => {
        const section = SECTION_OF[row.domain] ?? 'Access.SECTION_OTHER';
        bySection.set(section, [...(bySection.get(section) ?? []), row]);
      });
      return {
        level,
        sections: SECTION_ORDER.filter((key) => bySection.has(key)).map((key) => ({
          key,
          rows: bySection.get(key)!,
        })),
      };
    });
};

/** The permission names in these rows, for a checkbox that covers all of them. */
const namesOf = (rows: Row[], used: readonly Column[]): string[] =>
  rows.flatMap((row) =>
    used.map((column) => row.cells[column]?.name).filter((name): name is string => !!name),
  );
