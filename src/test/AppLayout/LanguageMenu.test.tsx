import { afterAll, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageMenu } from '@app/AppLayout/LanguageMenu';
import { render } from '@test/utils';
import i18n from '@i18n/config';

/**
 * Which language the interface speaks, in the masthead.
 *
 * <p>Here as well as in the settings page because of who needs it: somebody who can read the page
 * can find the settings, and somebody who cannot is the person this is for.
 */
describe('LanguageMenu', () => {
  // The i18n instance is the application's own and outlives a test, so a case that switches to
  // Turkish would leave every case after it reading Turkish.
  afterAll(() => {
    void i18n.changeLanguage('en');
  });

  it('names each language in its own language', async () => {
    const user = userEvent.setup();
    render(<LanguageMenu />);

    await user.click(screen.getByRole('button', { name: 'Language' }));

    // Not "Turkish": a person looking for Turkish is looking for "Türkçe", and a list in English
    // is a list they have to already read English to use.
    expect(screen.getByRole('menuitem', { name: 'Türkçe' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'English' })).toBeInTheDocument();
  });

  it('changes what the application speaks when one is chosen', async () => {
    const user = userEvent.setup();
    render(<LanguageMenu />);

    await user.click(screen.getByRole('button', { name: 'Language' }));
    await user.click(screen.getByRole('menuitem', { name: 'Türkçe' }));

    expect(await screen.findByRole('button', { name: 'Dil' })).toBeInTheDocument();
  });
});
