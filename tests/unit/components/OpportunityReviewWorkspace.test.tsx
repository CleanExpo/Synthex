import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { OpportunityReviewWorkspace } from '@/components/opportunity-review/OpportunityReviewWorkspace';
import {
  clearUseApiCache,
  getUseApiActiveOrg,
  setUseApiActiveOrg,
} from '@/hooks/use-api';

const proposal = {
  title: 'Customer repair tracking',
  targetProject: { name: 'Repair project', repository: 'example/repair' },
  targetBusiness: 'Repair business',
  customerProblemHypothesis: 'Customers need clearer repair progress updates.',
  sources: [
    {
      url: 'https://example.com/interview',
      capturedAt: '2026-10-07T00:00:00.000Z',
      publishedAt: '2026-10-06T00:00:00.000Z',
      claims: ['Customers ask for repair updates.'],
    },
  ],
  uniteEvidence: [
    {
      reference: 'Support interview 7',
      observation: 'Three customers requested updates.',
      capturedAt: '2026-10-07T00:00:00.000Z',
    },
  ],
  confidence: 0.4,
  assumptions: ['Customers can access a web page.'],
  uncertainties: ['Whether this reduces support calls.'],
  suggestedOwner: 'Service manager',
  kpi: {
    name: 'Update requests',
    unit: 'calls per week',
    baselineRequirement: 'Measure four weeks of incoming calls.',
  },
  successCriteria: 'Reduce update calls by 20% in a manual pilot.',
  stopCriteria: 'Stop if customers cannot use the page.',
  nextValidationStep: 'Interview five customers without spending.',
  spendBoundary: { currency: 'AUD', maxSpend: 0 },
  demandValidated: false,
  revenueValidated: false,
};

function record(state = 'pending', revision = 1) {
  return {
    id: 'proposal-1',
    revision,
    proposal,
    review: { state, note: '' },
    executionBlocked: true,
    approvalGate: 'production_blocked',
    scenarioState: 'blocked',
    status: state === 'rejected' ? 'blocked' : 'pending',
    createdAt: '2026-10-07T00:00:00.000Z',
    updatedAt: '2026-10-07T00:00:00.000Z',
  };
}

function response(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response;
}

let fetchMock: jest.Mock;
const originalUrlDescriptors = {
  createObjectURL: Object.getOwnPropertyDescriptor(URL, 'createObjectURL'),
  revokeObjectURL: Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL'),
};
beforeEach(() => {
  clearUseApiCache();
  setUseApiActiveOrg('org-review');
  fetchMock = jest.fn().mockResolvedValue(response({ items: [], total: 0 }));
  global.fetch = fetchMock;
});
afterEach(() => {
  clearUseApiCache();
  setUseApiActiveOrg(null);
  for (const [key, descriptor] of Object.entries(originalUrlDescriptors)) {
    if (descriptor) Object.defineProperty(URL, key, descriptor);
    else Reflect.deleteProperty(URL, key);
  }
});

