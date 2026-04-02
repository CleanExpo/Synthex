/**
 * Unit tests for createEdgeFunctionRunner -- SYN-626
 */

import { createEdgeFunctionRunner } from "../runner";
import { createClient } from "@supabase/supabase-js";

jest.mock("@supabase/supabase-js");
jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockInsert = jest.fn().mockResolvedValue({ error: null });
const mockFrom = jest.fn(() => ({ insert: mockInsert }));
(createClient as jest.Mock).mockReturnValue({ from: mockFrom });

beforeEach(() => {
  jest.clearAllMocks();
  mockInsert.mockResolvedValue({ error: null });
  mockFrom.mockReturnValue({ insert: mockInsert });
  (createClient as jest.Mock).mockReturnValue({ from: mockFrom });
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fake.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-key";
  delete process.env.PIPELINE_SLACK_WEBHOOK;
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

// ---------------------------------
// Status determination
// ---------------------------------

describe("status: failed", () => {
  it("marks failed when process() throws on all retries", async () => {
    const runner = createEdgeFunctionRunner<string, string>(
      "test-pipeline",
      async () => { throw new Error("boom"); },
      undefined,
      { maxRetries: 1, retryDelayMs: 0 }
    );
    const result = await runner.run([{ clientId: "c1", input: "data" }]);
    expect(result.status).toBe("failed");
    expect(result.clientsFailed).toBe(1);
    expect(result.clientsProcessed).toBe(0);
  });

  it("marks failed when all clients fail", async () => {
    const runner = createEdgeFunctionRunner<string, string>(
      "test-pipeline",
      async () => { throw new Error("always fails"); },
      undefined,
      { maxRetries: 1, retryDelayMs: 0 }
    );
    const result = await runner.run([
      { clientId: "c1", input: "a" },
      { clientId: "c2", input: "b" },
    ]);
    expect(result.status).toBe("failed");
    expect(result.clientsFailed).toBe(2);
  });
});

describe("status: partial", () => {
  it("marks partial when validateOutput() returns { valid: false }", async () => {
    const runner = createEdgeFunctionRunner<string, number>(
      "test-pipeline",
      async () => 150,
      (output) => ({
        valid: output >= 0 && output <= 100,
        metadata: { score: output },
      }),
      { maxRetries: 1, retryDelayMs: 0 }
    );
    const result = await runner.run([{ clientId: "c1", input: "data" }]);
    expect(result.status).toBe("partial");
  });

  it("marks partial when some clients fail", async () => {
    const runner = createEdgeFunctionRunner<string, string>(
      "test-pipeline",
      async (_input, clientId) => {
        if (clientId === "c2") throw new Error("c2 failed");
        return "ok";
      },
      undefined,
      { maxRetries: 1, retryDelayMs: 0 }
    );
    const result = await runner.run([
      { clientId: "c1", input: "a" },
      { clientId: "c2", input: "b" },
    ]);
    expect(result.status).toBe("partial");
    expect(result.clientsProcessed).toBe(1);
    expect(result.clientsFailed).toBe(1);
  });
});

describe("status: success", () => {
  it("marks success when all clients succeed and validateOutput passes", async () => {
    const runner = createEdgeFunctionRunner<string, number>(
      "test-pipeline",
      async () => 75,
      (output) => ({ valid: output >= 0 && output <= 100, metadata: { score: output } }),
      { maxRetries: 1, retryDelayMs: 0 }
    );
    const result = await runner.run([
      { clientId: "c1", input: "a" },
      { clientId: "c2", input: "b" },
    ]);
    expect(result.status).toBe("success");
    expect(result.clientsProcessed).toBe(2);
    expect(result.clientsFailed).toBe(0);
  });

  it("marks success with no validateOutput hook", async () => {
    const runner = createEdgeFunctionRunner<string, string>(
      "test-pipeline",
      async () => "done",
      undefined,
      { maxRetries: 1, retryDelayMs: 0 }
    );
    const result = await runner.run([{ clientId: "c1", input: "x" }]);
    expect(result.status).toBe("success");
  });

  it("returns empty success for zero inputs", async () => {
    const runner = createEdgeFunctionRunner<string, string>(
      "test-pipeline",
      async () => "done",
      undefined,
      { maxRetries: 1, retryDelayMs: 0 }
    );
    const result = await runner.run([]);
    expect(result.status).toBe("success");
    expect(result.clientsProcessed).toBe(0);
  });
});

// ---------------------------------
// Logging
// ---------------------------------

describe("edge_function_logs write", () => {
  it("writes one log row per run", async () => {
    const runner = createEdgeFunctionRunner<string, string>(
      "test-pipeline",
      async () => "ok",
      undefined,
      { maxRetries: 1, retryDelayMs: 0 }
    );
    await runner.run([{ clientId: "c1", input: "x" }]);
    expect(mockFrom).toHaveBeenCalledWith("edge_function_logs");
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const inserted = mockInsert.mock.calls[0][0];
    expect(inserted.function_name).toBe("test-pipeline");
    expect(inserted.status).toBe("success");
    expect(inserted.clients_processed).toBe(1);
    expect(inserted.clients_failed).toBe(0);
  });

  it("includes error_json when clients fail", async () => {
    const runner = createEdgeFunctionRunner<string, string>(
      "test-pipeline",
      async () => { throw new Error("oops"); },
      undefined,
      { maxRetries: 1, retryDelayMs: 0 }
    );
    await runner.run([{ clientId: "c1", input: "x" }]);
    const inserted = mockInsert.mock.calls[0][0];
    expect(inserted.error_json).not.toBeNull();
    expect(inserted.error_json[0].clientId).toBe("c1");
  });
});

// ---------------------------------
// Retry behaviour
// ---------------------------------

describe("retry", () => {
  it("retries up to maxRetries then records failure", async () => {
    let attempts = 0;
    const runner = createEdgeFunctionRunner<string, string>(
      "test-pipeline",
      async () => { attempts++; throw new Error("transient"); },
      undefined,
      { maxRetries: 3, retryDelayMs: 0 }
    );
    const result = await runner.run([{ clientId: "c1", input: "x" }]);
    expect(attempts).toBe(3);
    expect(result.status).toBe("failed");
  });

  it("succeeds on second attempt after transient failure", async () => {
    let attempts = 0;
    const runner = createEdgeFunctionRunner<string, string>(
      "test-pipeline",
      async () => {
        attempts++;
        if (attempts === 1) throw new Error("transient");
        return "recovered";
      },
      undefined,
      { maxRetries: 3, retryDelayMs: 0 }
    );
    const result = await runner.run([{ clientId: "c1", input: "x" }]);
    expect(attempts).toBe(2);
    expect(result.status).toBe("success");
    expect(result.clientsProcessed).toBe(1);
  });
});
