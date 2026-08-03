import { fireEvent, render, screen } from '@testing-library/react';
import { IntentScapeProductTour } from '@/components/intentscape/IntentScapeProductTour';
import { INTENTSCAPE_DEMO_MAP } from '@/components/intentscape/demo-data';

describe('IntentScapeProductTour', () => {
  it('explains the agent loop and completes the approval-gated sample journey', async () => {
    render(<IntentScapeProductTour />);

    expect(
      screen.getByRole('heading', {
        name: /see the options around a rough idea.*before you commit/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/your first note is a starting point/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/starting point only/i)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /seven ways out/i })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /use safe starting guardrails/i })
    );
    expect(
      (screen.getByLabelText(/what success looks like/i) as HTMLTextAreaElement)
        .value
    ).toMatch(/observable baseline and target/i);
    fireEvent.click(
      screen.getByRole('button', { name: /approve this exact direction/i })
    );

    expect(await screen.findByText(/direction approved/i)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /prepare this plan/i }));
    expect(await screen.findByText(/action-ready plan/i)).toBeVisible();
    expect(
      screen.getByText(/does not publish, purchase or contact anyone/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /download my vision brief/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /put the whole idea/i })
    ).toBeInTheDocument();
  });

  it('turns a visitor signal into a personal vision without requiring signup', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        workspaceId: 'prospect-workspace-1',
        acceptedVision: { visionMap: INTENTSCAPE_DEMO_MAP },
      }),
    } as Response);
    render(<IntentScapeProductTour />);

    const signal =
      'Our service is strong but prospects do not understand why it is different.';
    fireEvent.change(
      screen.getByPlaceholderText(/we need better product images/i),
      {
        target: { value: signal },
      }
    );
    fireEvent.click(
      screen.getByRole('button', { name: /find different directions/i })
    );

    expect(await screen.findByText(signal)).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/intentscape/public/expand',
      expect.objectContaining({ method: 'POST' })
    );
    fetchSpy.mockRestore();
  });
});