function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillCapture() {
  change('Proposal title', proposal.title);
  change('Target business', proposal.targetBusiness);
  change('Project name', proposal.targetProject.name);
  change(
    'Repository reference (planning only)',
    proposal.targetProject.repository
  );
  change('Customer problem hypothesis', proposal.customerProblemHypothesis);
  change('Source 1 URL', proposal.sources[0].url);
  change('Source 1 captured date', '2026-10-07');
  change('Source 1 published date (optional)', '2026-10-06');
  change('Source 1 claims (one per line)', proposal.sources[0].claims[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Add Unite evidence' }));
  change('Unite evidence 1 reference', proposal.uniteEvidence[0].reference);
  change('Unite evidence 1 observation', proposal.uniteEvidence[0].observation);
  change('Unite evidence 1 captured date', '2026-10-07');
  change('Confidence (%) — operator estimate', '40');
  change('Assumptions (one per line)', proposal.assumptions[0]);
  change('Uncertainties (one per line)', proposal.uncertainties[0]);
  change('Suggested owner', proposal.suggestedOwner);
  change('KPI name', proposal.kpi.name);
  change('KPI unit', proposal.kpi.unit);
  change('Baseline requirement', proposal.kpi.baselineRequirement);
  change('Success criteria', proposal.successCriteria);
  change('Stop criteria', proposal.stopCriteria);
  change('Next validation step', proposal.nextValidationStep);
}

it('loads only the authenticated organisation list and shows an empty capture state', async () => {
  render(<OpportunityReviewWorkspace />);
  expect(screen.getByRole('status')).toHaveTextContent(/loading proposals/i);
  expect(
    await screen.findByText(/no proposals for the active organisation/i)
  ).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/opportunity-proposals',
    expect.objectContaining({ credentials: 'include' })
  );
  expect(
    screen.queryByRole('button', { name: /download/i })
  ).not.toBeInTheDocument();
});

it('surfaces an authenticated list error with a retry action', async () => {
  fetchMock.mockResolvedValue(
    response({ error: 'Sign in required' }, false, 401)
  );
  render(<OpportunityReviewWorkspace />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Sign in required'
  );
  fetchMock.mockResolvedValue(response({ items: [], total: 0 }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Retry loading proposals' })
  );
  expect(
    await screen.findByText(/no proposals for the active organisation/i)
  ).toBeInTheDocument();
});

it('captures a complete proposal and displays the saved record with server-owned boundaries', async () => {
  fetchMock.mockImplementation(async (_url, options) =>
    options?.method === 'POST'
      ? response({ item: record(), created: true })
      : response({ items: [], total: 0 })
  );
  render(<OpportunityReviewWorkspace />);
  await screen.findByText(/no proposals for the active organisation/i);
  fireEvent.click(screen.getByRole('button', { name: 'Capture proposal' }));
  fillCapture();
  fireEvent.click(screen.getByRole('button', { name: 'Save proposal' }));
  expect(
    await screen.findByRole('heading', { name: proposal.title })
  ).toBeInTheDocument();
  const [, options] = fetchMock.mock.calls.find(
    ([, opts]) => opts?.method === 'POST'
  )!;
  const body = JSON.parse(options.body);
  expect(body.clientRequestId).toMatch(/^[0-9a-f-]{36}$/);
  const {
    spendBoundary: _spend,
    demandValidated: _demand,
    revenueValidated: _revenue,
    ...input
  } = proposal;
  expect(body.proposal).toEqual(input);
  expect(screen.getByText(/AUD 0/i)).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: proposal.sources[0].url })
  ).toHaveAttribute('href', proposal.sources[0].url);
  expect(
    screen.queryByRole('button', { name: /download/i })
  ).not.toBeInTheDocument();
});

it('keeps capture input and retry identity after a save failure', async () => {
  fetchMock.mockImplementation(async (_url, options) =>
    options?.method === 'POST'
      ? response({ error: 'Save unavailable' }, false, 503)
      : response({ items: [], total: 0 })
  );
  render(<OpportunityReviewWorkspace />);
  await screen.findByText(/no proposals/i);
  fireEvent.click(screen.getByRole('button', { name: 'Capture proposal' }));
  fillCapture();
  fireEvent.click(screen.getByRole('button', { name: 'Save proposal' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Save unavailable'
  );
  expect(screen.getByLabelText('Proposal title')).toHaveValue(proposal.title);
  fireEvent.click(screen.getByRole('button', { name: 'Save proposal' }));
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.filter(([, opts]) => opts?.method === 'POST')
    ).toHaveLength(2)
  );
  const posts = fetchMock.mock.calls.filter(
    ([, opts]) => opts?.method === 'POST'
  );
  expect(JSON.parse(posts[0][1].body).clientRequestId).toBe(
    JSON.parse(posts[1][1].body).clientRequestId
  );
});

