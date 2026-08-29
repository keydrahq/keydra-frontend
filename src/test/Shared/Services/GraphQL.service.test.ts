import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@app/Shared/Services/Api.service';
import { GraphQLError, GraphQLService } from '@app/Shared/Services/GraphQL.service';

/** A fetch that answers with whatever the test hands it. */
const answering = (status: number, body: unknown) =>
  vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  ) as unknown as typeof fetch;

/**
 * The client between the pages and the GraphQL surface.
 *
 * <p>What is worth pinning is how it tells failures apart. A GraphQL refusal arrives as a
 * successful HTTP response with a reason in the body, and a transport failure arrives as a status
 * code — and the two send the application to different places: one is something the page reports,
 * the other is what puts the login page back when a session has expired.
 */
describe('GraphQLService', () => {
  it('answers with the data a query asked for', async () => {
    const service = new GraphQLService(
      '/graphql',
      answering(200, { data: { migrations: [1, 2] } }),
    );

    await expect(service.query('{ migrations { id } }')).resolves.toEqual({ migrations: [1, 2] });
  });

  it('raises a refusal as its own kind of error, not as a transport failure', async () => {
    const service = new GraphQLService(
      '/graphql',
      answering(200, { errors: [{ message: 'complexity limit exceeded' }] }),
    );

    await expect(service.query('{ migrations { id } }')).rejects.toBeInstanceOf(GraphQLError);
  });

  it('reports every problem, not only the first', async () => {
    const service = new GraphQLService(
      '/graphql',
      answering(200, { errors: [{ message: 'first' }, { message: 'second' }] }),
    );

    await expect(service.query('{ x }')).rejects.toMatchObject({
      problems: ['first', 'second'],
    });
  });

  it('raises a transport failure as an ApiError, so an expired session still signs out', async () => {
    // The one handler that puts the login page back watches for ApiError with a 401. A
    // GraphQL client that wrapped that in its own type would break signing out.
    const service = new GraphQLService('/graphql', answering(401, {}));

    await expect(service.query('{ migrations { id } }')).rejects.toBeInstanceOf(ApiError);
  });

  it('refuses an answer with neither data nor a reason', async () => {
    const service = new GraphQLService('/graphql', answering(200, {}));

    await expect(service.query('{ migrations { id } }')).rejects.toBeInstanceOf(GraphQLError);
  });

  it('always posts, so a query never lands in a URL', async () => {
    const fetchFn = answering(200, { data: {} });
    const service = new GraphQLService('/graphql', fetchFn);

    await service.query('{ migrations { id } }');

    const [, init] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((init as RequestInit).method).toBe('POST');
  });
});
