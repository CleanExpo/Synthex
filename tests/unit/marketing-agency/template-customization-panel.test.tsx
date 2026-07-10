/**
 * DOM render tests — TemplateCustomizationPanel (SYN-40).
 *
 * Repo idiom (RTL + jsdom via jest.worktree.cjs). Proves:
 *   - BrandDNA-seeded defaults populate the panel,
 *   - the preview is PERMANENTLY captioned as a style reference applied by the
 *     render step (not the AI model),
 *   - the safe-zone grid disables out-of-zone cells per aspect ratio,
 *   - onChange emits a deterministic BrandOverlaySpec (and null while the
 *     style is invalid).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TemplateCustomizationPanel } from '@/components/marketing-agency/TemplateCustomizationPanel';
import {
  SAFE_ZONES,
  type BrandOverlaySpec,
} from '@/lib/marketing-agency/brand-style';

const CAPTION = /applied by the render step, not the AI model/i;

const defaults = {
  primaryColor: '#aa1122',
  secondaryColor: '#334455',
  font: 'poppins',
  ctaText: 'Shop now',
};

describe('TemplateCustomizationPanel', () => {
  test('renders BrandDNA-seeded defaults', () => {
    render(
      <TemplateCustomizationPanel aspectRatio="9:16" defaults={defaults} />
    );

    expect(screen.getByLabelText('Primary colour')).toHaveValue('#aa1122');
    expect(screen.getByLabelText('Secondary colour')).toHaveValue('#334455');
    expect(screen.getByLabelText('CTA text')).toHaveValue('Shop now');
    expect(
      screen.getByRole('button', { name: 'Poppins', pressed: true })
    ).toBeInTheDocument();
  });

  test('preview is permanently captioned as a render-step style reference', () => {
    render(
      <TemplateCustomizationPanel aspectRatio="9:16" defaults={defaults} />
    );
    expect(screen.getByText(CAPTION)).toBeInTheDocument();
  });

  test('safe-zone grid disables out-of-zone cells for 9:16', () => {
    render(
      <TemplateCustomizationPanel aspectRatio="9:16" defaults={defaults} />
    );

    // 9:16 reserves the top band for platform chrome — no CTA up there.
    expect(
      screen.getByRole('button', { name: 'CTA: top-left (outside safe zone)' })
    ).toBeDisabled();
    // The ratio's default CTA cell is live.
    const defaultCta = SAFE_ZONES['9:16'].defaultCtaPosition;
    expect(
      screen.getByRole('button', { name: `CTA: ${defaultCta}` })
    ).toBeEnabled();
    // Logos live in the top band on 9:16 — bottom is disabled.
    expect(
      screen.getByRole('button', {
        name: 'Logo: bottom-center (outside safe zone)',
      })
    ).toBeDisabled();
  });

  test('safe-zone grid follows the aspect ratio (16:9 allows bottom-right logo)', () => {
    render(
      <TemplateCustomizationPanel aspectRatio="16:9" defaults={defaults} />
    );
    expect(
      screen.getByRole('button', { name: 'Logo: bottom-right' })
    ).toBeEnabled();
    expect(
      screen.getByRole('button', {
        name: 'Logo: bottom-center (outside safe zone)',
      })
    ).toBeDisabled();
  });

  test('emits a deterministic BrandOverlaySpec seeded from defaults', async () => {
    const onChange = jest.fn();
    render(
      <TemplateCustomizationPanel
        aspectRatio="9:16"
        defaults={defaults}
        onChange={onChange}
      />
    );

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const spec = onChange.mock.calls.at(-1)![0] as BrandOverlaySpec;
    expect(spec).toMatchObject({
      version: 1,
      aspectRatio: '9:16',
      colors: { primary: '#aa1122', secondary: '#334455' },
      font: { id: 'poppins' },
      cta: {
        text: 'Shop now',
        position: SAFE_ZONES['9:16'].defaultCtaPosition,
      },
      logo: null, // no logo URL supplied
      safeZone: SAFE_ZONES['9:16'].margin,
    });
  });

  test('selecting an in-zone CTA cell updates the emitted spec', async () => {
    const onChange = jest.fn();
    render(
      <TemplateCustomizationPanel
        aspectRatio="9:16"
        defaults={defaults}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'CTA: middle-center' }));

    await waitFor(() => {
      const spec = onChange.mock.calls.at(-1)![0] as BrandOverlaySpec | null;
      expect(spec?.cta?.position).toBe('middle-center');
    });
  });

  test('invalid colour → issues listed and onChange(null)', async () => {
    const onChange = jest.fn();
    render(
      <TemplateCustomizationPanel
        aspectRatio="9:16"
        defaults={defaults}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByLabelText('Primary colour'), {
      target: { value: 'not-a-hex' },
    });

    await waitFor(() =>
      expect(screen.getByLabelText('Brand style issues')).toBeInTheDocument()
    );
    expect(screen.getByText(/primaryColor/)).toBeInTheDocument();
    expect(onChange.mock.calls.at(-1)![0]).toBeNull();
  });
});