it('requests evidence, adds separate evidence, and requires explicit acceptance at the current revision', async () => {
  let current = record();
  const patches: Record<string, unknown>[] = [];
  fetchMock.mockImplementation(async (_url, options) => {
    if (options?.method === 'PATCH') {
      const body = JSON.parse(options.body);
      patches.push(body);
      current = record(
        body.action === 'request-evidence'
          ? 'evidence_requested'
          : body.action === 'accept'
            ? 'accepted'
            : 'pending',
        current.revision + 1
      );
      return response({ item: current });
    }
    return response({ items: [current], total: 1 });
  });
  render(<OpportunityReviewWorkspace />);
  await screen.findByRole('heading', { name: proposal.title });
  change('Review note', 'Need an additional interview.');
  fireEvent.click(screen.getByRole('button', { name: 'Request evidence' }));
  expect(await screen.findByText('Evidence requested')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Accept for blocked handoff' })
  ).toBeDisabled();
  change('Additional evidence reference', 'Customer interview 8');
  change(
    'Additional evidence observation',
    'Customer described delayed repair updates.'
  );
  change('Additional evidence captured date', '2026-10-07');
  change('Review note', 'Added another customer interview.');
  fireEvent.click(screen.getByRole('button', { name: 'Add evidence' }));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Accept for blocked handoff' })
    ).toBeEnabled()
  );
  expect(
    screen.queryByRole('button', { name: /download/i })
  ).not.toBeInTheDocument();
  change('Review note', 'Ready for forecasting review.');
  fireEvent.click(
    screen.getByRole('button', { name: 'Accept for blocked handoff' })
  );
  expect(
    await screen.findByRole('button', { name: 'Download Nexus v1 export' })
  ).toBeEnabled();
  expect(patches.map(patch => [patch.action, patch.expectedRevision])).toEqual([
    ['request-evidence', 1],
    ['add-evidence', 2],
    ['accept', 3],
  ]);
  expect(patches[1].uniteEvidence).toEqual([
    {
      reference: 'Customer interview 8',
      observation: 'Customer described delayed repair updates.',
      capturedAt: '2026-10-07T00:00:00.000Z',
    },
  ]);
  expect(screen.getByText(/blocked forecast handoff/i)).toBeInTheDocument();
});

it('shows a revision conflict without pretending the review succeeded', async () => {
  fetchMock.mockImplementation(async (_url, options) =>
    options?.method === 'PATCH'
      ? response(
          { error: 'Proposal changed; refresh before reviewing.' },
          false,
          409
        )
      : response({ items: [record()], total: 1 })
  );
  render(<OpportunityReviewWorkspace />);
  await screen.findByRole('heading', { name: proposal.title });
  change('Review note', 'Review complete.');
  fireEvent.click(
    screen.getByRole('button', { name: 'Accept for blocked handoff' })
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Proposal changed'
  );
  expect(
    screen.queryByRole('button', { name: /download/i })
  ).not.toBeInTheDocument();
});

it('makes rejected proposals terminal and disables acceptance without Unite evidence', async () => {
  fetchMock.mockResolvedValue(
    response({ items: [record('rejected')], total: 1 })
  );
  const view = render(<OpportunityReviewWorkspace />);
  await screen.findByRole('heading', { name: proposal.title });
  expect(
    screen.queryByRole('button', { name: 'Accept for blocked handoff' })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Add evidence' })
  ).not.toBeInTheDocument();
  view.unmount();
  clearUseApiCache();
  fetchMock.mockResolvedValue(
    response({
      items: [{ ...record(), proposal: { ...proposal, uniteEvidence: [] } }],
      total: 1,
    })
  );
  render(<OpportunityReviewWorkspace />);
  await screen.findByRole('heading', { name: proposal.title });
  expect(
    screen.getByRole('button', { name: 'Accept for blocked handoff' })
  ).toBeDisabled();
});

it('downloads only the authenticated backend export for an accepted record', async () => {
  const bundle = {
    version: 1,
    packetId: 'proposal-1',
    revision: 2,
    executionBlocked: true,
    review: { state: 'accepted' },
    proposal,
    opportunity: {
      name: proposal.title,
      stage: 'blocked_review',
      status: 'blocked_review',
      source: 'synthex',
      source_detail: 'Accepted proposal',
      next_action: proposal.nextValidationStep,
    },
  };
  fetchMock.mockImplementation(async url =>
    url.endsWith('/export')
      ? response(bundle)
      : response({ items: [record('accepted', 2)], total: 1 })
  );
  const createUrl = jest.fn().mockReturnValue('blob:export');
  const revokeUrl = jest.fn();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: createUrl,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: revokeUrl,
  });
  const click = jest
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {});
  render(<OpportunityReviewWorkspace />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Download Nexus v1 export' })
  );
  await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/opportunity-proposals/proposal-1/export',
    expect.objectContaining({ credentials: 'include', method: 'GET' })
  );
  expect(createUrl).toHaveBeenCalledWith(expect.any(Blob));
  expect(revokeUrl).toHaveBeenCalledWith('blob:export');
});

