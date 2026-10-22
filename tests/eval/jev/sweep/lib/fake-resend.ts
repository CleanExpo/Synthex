/**
 * The `resend` package as an in-memory boundary: an audience of contacts
 * (the only suppression store on main) and a recorder of every email sent.
 * State lives on globalThis so every jest.isolateModules copy shares it.
 * `mode`: 'ok' answers normally; 'error' makes every contacts (audience) call
 * return { error } the way the Resend SDK reports API failures.
 *
 * Use: jest.mock('resend', () => require('./lib/fake-resend').resendModule());
 */
export interface SentEmail {
  to: string[];
  subject?: string;
  headers: Record<string, string>;
}
export interface ResendState {
  contacts: Map<string, { email: string; unsubscribed: boolean }>;
  sent: SentEmail[];
  mode: 'ok' | 'error';
  calls: string[];
}

const g = globalThis as { __sweepResend?: ResendState };
export const resend: ResendState = (g.__sweepResend ??= {
  contacts: new Map(),
  sent: [],
  mode: 'ok',
  calls: [],
});

export function resetResend(mode: ResendState['mode'] = 'ok'): void {
  resend.contacts = new Map();
  resend.sent = [];
  resend.calls = [];
  resend.mode = mode;
}

const key = (e: unknown) => String(e ?? '').toLowerCase();
const apiError = () => ({
  data: null,
  error: { name: 'application_error', message: 'sweep: Resend unavailable' },
});

export function resendModule() {
  class Resend {
    contacts = {
      async create(a: { email: string; unsubscribed?: boolean }) {
        resend.calls.push('contacts.create');
        if (resend.mode === 'error') return apiError();
        if (resend.contacts.has(key(a.email)))
          return {
            data: null,
            error: {
              name: 'validation_error',
              message: 'Contact already exists',
            },
          };
        resend.contacts.set(key(a.email), {
          email: a.email,
          unsubscribed: Boolean(a.unsubscribed),
        });
        return { data: { id: `contact-${resend.contacts.size}` }, error: null };
      },
      async update(a: { email?: string; id?: string; unsubscribed?: boolean }) {
        resend.calls.push('contacts.update');
        if (resend.mode === 'error') return apiError();
        const c = resend.contacts.get(key(a.email));
        if (!c)
          return {
            data: null,
            error: { name: 'not_found', message: 'Contact not found' },
          };
        if (a.unsubscribed !== undefined) c.unsubscribed = a.unsubscribed;
        return { data: { id: 'contact' }, error: null };
      },
      async get(a: { email?: string; id?: string }) {
        resend.calls.push('contacts.get');
        if (resend.mode === 'error') return apiError();
        const c = resend.contacts.get(key(a.email ?? a.id));
        return c
          ? {
              data: { email: c.email, unsubscribed: c.unsubscribed },
              error: null,
            }
          : {
              data: null,
              error: { name: 'not_found', message: 'Contact not found' },
            };
      },
      async list() {
        resend.calls.push('contacts.list');
        if (resend.mode === 'error') return apiError();
        return { data: { data: [...resend.contacts.values()] }, error: null };
      },
      async remove() {
        resend.calls.push('contacts.remove');
        return resend.mode === 'error' ? apiError() : { data: {}, error: null };
      },
    };
    emails = {
      async send(a: {
        to: string | string[];
        subject?: string;
        headers?: Record<string, string>;
      }) {
        // Delivery always succeeds: 'error' models the audience (the
        // suppression store) being down, not the transport.
        resend.calls.push('emails.send');
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(a.headers ?? {}))
          headers[k.toLowerCase()] = String(v);
        resend.sent.push({
          to: (Array.isArray(a.to) ? a.to : [a.to]).map(String),
          subject: a.subject,
          headers,
        });
        return { data: { id: `email-${resend.sent.length}` }, error: null };
      },
    };
    batch = {
      send: async (list: Parameters<Resend['emails']['send']>[0][]) => {
        for (const a of list) await this.emails.send(a);
        return { data: {}, error: null };
      },
    };
    constructor(_key?: string) {}
  }
  return { __esModule: true, Resend, default: Resend };
}

export const sentTo = (email: string) =>
  resend.sent.filter(s => s.to.some(t => key(t) === key(email)));
