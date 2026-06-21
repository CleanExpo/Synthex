import { render, screen } from '@testing-library/react';
import * as nav from 'next/navigation';
import { AutoBreadcrumbs } from '@/components/dashboard/auto-breadcrumbs';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}));

const mockUsePathname = nav.usePathname as jest.MockedFunction<
  typeof nav.usePathname
>;

describe('AutoBreadcrumbs', () => {
  it('renders nothing on the dashboard root', () => {
    mockUsePathname.mockReturnValue('/dashboard');
    const { container } = render(<AutoBreadcrumbs />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing on a top-level section page (no nesting)', () => {
    mockUsePathname.mockReturnValue('/dashboard/content');
    const { container } = render(<AutoBreadcrumbs />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a trail for a nested page with the last segment current', () => {
    mockUsePathname.mockReturnValue('/dashboard/marketing-agency/authority');
    render(<AutoBreadcrumbs />);

    const home = screen.getByRole('link', { name: /dashboard/i });
    expect(home).toHaveAttribute('href', '/dashboard');

    const middle = screen.getByRole('link', { name: /marketing agency/i });
    expect(middle).toHaveAttribute('href', '/dashboard/marketing-agency');

    // Last segment is the current page — humanised, not a link.
    const current = screen.getByText('Authority');
    expect(current).toHaveAttribute('aria-current', 'page');
  });

  it('humanises and decodes slugged segments', () => {
    mockUsePathname.mockReturnValue('/dashboard/content/social-posts');
    render(<AutoBreadcrumbs />);
    expect(screen.getByText('Social Posts')).toBeInTheDocument();
  });
});
