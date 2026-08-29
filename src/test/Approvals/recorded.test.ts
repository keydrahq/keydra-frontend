import { describe, expect, it } from 'vitest';
import { ApiError } from '@app/Shared/Services/Api.service';
import { GraphQLError } from '@app/Shared/Services/GraphQL.service';
import { APPROVAL_REQUIRED, recordedInstead } from '@app/Approvals/recorded';

describe('recordedInstead', () => {
  it('recognises a recording by the code the server gave it', () => {
    const error = new GraphQLError(
      ['orders-prod is a target that nobody empties on their own'],
      [APPROVAL_REQUIRED],
    );

    expect(recordedInstead(error)).toBe('orders-prod is a target that nobody empties on their own');
  });

  it('does not recognise one by its wording', () => {
    // Every answer on that surface is 200, so the only thing separating "recorded, waiting for
    // somebody" from "that failed" is the code — and a page matching on the sentence would be
    // one translation away from treating a refusal as a success.
    const error = new GraphQLError(['orders-prod is a target that nobody empties on their own']);

    expect(recordedInstead(error)).toBeUndefined();
  });

  it('leaves every other failure alone', () => {
    expect(recordedInstead(new GraphQLError(['Nope'], ['something-else']))).toBeUndefined();
    expect(recordedInstead(new ApiError(500, 'Server Error', '/api/v1/keys'))).toBeUndefined();
    expect(recordedInstead(new Error('network'))).toBeUndefined();
  });
});
