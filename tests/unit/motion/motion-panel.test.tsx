import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  MotionPanel,
  toContent,
} from '@/app/dashboard/brand-video/motion-panel';

const fill = () => {
  fireEvent.change(screen.getByLabelText('Audience'), {
    target: { value: 'Homeowners' },
  });
  fireEvent.change(screen.getByLabelText('Call to action'), {
    target: { value: 'Call now' },
  });
  fireEvent.change(screen.getByLabelText('Source'), {
    target: { value: 'Arrival fell to 38 minutes' },
  });
  fireEvent.change(screen.getByLabelText('Key points'), {
    target: { value: '38 minutes\nAverage arrival\nDown from 90' },
  });
};

let fetchMock: jest.Mock;
beforeEach(() => {
  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('toContent', () => {
  it('maps key-point lines to each kind', () => {
    expect(toContent('stat', '38 minutes\nArrival\nDown from 90')).toEqual({
      kind: 'stat',
      stat: '38 minutes',
      label: 'Arrival',
      context: 'Down from 90',
    });
    expect(toContent('list', 'a\n\nb ')).toEqual({
      kind: 'list',
      items: ['a', 'b'],
    });
    expect(toContent('how-to', 'Call\nArrive')).toEqual({
      kind: 'how-to',
      steps: [{ step: 'Call' }, { step: 'Arrive' }],
    });
  });
});

describe('MotionPanel', () => {
  it('needs a brand before planning', () => {
    render(<MotionPanel brand="" />);
    expect(
      screen.getByRole('button', { name: /plan motion video/i })
    ).toBeDisabled();
  });

  it('shows the plan, the checked figures and the copyable Claude Motion brief', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        plan: {
          compositionId: 'StatReveal',
          durationInFrames: 600,
          fps: 30,
          onScreen: [],
          factCheck: { checked: ['38'] },
        },
        claudeMotionBrief: 'Make a 20-second 16:9 animation',
        warnings: [],
      }),
    });
    render(<MotionPanel brand="dr" />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: /plan motion video/i }));
    await waitFor(() =>
      expect(screen.getByText('StatReveal')).toBeInTheDocument()
    );
    expect(screen.getByText(/Facts checked:\s*38\./)).toBeInTheDocument();
    expect(screen.getByLabelText('Claude Motion brief')).toHaveValue(
      'Make a 20-second 16:9 animation'
    );
    expect(screen.getByText(/Not rendered yet/)).toBeInTheDocument();
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.content).toEqual({
      kind: 'stat',
      stat: '38 minutes',
      label: 'Average arrival',
      context: 'Down from 90',
    });
  });

  it('says plainly when a number is not in the source, and shows no plan', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        state: 'UNSUPPORTED',
        error: 'x',
        issues: ['Figures not found in the source: 20'],
      }),
    });
    render(<MotionPanel brand="dr" />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: /plan motion video/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(
      screen.getByText('Blocked: a number is not in your source.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Figures not found in the source: 20')
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Claude Motion brief')).toBeNull();
  });
});
