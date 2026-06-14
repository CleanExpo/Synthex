/**
 * defineRoute() — typed API-contract helper (Wave-2 / WS5).
 *
 * CLAUDE.md mandates Zod validation on every POST/PUT/PATCH/DELETE route and a
 * consistent JSON error shape. Today each route hand-rolls that boilerplate:
 *   const body = await request.json().catch(() => null);
 *   const parsed = schema.safeParse(body);
 *   if (!parsed.success) return NextResponse.json({ error, issues }, { status: 400 });
 * …and the exact error shape drifts route-to-route ({ issues } vs { details },
 * 400 vs 422, etc.). `defineRoute` standardises this ON TOP of the existing auth
 * wrappers (`withAuth` / `withOrg`) — it does NOT replace them.
 *
 * What it gives you:
 *   (a) optional Zod `body` / `query` schema → a single consistent 400 with
 *       `{ error, details }` on invalid input;
 *   (b) the existing auth/org context, unchanged (same 401/403 semantics);
 *   (c) a typed `(input, ctx)` handler — `input.body` / `input.query` are fully
 *       inferred from the schemas;
 *   (d) a centralized try/catch → consistent 500 `{ error }` shape.
 *
 * VALIDATION ORDERING (repo norm, preserved exactly):
 *   401 (no session) → 403 (no org) → 400 (bad input) → 2xx (handler).
 * Auth runs inside the underlying wrapper FIRST; body/query validation only runs
 * once auth has resolved a context, so an unauthenticated request with a bad body
 * still gets 401, never 400. This mirrors what the hand-rolled routes already do
 * (the `safeParse` lines sit *inside* the `withAuth(...)` callback).
 *
 * @task WS5
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/with-auth';
import { withOrg, type OrgContext } from '@/lib/auth/with-org';

/**
 * Consistent JSON error body for a failed Zod validation. `details` is the
 * field-level breakdown from `error.flatten().fieldErrors` so callers can map
 * errors back to form fields. Mirrors the most common existing shape
 * ({ error, details }) — see app/api/templates/route.ts, content/score.
 */
export interface RouteValidationErrorBody {
  error: string;
  details: ReturnType<z.ZodError['flatten']>['fieldErrors'];
}

/** Consistent JSON error body for an unhandled handler exception (500). */
export interface RouteServerErrorBody {
  error: string;
}

/** Default message used for the 400 returned on invalid body/query. */
export const VALIDATION_ERROR_MESSAGE = 'Validation failed';
/** Default message used for the centralized 500. */
export const SERVER_ERROR_MESSAGE = 'Internal server error';

/**
 * Validated, typed input handed to the route handler. Keys are present only
 * when the corresponding schema was supplied, and are typed as the schema's
 * inferred output.
 */
export interface RouteInput<TBody, TQuery> {
  body: TBody;
  query: TQuery;
}

/**
 * Options for {@link defineRoute}. Either or both schemas are optional; when
 * omitted, the matching `input` field is typed as `undefined`.
 */
export interface DefineRouteOptions<
  TBodySchema extends z.ZodTypeAny | undefined,
  TQuerySchema extends z.ZodTypeAny | undefined,
> {
  /** Zod schema for the JSON request body (POST/PUT/PATCH/DELETE). */
  body?: TBodySchema;
  /** Zod schema for the URL search params (parsed as a string record). */
  query?: TQuerySchema;
  /** Override the 400 error message. Defaults to {@link VALIDATION_ERROR_MESSAGE}. */
  validationMessage?: string;
  /** Override the 500 error message. Defaults to {@link SERVER_ERROR_MESSAGE}. */
  serverErrorMessage?: string;
  /**
   * Logger for the centralized 500 path. Defaults to no-op; pass `logger.error`
   * to keep the existing route logging behaviour.
   */
  onError?: (error: unknown) => void;
}

/** Infer the validated body type from an optional body schema. */
type InferBody<S> = S extends z.ZodTypeAny ? z.output<S> : undefined;
/** Infer the validated query type from an optional query schema. */
type InferQuery<S> = S extends z.ZodTypeAny ? z.output<S> : undefined;

/**
 * The handler you write. Receives the validated `input` and the full route
 * context: the raw `request` (so path params can still be extracted from the
 * URL) plus the resolved auth/org context spread in.
 */
export type DefineRouteHandler<TBodySchema, TQuerySchema, TCtx> = (
  input: RouteInput<InferBody<TBodySchema>, InferQuery<TQuerySchema>>,
  ctx: TCtx & { request: NextRequest }
) => Promise<NextResponse> | NextResponse;

/**
 * Read the JSON body, tolerating an empty/invalid body (returns `null`), exactly
 * like the hand-rolled `request.json().catch(() => null)` pattern.
 */
