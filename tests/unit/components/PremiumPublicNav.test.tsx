import { fireEvent, render, screen } from '@testing-library/react';
import { PremiumPublicNav } from '@/components/landing/premium/public-nav';

let mockPathname = '/';

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

describe('PremiumPublicNav', () => {
  beforeEach(() => {
    mockPathname = '/';
  });

  it('makes every primary destination available from the mobile menu', () => {
    render(<PremiumPublicNav />);

    fireEvent.click(screen.getByRole('button', { name: /open navigation/i }));

    const mobileNav = screen.getByRole('navigation', {
      name: /mobile primary/i,
    });
    expect(mobileNav).toBeVisible();
    expect(screen.getAllByRole('link', { name: /^free map$/i })).toHaveLength(
      2
    );
    expect(screen.getAllByRole('link', { name: /^product$/i })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: /^log in$/i })).toHaveLength(2);
  });

  it('sends the Opportunity Map call to the form instead of reloading the page', () => {
    mockPathname = '/opportunity-map';
    render(<PremiumPublicNav />);

    expect(screen.getByRole('link', { name: /start free/i })).toHaveAttribute(
      'href',
      '#build-map'
    );
    expect(
      screen.getByRole('link', { name: /build free map/i })
    ).toHaveAttribute('href', '#build-map');
  });
});
