/**
 * Unit tests for lib/sms/
 *
 * Covers:
 *  - Interface contract (Q3.2.4 H8 binding — sourceOfTruthJobId required)
 *  - Twilio adapter config validation
 *  - Twilio adapter happy path (mocked fetch)
 *  - Twilio adapter error path (4xx + 5xx + thrown fetch)
 *  - PII-redaction (raw phone never appears in logs)
 *  - Factory + env-config reader
 *  - No-op provider for CI / local dev
 *
 * @see SYN-833 (parent: SYN-822 AEO epic)
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  TwilioProvider,
  buildSmsProvider,
  readSmsConfigFromEnv,
  getSmsProvider,
  _resetSmsProviderForTests,
} from '@/lib/sms';
import type { SmsMessage, SmsProviderConfig } from '@/lib/sms/types';

// Capture log calls so we can assert PII redaction
const logCalls: Array<{ level: string; payload: unknown }> = [];
jest.mock('@/lib/logger', () => ({
  logger: {
    info: (msg: string, payload: unknown) =>
      logCalls.push({ level: `info:${msg}`, payload }),
    warn: (msg: string, payload: unknown) =>
      logCalls.push({ level: `warn:${msg}`, payload }),
    error: (msg: string, payload: unknown) =>
      logCalls.push({ level: `error:${msg}`, payload }),
    debug: (msg: string, payload: unknown) =>
      logCalls.push({ level: `debug:${msg}`, payload }),
  },
}));

const validConfig: SmsProviderConfig = {
  provider: 'twilio',
  twilio: {
    accountSid: 'AC' + 'a'.repeat(32),
    authToken: 'b'.repeat(32),
    fromNumber: '+61400000000',
  },
};

const validMessage: SmsMessage = {
  to: '+61411222333',
  body: 'Test SMS body',
  sourceOfTruthJobId: 'dr_job_2026_04_29_0001',
  brand: 'DR',
};

describe('lib/sms — TwilioProvider config validation', () => {
  it('throws when twilio config block missing', () => {
    expect(() => new TwilioProvider({ provider: 'twilio' })).toThrow(
      /config\.twilio block missing/
    );
  });

  it('throws when accountSid is missing or malformed', () => {
    expect(
      () =>
        new TwilioProvider({
          provider: 'twilio',
          twilio: { ...validConfig.twilio!, accountSid: 'WRONG' },
        })
    ).toThrow(/accountSid/);
  });

  it('throws when authToken is too short', () => {
    expect(
      () =>
        new TwilioProvider({
          provider: 'twilio',
          twilio: { ...validConfig.twilio!, authToken: 'short' },
        })
    ).toThrow(/authToken/);
  });

  it('throws when fromNumber is not E.164', () => {
    expect(
      () =>
        new TwilioProvider({
          provider: 'twilio',
          twilio: { ...validConfig.twilio!, fromNumber: '0400000000' },
        })
    ).toThrow(/fromNumber/);
  });

  it('constructs successfully with valid config', () => {
    const p = new TwilioProvider(validConfig);
    expect(p.name).toBe('twilio');
  });
});

describe('lib/sms — TwilioProvider.send contract', () => {
  let provider: TwilioProvider;
  beforeEach(() => {
    logCalls.length = 0;
    provider = new TwilioProvider(validConfig);
  });

  it('throws when sourceOfTruthJobId omitted (Q3.2.4 H8 binding)', async () => {
    const bad = { ...validMessage, sourceOfTruthJobId: '' };
    await expect(provider.send(bad)).rejects.toThrow(/sourceOfTruthJobId/);
  });

  it('throws when `to` is not E.164', async () => {
    await expect(
      provider.send({ ...validMessage, to: '0411222333' })
    ).rejects.toThrow(/E\.164/);
  });

  it('throws when body is empty', async () => {
    await expect(provider.send({ ...validMessage, body: '' })).rejects.toThrow(
      /body/
    );
  });

  it('happy path: returns ok=true with providerMessageId on Twilio 2xx', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ sid: 'SMtest123', status: 'queued' }),
    } as Response);
    (global as unknown as { fetch: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;

    const result = await provider.send(validMessage);
    expect(result.ok).toBe(true);
    expect(result.providerMessageId).toBe('SMtest123');
    expect(result.status).toBe('queued');
    expect(result.httpStatus).toBe(201);
    expect(result.sourceOfTruthJobId).toBe(validMessage.sourceOfTruthJobId);
  });

  it('error path: returns ok=false on Twilio 4xx', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        message: 'Invalid To number',
        code: 21211,
        status: 'failed',
      }),
    } as Response);
    (global as unknown as { fetch: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;

    const result = await provider.send(validMessage);
    expect(result.ok).toBe(false);
    expect(result.providerMessageId).toBeNull();
    expect(result.error).toMatch(/Invalid To number/);
    expect(result.sourceOfTruthJobId).toBe(validMessage.sourceOfTruthJobId);
  });

  it('error path: catches thrown fetch (network error)', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    (global as unknown as { fetch: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;

    const result = await provider.send(validMessage);
    expect(result.ok).toBe(false);
    expect(result.status).toBe('error');
    expect(result.error).toMatch(/ECONNREFUSED/);
  });
});

describe('lib/sms — PII redaction in logs (P10 binding)', () => {
  beforeEach(() => {
    logCalls.length = 0;
  });

  it('never logs the raw phone number on success', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ sid: 'SMtest123', status: 'queued' }),
    } as Response);
    (global as unknown as { fetch: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;

    const provider = new TwilioProvider(validConfig);
    await provider.send(validMessage);

    const allLogged = JSON.stringify(logCalls);
    expect(allLogged).not.toContain('+61411222333');
    expect(allLogged).not.toContain(validMessage.body);
    // recipientHash IS logged (acceptable per design)
    expect(allLogged).toContain('recipientHash');
  });

  it('never logs the raw phone number on failure', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: 'fail', code: 21211 }),
    } as Response);
    (global as unknown as { fetch: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;

    const provider = new TwilioProvider(validConfig);
    await provider.send(validMessage);

    const allLogged = JSON.stringify(logCalls);
    expect(allLogged).not.toContain('+61411222333');
    expect(allLogged).not.toContain(validMessage.body);
  });
});

describe('lib/sms — factory + env config', () => {
  beforeEach(() => {
    _resetSmsProviderForTests();
    delete process.env.SMS_PROVIDER;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
  });

  it('readSmsConfigFromEnv defaults to noop when SMS_PROVIDER unset', () => {
    expect(readSmsConfigFromEnv().provider).toBe('noop');
  });

  it('readSmsConfigFromEnv builds twilio config when env vars present', () => {
    process.env.SMS_PROVIDER = 'twilio';
    process.env.TWILIO_ACCOUNT_SID = 'AC' + 'x'.repeat(32);
    process.env.TWILIO_AUTH_TOKEN = 'y'.repeat(32);
    process.env.TWILIO_FROM_NUMBER = '+61400000000';
    const cfg = readSmsConfigFromEnv();
    expect(cfg.provider).toBe('twilio');
    expect(cfg.twilio?.accountSid).toMatch(/^AC/);
  });

  it('buildSmsProvider returns NoopProvider for noop config', () => {
    const p = buildSmsProvider({ provider: 'noop' });
    expect(p.name).toBe('noop');
  });

  it('buildSmsProvider returns TwilioProvider for twilio config', () => {
    const p = buildSmsProvider(validConfig);
    expect(p.name).toBe('twilio');
  });

  it('getSmsProvider returns a singleton', () => {
    const a = getSmsProvider();
    const b = getSmsProvider();
    expect(a).toBe(b);
  });
});

describe('lib/sms — NoopProvider', () => {
  beforeEach(() => {
    _resetSmsProviderForTests();
    delete process.env.SMS_PROVIDER;
  });

  it('throws if sourceOfTruthJobId omitted (Q3.2.4 H8 still binding on noop)', async () => {
    const provider = buildSmsProvider({ provider: 'noop' });
    await expect(
      provider.send({ ...validMessage, sourceOfTruthJobId: '' })
    ).rejects.toThrow(/sourceOfTruthJobId/);
  });

  it('returns fake success with sourceOfTruthJobId echoed back', async () => {
    const provider = buildSmsProvider({ provider: 'noop' });
    const result = await provider.send(validMessage);
    expect(result.ok).toBe(true);
    expect(result.sourceOfTruthJobId).toBe(validMessage.sourceOfTruthJobId);
    expect(result.providerMessageId).toMatch(/^noop-/);
  });
});
