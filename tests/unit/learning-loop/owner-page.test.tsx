/**
 * Owner page: a failed or unreachable request never leaves the owner's actions locked.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import React from 'react';
import {
  act,
  render,
  screen,
  waitFor,
  fireEvent,
} from '@testing-library/react';

jest.mock('next/navigation', () => ({
  useSearchParams: () =>
    new URLSearchParams('experimentId=exp-white-rabbit-front-door'),
}));

import LearningLoopPage from '@/app/dashboard/learning-loop/page';

const loop = {
  viewerRole: 'owner',
  experiment: {
    record: {
      hypothesis: 'h',
      need: 'n',
      challenge: 'c',
      successMeasure: 's',
      stopConditions: [],
      owner: 'o',
      observationPeriod: 'p',
      approvalReference: 'a',
      scope: 'x',
      permissions: 'y',
    },
  },
  hypothesis: null,
  goalContract: { id: 'gc', approvedBy: 'owner' },
  cardEvents: { total: 0, byDataClass: { synthetic: 0, preview: 0, pilot: 0 } },
  outcomes: [],
  recommendations: [],
  decisions: [],
};

const fetchMock = jest.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

it('releases the lock when a snapshot request cannot reach the server', async () => {
  fetchMock
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => loop,
    } as unknown as Response)
    .mockRejectedValueOnce(new TypeError('network down'));
  render(<LearningLoopPage />);
  const snap = await screen.findByRole('button', { name: /snapshot outcome/i });
  fireEvent.click(snap);
  await screen.findByText(/did not reach the server/i);
  await waitFor(() => expect(snap).not.toBeDisabled());
});

it('shows a load failure instead of hanging when the server is unreachable', async () => {
  fetchMock.mockRejectedValueOnce(new TypeError('network down'));
  render(<LearningLoopPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    /could not reach/i
  );
});

it('serialises owner actions synchronously: a double click sends one request', async () => {
  let resolvePost: (v: unknown) => void = () => {};
  fetchMock
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => loop,
    } as unknown as Response)
    .mockImplementationOnce(
      () =>
        new Promise(
          r => (resolvePost = r as (v: unknown) => void)
        ) as Promise<Response>
    )
    .mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => loop,
    } as unknown as Response);
  render(<LearningLoopPage />);
  const snap = await screen.findByRole('button', { name: /snapshot outcome/i });
  // Both clicks land in the same tick, before React re-renders the disabled state.
  act(() => {
    snap.click();
    snap.click();
  });
  const posts = () =>
    fetchMock.mock.calls.filter(c => String(c[0]).includes('/observe')).length;
  expect(posts()).toBe(1);
  resolvePost({ ok: true, status: 201, json: async () => ({}) });
  await waitFor(() => expect(snap).not.toBeDisabled());
  expect(posts()).toBe(1);
});
