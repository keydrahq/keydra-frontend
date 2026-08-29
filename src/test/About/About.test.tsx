import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { About } from '@app/About/About';
import { ApiService } from '@app/Shared/Services/Api.service';
import { aboutFixture } from '@mocks/handlers';
import { render } from '@test/utils';

describe('About', () => {
  it('renders the build metadata served by the backend', async () => {
    render(<About />);

    await waitFor(() => {
      expect(screen.getByText(aboutFixture.version)).toBeInTheDocument();
    });
    expect(screen.getByText(aboutFixture.build.commit)).toBeInTheDocument();
    expect(screen.getByText(aboutFixture.build.quarkusVersion)).toBeInTheDocument();
  });

  it('names the instance that answered and says where the scheduled work runs', async () => {
    render(<About />);

    await waitFor(() => {
      expect(screen.getByText('keydra-mock')).toBeInTheDocument();
    });
    expect(screen.getByText('Runs here')).toBeInTheDocument();
  });

  it('says what this instance exports and where the traces go', async () => {
    render(<About />);

    await waitFor(() => {
      expect(screen.getByText('/q/metrics')).toBeInTheDocument();
    });
    // Off is an answer, not a missing one: a page that said nothing here would leave
    // somebody reading a deployment manifest to find out.
    expect(screen.getByText('Not collected')).toBeInTheDocument();
  });

  it('says nothing about the instance when the server did not name one', async () => {
    const anonymous = new ApiService('/api/v1', () =>
      Promise.resolve(
        new Response(JSON.stringify({ ...aboutFixture, instance: null, observability: null }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    render(<About />, { services: { api: anonymous } });

    await waitFor(() => {
      expect(screen.getByText(aboutFixture.version)).toBeInTheDocument();
    });
    // A host or pod name is nobody's business from outside, so the card is simply absent
    // rather than present and empty.
    expect(screen.queryByText('This instance')).not.toBeInTheDocument();
    expect(screen.queryByText('/q/metrics')).not.toBeInTheDocument();
  });

  it('shows an error state when the backend is unreachable', async () => {
    const failing = new ApiService('/api/v1', () =>
      Promise.resolve(new Response(null, { status: 503, statusText: 'Service Unavailable' })),
    );

    render(<About />, { services: { api: failing } });

    await waitFor(() => {
      expect(screen.getByText('Could not load server information')).toBeInTheDocument();
    });
  });
});
