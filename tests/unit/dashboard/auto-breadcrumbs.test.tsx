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
    // Deliberately a route that is NOT an advanced tool. This case used to use
    // /dashboard/marketing-agency/authority, which the Power Tools work turned
    // into an advanced tool — and advanced pages render no AutoBreadcrumbs at
    // all (see the next case), so the assertions below could never pass there.
    mockUsePathname.mockReturnValue('/dashboard/content/social-posts');
    render(<AutoBreadcrumbs />);

    const home = screen.getByRole('link', { name: /dashboard/i });
    expect(home).toHaveAttribute('href', '/dashboard');

    const middle = screen.getByRole('link', { name: /content/i });
    expect(middle).toHaveAttribute('href', '/dashboard/content');

    // Last segment is the current page — humanised, not a link.
    const current = screen.getByText('Social Posts');
    expect(current).toHaveAttribute('aria-current', 'page');
  });

  it('renders nothing on an advanced tool page (AdvancedContextBar owns that trail)', () => {
    mockUsePathname.mockReturnValue('/dashboard/marketing-agency/authority');
    const { container } = render(<AutoBreadcrumbs />);
    expect(container.firstChild).toBeNull();
  });

  it('humanises and decodes slugged segments', () => {
    mockUsePathname.mockReturnValue('/dashboard/content/social-posts');
    render(<AutoBreadcrumbs />);
    expect(screen.getByText('Social Posts')).toBeInTheDocument();
  });
});
