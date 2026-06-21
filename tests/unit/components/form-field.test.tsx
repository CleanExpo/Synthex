/**
 * Tests for FormField debounced keystroke validation (Wave 5 consistency polish).
 *
 * The field previously only validated on blur (and on change *after* a first
 * blur), so users typing into a fresh field saw no feedback until they left it.
 * `validateOnType` (default on) surfaces the error mid-typing after a debounce,
 * before the user leaves the field — while `validateOnType={false}` preserves
 * the old blur-only behaviour.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { FormField, validators } from '@/components/ui/form-field';

describe('FormField — debounced keystroke validation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('surfaces a validation error while typing (before blur) after the debounce', () => {
    render(
      <FormField label="Email" validation={validators.email} debounceMs={300} />
    );

    const input = screen.getByLabelText('Email');
    fireEvent.change(input, { target: { value: 'not-an-email' } });

    // Nothing yet — still within the debounce window, field not blurred.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(300);
    });

    // Error now visible without the user ever leaving the field.
    expect(screen.getByRole('alert')).toHaveTextContent(/valid email address/i);
  });

  it('does not show an error mid-typing when validateOnType is disabled', () => {
    render(
      <FormField
        label="Email"
        validation={validators.email}
        validateOnType={false}
        debounceMs={300}
      />
    );

    const input = screen.getByLabelText('Email');
    fireEvent.change(input, { target: { value: 'not-an-email' } });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // No debounced validation — stays quiet until blur.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    fireEvent.blur(input, { target: { value: 'not-an-email' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/valid email address/i);
  });

  it('clears a pending debounced run when the field is blurred first', () => {
    render(
      <FormField label="Email" validation={validators.email} debounceMs={300} />
    );

    const input = screen.getByLabelText('Email');
    fireEvent.change(input, { target: { value: 'a@b.com' } });
    // Blur before the debounce fires — blur validates immediately (valid → no error).
    fireEvent.blur(input, { target: { value: 'a@b.com' } });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
