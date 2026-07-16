import { generateSite, bindLeadCapture } from '@/lib/site-generator';
import type { BusinessProfile, SiteBrand } from '@/lib/site-generator';

const brand: SiteBrand = {
  slug: 'disaster-recovery',
  displayName: 'Disaster Recovery',
  legalName: 'Disaster Recovery Pty Ltd',
  tagline: 'Coverage when it counts',
  logoPrimary: 'https://disasterrecovery.com.au/logo.svg',
  forbiddenWords: [],
};

const profile: BusinessProfile = {
  name: 'Disaster Recovery',
  url: 'https://disasterrecovery.com.au',
  telephone: '+61730000000',
  address: {
    addressLocality: 'Brisbane',
    addressRegion: 'QLD',
    addressCountry: 'AU',
  },
  services: [{ slug: 'water-damage', label: 'water damage restoration' }],
};

function generatedHtml(): string {
  return generateSite({ brand, profile }).html;
}

describe('bindLeadCapture — wires the site-generator data-intake CTA to /api/leads (UNI-2355/#807)', () => {
  it('keeps the generated site HTML intact', () => {
    const html = generatedHtml();
    const bound = bindLeadCapture(html, {});
    expect(bound).toContain(html);
  });

  it('renders the #enquire fallback section the data-intake CTA anchors to', () => {
    // The generated CTA is <a data-intake href="#enquire">; the target must exist.
    const bound = bindLeadCapture(generatedHtml(), {});
    expect(bound).toContain('id="enquire"');
    expect(generatedHtml()).toContain('href="#enquire"');
  });

  it('collects the fields /api/leads needs: name, email, phone, message', () => {
    const bound = bindLeadCapture(generatedHtml(), {});
    expect(bound).toMatch(/<input[^>]*name="name"/);
    expect(bound).toMatch(
      /<input[^>]*name="email"[^>]*type="email"|<input[^>]*type="email"[^>]*name="email"/
    );
    expect(bound).toMatch(/name="phone"/);
    expect(bound).toMatch(/name="message"|<textarea[^>]*message/);
  });

  it('defaults the capture endpoint to the #807 lane, /api/leads', () => {
    const bound = bindLeadCapture(generatedHtml(), {});
    expect(bound).toContain('/api/leads');
  });

  it('honours a custom endpoint (e.g. a per-brand proxy origin)', () => {
    const bound = bindLeadCapture(generatedHtml(), {
      endpoint: 'https://app.unite-group.in/api/leads',
    });
    expect(bound).toContain('https://app.unite-group.in/api/leads');
  });

  it('stamps the business_key so the founder can attribute the lead to the brand', () => {
    const bound = bindLeadCapture(generatedHtml(), { businessKey: 'dr' });
    expect(bound).toMatch(/name="business_key"[^>]*value="dr"/);
  });

  it('escapes config values so they cannot break out of the markup', () => {
    const bound = bindLeadCapture(generatedHtml(), {
      businessKey: '"><script>alert(1)</script>',
    });
    expect(bound).not.toContain('"><script>alert(1)</script>');
  });

  it('emits a client script that POSTs JSON with the #807 field mapping', () => {
    const bound = bindLeadCapture(generatedHtml(), { businessKey: 'dr' });
    // Route parses request.json(); a plain form POST (x-www-form-urlencoded)
    // would 400. The enhancement must send JSON via fetch.
    expect(bound).toContain('<script>');
    expect(bound).toContain('first_name');
    expect(bound).toContain('application/json');
    expect(bound).toMatch(/fetch\(/);
  });

  it('has a status region for success/error feedback', () => {
    const bound = bindLeadCapture(generatedHtml(), {});
    expect(bound).toMatch(/data-lead-status/);
    expect(bound).toContain('aria-live');
  });
});