it('never displays a late response from the previous organisation after a business switch', async () => {
  let finishOld!: (value: Response) => void;
  const oldRequest = new Promise<Response>(resolve => {
    finishOld = resolve;
  });
  const newItem = {
    ...record(),
    id: 'proposal-other',
    proposal: { ...proposal, title: 'Current organisation proposal' },
  };
  fetchMock
    .mockResolvedValueOnce(response({ items: [record()], total: 1 }))
    .mockReturnValueOnce(oldRequest)
    .mockResolvedValue(response({ items: [newItem], total: 1 }));
  render(<OpportunityReviewWorkspace />);
  await screen.findByRole('heading', { name: proposal.title });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh proposals' }));
  act(() => setUseApiActiveOrg('org-other'));
  await screen.findByRole('heading', { name: 'Current organisation proposal' });
  await act(async () => {
    finishOld(response({ items: [record()], total: 1 }));
    await oldRequest;
  });
  expect(
    screen.queryByRole('heading', { name: proposal.title })
  ).not.toBeInTheDocument();
  expect(
    await screen.findByRole('heading', {
      name: 'Current organisation proposal',
    })
  ).toBeInTheDocument();
});

it('rejects a proposal through the current revision and removes all review actions', async () => {
  fetchMock.mockImplementation(async (_url, options) =>
    options?.method === 'PATCH'
      ? response({ item: record('rejected', 2) })
      : response({ items: [record()], total: 1 })
  );
  render(<OpportunityReviewWorkspace />);
  await screen.findByRole('heading', { name: proposal.title });
  change('Review note', 'Customer problem is unsupported.');
  fireEvent.click(screen.getByRole('button', { name: 'Reject proposal' }));
  expect(await screen.findByText('Rejected')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Reject proposal' })
  ).not.toBeInTheDocument();
  const [, options] = fetchMock.mock.calls.find(
    ([, opts]) => opts?.method === 'PATCH'
  )!;
  expect(JSON.parse(options.body)).toEqual({
    id: 'proposal-1',
    expectedRevision: 1,
    action: 'reject',
    note: 'Customer problem is unsupported.',
  });
});

it('refuses to download an export whose server boundaries are invalid', async () => {
  fetchMock.mockImplementation(async url =>
    url.endsWith('/export')
      ? response({ version: 1, executionBlocked: false })
      : response({ items: [record('accepted', 2)], total: 1 })
  );
  const click = jest
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {});
  render(<OpportunityReviewWorkspace />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Download Nexus v1 export' })
  );
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(click).not.toHaveBeenCalled();
});

it('does not merge previous-organisation rows when a current review resolves before scope recovery', async () => {
  let finishOld!: (value: Response) => void;
  let finishReview!: (value: Response) => void;
  const oldRequest = new Promise<Response>(resolve => {
    finishOld = resolve;
  });
  const reviewRequest = new Promise<Response>(resolve => {
    finishReview = resolve;
  });
  const recoveryRequest = new Promise<Response>(() => {});
  const newItem = {
    ...record(),
    id: 'proposal-other',
    proposal: { ...proposal, title: 'Current organisation proposal' },
  };
  let oldGets = 0;
  let recovering = false;
  fetchMock.mockImplementation((_url, options) => {
    if (options?.method === 'PATCH') return reviewRequest;
    if (getUseApiActiveOrg() === 'org-other')
      return recovering
        ? recoveryRequest
        : Promise.resolve(response({ items: [newItem], total: 1 }));
    return ++oldGets === 1
      ? Promise.resolve(response({ items: [record()], total: 1 }))
      : oldRequest;
  });
  render(<OpportunityReviewWorkspace />);
  await screen.findByRole('heading', { name: proposal.title });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh proposals' }));
  act(() => setUseApiActiveOrg('org-other'));
  await screen.findByRole('heading', { name: 'Current organisation proposal' });
  change('Review note', 'Ready for a blocked review.');
  fireEvent.click(
    screen.getByRole('button', { name: 'Accept for blocked handoff' })
  );
  recovering = true;
  await act(async () => {
    finishOld(response({ items: [record()], total: 1 }));
    await oldRequest;
  });
  await act(async () => {
    finishReview(
      response({
        item: {
          ...newItem,
          revision: 2,
          review: { state: 'accepted', note: 'Ready for a blocked review.' },
        },
      })
    );
    await reviewRequest;
  });
  expect(
    screen.queryByRole('button', { name: /Customer repair tracking/ })
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: 'Current organisation proposal' })
  ).toBeInTheDocument();
});
