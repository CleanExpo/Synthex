import { render, screen } from '@testing-library/react';
import { ProModePill } from '@/components/ui/pro-mode-pill';
import * as modeHook from '@/components/providers/mode-provider';

jest.mock('@/components/providers/mode-provider');

const mockUseMode = modeHook.useMode as jest.MockedFunction<
  typeof modeHook.useMode
>;

describe.skip('ProModePill', () => {
  test('renders "PRO MODE" text in pro mode', () => {
    mockUseMode.mockReturnValue({ mode: 'pro', isLoading: false });
    render(<ProModePill />);
    expect(screen.getByText('PRO MODE')).toBeInTheDocument();
  });

  test('renders nothing in simple mode', () => {
    mockUseMode.mockReturnValue({ mode: 'simple', isLoading: false });
    const { container } = render(<ProModePill />);
    expect(container.firstChild).toBeNull();
  });

  test('renders nothing while loading', () => {
    mockUseMode.mockReturnValue({ mode: 'simple', isLoading: true });
    const { container } = render(<ProModePill />);
    expect(container.firstChild).toBeNull();
  });
});