async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** Parse URL search params into a plain string record for query validation. */
function readQuery(request: NextRequest): Record<string, string> {
  const out: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

/**
 * Shared core: validate (body then query) and dispatch to the handler with a
 * centralized try/catch. Auth has already resolved by the time this runs, so
 * any 400 here is correctly ordered AFTER 401/403.
 */
async function runValidatedHandler<TBodySchema, TQuerySchema, TCtx>(
  request: NextRequest,
  ctx: TCtx,
  opts: {
    body?: z.ZodTypeAny;
    query?: z.ZodTypeAny;
    validationMessage: string;
    serverErrorMessage: string;
    onError?: (error: unknown) => void;
  },
  handler: DefineRouteHandler<TBodySchema, TQuerySchema, TCtx>
): Promise<NextResponse> {
  let body: unknown = undefined;
  let query: unknown = undefined;

  // 400 — body validation first, then query. Single consistent { error, details }.
  if (opts.body) {
    const raw = await readJsonBody(request);
    const parsed = opts.body.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: opts.validationMessage,
          details: parsed.error.flatten().fieldErrors,
        } satisfies RouteValidationErrorBody,
        { status: 400 }
      );
    }
    body = parsed.data;
  }

  if (opts.query) {
    const parsed = opts.query.safeParse(readQuery(request));
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: opts.validationMessage,
          details: parsed.error.flatten().fieldErrors,
        } satisfies RouteValidationErrorBody,
        { status: 400 }
      );
    }
    query = parsed.data;
  }

  // 2xx / domain errors — centralized 500 on unhandled throw.
  try {
    const input = { body, query } as RouteInput<
      InferBody<TBodySchema>,
      InferQuery<TQuerySchema>
    >;
    return await handler(input, { ...(ctx as object), request } as TCtx & {
      request: NextRequest;
    });
  } catch (error) {
    opts.onError?.(error);
    return NextResponse.json(
      { error: opts.serverErrorMessage } satisfies RouteServerErrorBody,
      { status: 500 }
    );
  }
}

/**
 * Define an org-scoped route on top of {@link withAuth} (full `AuthContext`:
 * `userId`, `clientId`, `role`). Drop-in for routes that currently do
 * `withAuth(async (request, { clientId }) => { … safeParse … })`.
 *
 * Ordering: 401 (no session) → 403 (no org) → 400 (bad input) → handler.
 *
 * @example
 * const createSchema = z.object({ name: z.string().min(1) });
 *
 * export const POST = defineRoute(
 *   { body: createSchema, onError: (e) => logger.error('agent create', e) },
 *   async ({ body }, { clientId, userId }) => {
 *     const agent = await prisma.agent.create({ data: { ...body, organizationId: clientId } });
 *     return NextResponse.json({ agent }, { status: 201 });
 *   }
 * );
 */
export function defineRoute<
  TBodySchema extends z.ZodTypeAny | undefined = undefined,
  TQuerySchema extends z.ZodTypeAny | undefined = undefined,
>(
  options: DefineRouteOptions<TBodySchema, TQuerySchema>,
  handler: DefineRouteHandler<TBodySchema, TQuerySchema, AuthContext>
): (request: NextRequest) => Promise<NextResponse> {
  const opts = {
    body: options.body,
    query: options.query,
    validationMessage: options.validationMessage ?? VALIDATION_ERROR_MESSAGE,
    serverErrorMessage: options.serverErrorMessage ?? SERVER_ERROR_MESSAGE,
    onError: options.onError,
  };

  // withAuth resolves 401/403 FIRST, then this runs (400 → handler).
  return withAuth(async (request, auth) =>
    runValidatedHandler<TBodySchema, TQuerySchema, AuthContext>(
      request,
      auth,
      opts,
      handler
    )
  );
}

/**
 * Define an org-scoped route on top of {@link withOrg} (`OrgContext`:
 * `userId`, `org.id`, `role`, `actingAsOwner`) — the helper the codebase is
 * converging on. Same validation/error semantics as {@link defineRoute}.
 *
 * @example
 * export const POST = defineOrgRoute(
 *   { body: schema },
 *   async ({ body }, { org }) => {
 *     await prisma.thing.create({ data: { ...body, organizationId: org.id } });
 *     return NextResponse.json({ ok: true });
 *   }
 * );
 */
export function defineOrgRoute<
  TBodySchema extends z.ZodTypeAny | undefined = undefined,
  TQuerySchema extends z.ZodTypeAny | undefined = undefined,
>(
  options: DefineRouteOptions<TBodySchema, TQuerySchema>,
  handler: DefineRouteHandler<TBodySchema, TQuerySchema, OrgContext>
): (request: NextRequest) => Promise<NextResponse> {
  const opts = {
    body: options.body,
    query: options.query,
    validationMessage: options.validationMessage ?? VALIDATION_ERROR_MESSAGE,
    serverErrorMessage: options.serverErrorMessage ?? SERVER_ERROR_MESSAGE,
    onError: options.onError,
  };

  return withOrg(async (request, ctx) =>
    runValidatedHandler<TBodySchema, TQuerySchema, OrgContext>(
      request,
      ctx,
      opts,
      handler
    )
  );
}
