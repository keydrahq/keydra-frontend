import { describe, expect, it } from 'vitest';
import { redactText, redactUrl, startTelemetry } from '@app/Shared/Services/Telemetry';

describe('browser telemetry', () => {
  it('sends nothing when no collector was named', async () => {
    // The ordinary case, and the one worth a test: an environment variable nobody set must
    // not become an application quietly posting somewhere.
    await expect(startTelemetry()).resolves.toBe(false);
  });

  describe('redactUrl', () => {
    it('keeps the shape of a page and drops what is inside a target', () => {
      expect(redactUrl('http://localhost:9000/connections/2/keys/user:42:session')).toBe(
        'http://localhost:9000/connections/2/keys/…',
      );
      expect(redactUrl('http://localhost:8181/api/v1/connections/2/values/session:abc')).toBe(
        'http://localhost:8181/api/v1/connections/2/values/…',
      );
    });

    it('drops the query string and the fragment entirely', () => {
      // A glob somebody typed is the same disclosure by another route.
      expect(redactUrl('http://localhost:9000/connections/2?match=user:*')).toBe(
        'http://localhost:9000/connections/2',
      );
      expect(redactUrl('http://localhost:9000/console#get%20user:42')).toBe(
        'http://localhost:9000/console',
      );
    });

    it('leaves a URL that names nothing inside a target alone', () => {
      expect(redactUrl('http://localhost:9000/connections')).toBe(
        'http://localhost:9000/connections',
      );
      // A path stays a path: what goes in decides what comes out.
      expect(redactUrl('/api/v1/about')).toBe('/api/v1/about');
    });

    it('takes the key out of the requests the page makes', () => {
      expect(redactUrl('http://localhost:9000/api/v1/connections/1/value?key=user:42')).toBe(
        'http://localhost:9000/api/v1/connections/1/value/…',
      );
      expect(redactUrl('http://localhost:9000/api/v1/connections/1/keys/tree?prefix=user:')).toBe(
        'http://localhost:9000/api/v1/connections/1/keys/…',
      );
    });

    it('redacts a URL wherever it is hiding, not only when it is the whole string', () => {
      // Faro names an address five different ways depending on what it is reporting, and an
      // error message can carry one in the middle of a sentence.
      expect(
        redactText('Failed to fetch http://localhost:9000/api/v1/connections/1/keys/user:42 twice'),
      ).toBe('Failed to fetch http://localhost:9000/api/v1/connections/1/keys/… twice');
      expect(redactText('nothing to see here')).toBe('nothing to see here');
    });

    it('gives up on anything it cannot read as a URL', () => {
      // Nothing here can be trusted to be structure rather than data, so none of it goes.
      expect(redactUrl('http://')).toBe('…');
    });
  });
});
