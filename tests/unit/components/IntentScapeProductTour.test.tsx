import { fireEvent, render, screen } from '@testing-library/react';
import { IntentScapeProductTour } from '@/components/intentscape/IntentScapeProductTour';

describe('IntentScapeProductTour', () => {
  it('explains the agent loop and completes the approval-gated sample journey', async () => {
    render(<IntentScapeProductTour />);

    expect(
      screen.getByRole('heading', {
        name: /it does not answer your prompt.*expands the situation/i,
      })
    ).toBeInTheDocument();
    expect(screen.getAllByText(/provenance only/i)).toHaveLength(2);
    expect(
      screen.getByRole('heading', { name: /seven ways out/i })
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/acceptance criteria/i), {
      target: {
        value: 'Qualified buyers complete comparison with less uncertainty.',
      },
    });
    fireEvent.change(screen.getByLabelText(/explicit exclusions/i), {
      target: { value: 'No autonomous publishing.' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /approve this exact direction/i })
    );

    expect(await screen.findByText(/goal contract approved/i)).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: /build governed work packet/i })
    );
    expect(await screen.findByText(/governed work packet/i)).toBeVisible();
    expect(screen.getByText(/contains no new authority/i)).toBeInTheDocument();
  });
});
