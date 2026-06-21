/**
 * Unit test for the Marketing Agency brand-package gating (SYN-1031 F3).
 *
 * The homepage previously rendered every portfolio brand card for every viewer.
 * Cards are now gated by the operator's accessible organisations, matched on the
 * canonical org slug, with a neutral empty state when none are accessible.
 */
import { render, screen } from '@testing-library/react';
import {
  BrandPackageCards,
  visibleBrandSlugs,
} from '@/components/marketing-agency/BrandPackageCards';

const mockUseActiveBusiness = jest.fn();
jest.mock('@/hooks/useActiveBusiness', () => ({
  useActiveBusiness: () => mockUseActiveBusiness(),
}));

function setBusinesses(
  businesses: { organizationSlug: string }[],
  isLoading = false
) {
  mockUseActiveBusiness.mockReturnValue({ businesses, isLoading });
}

afterEach(() => {
  mockUseActiveBusiness.mockReset();
});

describe('visibleBrandSlugs', () => {
  it('collects the org slugs from owned businesses', () => {
    const slugs = visibleBrandSlugs([
      { organizationSlug: 'carsi' },
      { organizationSlug: 'nrpg' },
    ]);
    expect(slugs.has('carsi')).toBe(true);
    expect(slugs.has('nrpg')).toBe(true);
    expect(slugs.has('ccw')).toBe(false);
  });

  it('is empty when there are no businesses', () => {
    expect(visibleBrandSlugs([]).size).toBe(0);
  });
});

describe('BrandPackageCards', () => {
  it('shows the empty state when the operator has no accessible packages', () => {
    setBusinesses([]);
    render(<BrandPackageCards />);

    expect(
      screen.getByText(/your brand packages will appear here/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/CCW EOFY/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/CARSI Restoration Training Authority/i)
    ).not.toBeInTheDocument();
  });

  it('renders nothing while the owned-business list is loading', () => {
    setBusinesses([], true);
    const { container } = render(<BrandPackageCards />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows only the cards for the brands the operator can access', () => {
    setBusinesses([{ organizationSlug: 'carsi' }]);
    render(<BrandPackageCards />);

    expect(
      screen.getByText(/CARSI Restoration Training Authority/i)
    ).toBeInTheDocument();
    // Not accessible → hidden.
    expect(screen.queryByText(/CCW EOFY/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'NRPG' })
    ).not.toBeInTheDocument();
  });

  it('gates the portfolio links individually within the shared card', () => {
    setBusinesses([
      { organizationSlug: 'restoreassist' },
      { organizationSlug: 'nrpg' },
    ]);
    render(<BrandPackageCards />);

    expect(
      screen.getByRole('link', { name: 'RestoreAssist' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'NRPG' })).toBeInTheDocument();
    // Disaster Recovery not owned → its link is absent.
    expect(
      screen.queryByRole('link', { name: 'Disaster Recovery' })
    ).not.toBeInTheDocument();
    // RestoreAssist owned → its launch card also shows.
    expect(screen.getByText('RestoreAssist Launch')).toBeInTheDocument();
  });

  it('shows every card to an owner who can access all brands', () => {
    setBusinesses([
      { organizationSlug: 'ccw' },
      { organizationSlug: 'carsi' },
      { organizationSlug: 'restoreassist' },
      { organizationSlug: 'disaster-recovery' },
      { organizationSlug: 'nrpg' },
    ]);
    render(<BrandPackageCards />);

    expect(screen.getByText(/CCW EOFY/i)).toBeInTheDocument();
    expect(
      screen.getByText(/CARSI Restoration Training Authority/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Disaster Recovery' })
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/your brand packages will appear here/i)
    ).toBeNull();
  });
});
