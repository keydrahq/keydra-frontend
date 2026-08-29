import type { ApiService } from '@app/Shared/Services/Api.service';
import type { MutationResult, ValueMutation, ValuePage } from './valueTypes';

export interface ReadValueParams {
  key: string;
  cursor?: string;
  count?: number;
  /** Omit to let the server choose the decoder. */
  encoding?: string;
}

/**
 * Endpoint bindings for reading and editing values.
 *
 * <p>The key travels as a query parameter rather than a path segment: keys routinely contain
 * slashes and colons, and a path segment would have to survive two rounds of encoding through the
 * proxy to arrive intact.
 */
export const valuesApi = {
  read: (api: ApiService, connectionId: number, params: ReadValueParams) => {
    const query = new URLSearchParams({ key: params.key });
    if (params.cursor) {
      query.set('cursor', params.cursor);
    }
    if (params.count) {
      query.set('count', String(params.count));
    }
    if (params.encoding) {
      query.set('encoding', params.encoding);
    }
    return api.doGet<ValuePage>(`/connections/${connectionId}/value?${query.toString()}`);
  },

  mutate: (api: ApiService, connectionId: number, mutation: ValueMutation) =>
    api.doPost<MutationResult>(`/connections/${connectionId}/value`, mutation),

  encodings: (api: ApiService, connectionId: number) =>
    api.doGet<string[]>(`/connections/${connectionId}/value/encodings`),
};
