import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Approvals } from '@app/Approvals/Approvals';
import { server } from '@mocks/node';
import { render } from '@test/utils';

const open = () => render(<Approvals />, { route: '/approvals', path: '/approvals' });

/** The row a request is drawn in, found by the sentence the server wrote for it. */
const rowSaying = async (what: string | RegExp) =>
  (await screen.findByText(what)).closest<HTMLElement>('tr')!;

describe('Approvals', () => {
  it('says what the operation would do rather than only which kind it is', async () => {
    open();

    // The sentence is the server's, written from what was stored — a page that assembled its
    // own would be a second description of one thing, and irreversible is the worst place for
    // two descriptions to disagree.
    expect(await screen.findByText('Delete every key matching session:*')).toBeInTheDocument();
  });

  it('draws both ends of a migration, because it is two servers', async () => {
    open();

    const row = await rowSaying(/Move every key matching orders:\*/);
    expect(within(row).getByText('local-redis → local-valkey')).toBeInTheDocument();
  });

  it('offers the two answers on somebody else’s request', async () => {
    open();

    const row = await rowSaying('Delete every key matching session:*');
    expect(within(row).getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Decline' })).toBeInTheDocument();
  });

  it('offers neither on your own, and says why rather than leaving an absence', async () => {
    open();

    const row = await rowSaying(/Move every key matching orders:\*/);
    // The reason there are no buttons is the whole point of the feature, so it is said.
    expect(within(row).getByText('Yours')).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Withdraw' })).toBeInTheDocument();
  });

  it('approves the request it was pressed on', async () => {
    let approved: string | undefined;
    server.use(
      http.post('/api/v1/approvals/:id/approve', ({ params }) => {
        approved = String(params.id);
        return HttpResponse.json({ id: Number(params.id), state: 'RUNNING' });
      }),
    );
    open();

    const row = await rowSaying('Delete every key matching session:*');
    await userEvent.click(within(row).getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(approved).toBe('1'));
  });

  it('asks for a reason before declining, and sends it', async () => {
    let sent: unknown;
    server.use(
      http.post('/api/v1/approvals/:id/decline', async ({ request, params }) => {
        sent = await request.json();
        return HttpResponse.json({ id: Number(params.id), state: 'DECLINED' });
      }),
    );
    open();

    const row = await rowSaying('Delete every key matching session:*');
    await userEvent.click(within(row).getByRole('button', { name: 'Decline' }));

    // The person who asked reads it, and "declined" on its own tells them nothing they can act
    // on — which is why declining takes a reason at all.
    await userEvent.type(await screen.findByLabelText('Reason'), 'Not during the sale');
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Decline' }));

    await waitFor(() => expect(sent).toEqual({ reason: 'Not during the sale' }));
  });

  it('keeps what a sentence cannot hold in the row underneath', async () => {
    open();

    const row = await rowSaying(/Move every key matching orders:\*/);
    // A ceiling on how hard the link is pulled is the difference between agreeing to a copy and
    // agreeing to a different copy, so it is reachable rather than only in the payload.
    await userEvent.click(within(row).getByRole('button', { name: /details/i }));

    expect(await screen.findByText('At most 500 keys per second')).toBeInTheDocument();
  });

  it('asks for the answered ones only when somebody asks', async () => {
    const asked: string[] = [];
    server.use(
      http.get('/api/v1/approvals', ({ request }) => {
        asked.push(new URL(request.url).search);
        return HttpResponse.json([]);
      }),
    );
    open();

    await screen.findByText('Nothing is waiting');
    await userEvent.click(screen.getByLabelText('Show answered requests'));

    await waitFor(() => expect(asked).toContain('?all=true'));
  });

  it('says nothing is waiting rather than drawing an empty table', async () => {
    server.use(http.get('/api/v1/approvals', () => HttpResponse.json([])));
    open();

    expect(await screen.findByText('Nothing is waiting')).toBeInTheDocument();
  });
});
