import { ApiError } from './Api.service';

/** What the server sends back: some data, some errors, or both. */
interface GraphQLResponse<T> {
  data?: T;
  errors?: {
    message: string;
    path?: (string | number)[];
    /**
     * What the server calls this kind of refusal.
     *
     * <p>The surface answers 200 to everything, so a status code cannot say which kind it is.
     * The code is how one refusal is told from another by something other than its wording.
     */
    extensions?: { code?: string };
  }[];
}

/**
 * A failure the GraphQL surface reported.
 *
 * <p>Its own type because a GraphQL refusal is not an HTTP one: the request succeeded, the server
 * answered 200, and the reason it could not do what was asked is in the body. Anything catching
 * errors has to be able to tell a refused query from a network that dropped.
 */
export class GraphQLError extends Error {
  /** Every problem the server reported, not only the first. */
  readonly problems: string[];

  /**
   * What the server called each of them.
   *
   * <p>Kept beside the messages rather than instead of them: a person reads the sentence and the
   * code is what the browser branches on. Matching on wording would be a translation away from
   * breaking.
   */
  readonly codes: string[];

  constructor(problems: string[], codes: string[] = []) {
    super(problems[0] ?? 'The query was refused');
    this.name = 'GraphQLError';
    this.problems = problems;
    this.codes = codes;
  }

  /** Whether the server said this particular thing about any of them. */
  is(code: string): boolean {
    return this.codes.includes(code);
  }
}

/**
 * Asks the GraphQL surface a question.
 *
 * <p>Sixty lines rather than a client library, and deliberately. What a client library adds is a
 * normalised cache — and this application already has one, in TanStack Query, which every other
 * request goes through. Two caches over one server is two answers to "what is the current state of
 * this list", and the bug that produces is a page showing something nobody can find in the
 * database.
 *
 * <p>Always POST. A query in a URL is a query in a proxy log, a browser history and a referrer
 * header, and Keydra's queries name connection ids and key patterns — the server refuses GET for
 * the same reason.
 */
export class GraphQLService {
  private readonly path: string;
  private readonly fetchFn: typeof fetch;

  constructor(path = '/graphql', fetchFn: typeof fetch = (input, init) => fetch(input, init)) {
    this.path = path;
    this.fetchFn = fetchFn;
  }

  async query<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const response = await this.fetchFn(this.path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
    });

    // A transport failure is still an ApiError, so the one handler that puts the login page
    // back when a session expires keeps working for this surface too.
    if (!response.ok) {
      throw new ApiError(response.status, response.statusText, this.path);
    }

    const answer = (await response.json()) as GraphQLResponse<T>;
    if (answer.errors?.length) {
      throw new GraphQLError(
        answer.errors.map((error) => error.message),
        answer.errors
          .map((error) => error.extensions?.code)
          .filter((code): code is string => Boolean(code)),
      );
    }
    if (answer.data === undefined) {
      throw new GraphQLError(['The server answered with neither data nor a reason']);
    }
    return answer.data;
  }
}
