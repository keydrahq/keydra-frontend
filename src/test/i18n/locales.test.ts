import { describe, expect, it } from 'vitest';
import en from '../../../locales/en/public.json';
import tr from '../../../locales/tr/public.json';
import enCommon from '../../../locales/en/common.json';
import trCommon from '../../../locales/tr/common.json';

type Bundle = Record<string, unknown>;

/** Every key in a bundle, as dotted paths, so nesting does not hide a gap. */
const paths = (bundle: Bundle, prefix = ''): string[] =>
  Object.entries(bundle).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'object' && value !== null ? paths(value as Bundle, path) : [path];
  });

/**
 * Plural suffixes i18next reads in the JSON v4 format this project uses.
 *
 * <p>`_plural` is the v3 spelling. It resolves to nothing in v4, and the base key is used
 * instead — so a count of two renders the singular text with no error anywhere. That is
 * exactly the kind of mistake nobody notices in review, which is why it is tested.
 */
const VALID_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other'];

describe('locale bundles', () => {
  it.each([
    ['public', en as Bundle, tr as Bundle],
    ['common', enCommon as Bundle, trCommon as Bundle],
  ])('%s: Turkish covers every English key', (_namespace, english, turkish) => {
    const missing = paths(english).filter((key) => !paths(turkish).includes(key));

    expect(missing).toEqual([]);
  });

  it.each([
    ['public', en as Bundle, tr as Bundle],
    ['common', enCommon as Bundle, trCommon as Bundle],
  ])('%s: Turkish carries no key English has dropped', (_namespace, english, turkish) => {
    // A stale key is a translation nobody will ever see, and usually the remains of a
    // rename that only half happened.
    const orphaned = paths(turkish).filter((key) => !paths(english).includes(key));

    expect(orphaned).toEqual([]);
  });

  it.each([
    ['en', en as Bundle],
    ['tr', tr as Bundle],
  ])('%s: uses plural suffixes i18next actually reads', (_language, bundle) => {
    const wrong = paths(bundle).filter((key) => key.endsWith('_plural'));

    expect(wrong).toEqual([]);
  });

  it.each([
    ['en', en as Bundle],
    ['tr', tr as Bundle],
  ])('%s: every pluralised key has an "other" form', (_language, bundle) => {
    const all = paths(bundle);
    const pluralised = new Set(
      all
        .filter((key) => VALID_SUFFIXES.some((suffix) => key.endsWith(suffix)))
        .map((key) => key.replace(/_(zero|one|two|few|many|other)$/, '')),
    );

    // "other" is the only category every language has, so it is the one that must exist.
    const withoutOther = [...pluralised].filter((base) => !all.includes(`${base}_other`));

    expect(withoutOther).toEqual([]);
  });

  it.each([
    ['en', en as Bundle],
    ['tr', tr as Bundle],
  ])('%s: no key is left empty', (_language, bundle) => {
    const empty = paths(bundle).filter((key) => {
      const value = key
        .split('.')
        .reduce<unknown>((node, part) => (node as Bundle)?.[part], bundle);
      return typeof value === 'string' && value.trim() === '';
    });

    expect(empty).toEqual([]);
  });
});
