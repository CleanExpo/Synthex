/**
 * The card never claims a choice was recorded when the server refused it.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import CardClient from '@/app/card/[slug]/CardClient';
import { WHITE_RABBIT_CARD } from '@/lib/cards/white-rabbit';

const fetchMock = jest.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  sessionStorage.clear();
});

function renderCard() {
  render(
    <CardClient
      slug="phill"
      profile={{ name: 'Phill', bio: null }}
      links={[]}
      card={WHITE_RABBIT_CARD}
      forcedVariant={null}
      issuedSession={{ id: '7d444840-9dc0-41b0-a6c4-5d1f4b0d8b3e', sig: 'sig' }}
    />
  );
}

it('says the choice was not recorded when the server refuses the event', async () => {
  fetchMock.mockResolvedValue({
    status: 429,
    ok: false,
  } as unknown as Response);
  renderCard();
  await waitFor(() =>
    expect(screen.getByTestId('recording')).toHaveTextContent(
      /was not recorded/i
    )
  );
});

it('says recording is working only after a 201', async () => {
  fetchMock.mockResolvedValue({ status: 201, ok: true } as unknown as Response);
  renderCard();
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  expect(screen.getByTestId('recording')).toHaveTextContent(
    /help improve this card/i
  );
});
