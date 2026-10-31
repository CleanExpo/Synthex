/**
 * The organisation a model call is made for, carried through async calls.
 *
 * Code that runs model calls for an org (content generation, workflow steps)
 * runs them inside withPromptOrg(orgId, ...). Every provider checks each
 * request against that scope before it sends anything (guardScopedRequest),
 * so a portfolio brand's prompt is checked at the model boundary however it
 * was assembled. Calls made outside any scope are not checked here.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import prisma from '@/lib/prisma';
import { assertPromptClean } from '@/lib/marketing-calendar/prompt-guard';

interface PromptScope {
  orgId: string;
  slug?: Promise<string | null>;
}

const scope = new AsyncLocalStorage<PromptScope>();

/**
 * Scopes the rest of the calling async function (and everything it awaits)
 * to orgId, so every model call it makes is checked against that brand.
 * Call it at an org-carrying entry point before any model call. A missing
 * orgId leaves the current scope as it is.
 */
export function enterPromptOrg(orgId: string | null | undefined) {
  if (orgId) scope.enterWith({ orgId });
}

/** Runs fn with every model call inside it checked against orgId's brand. */
export function withPromptOrg<T>(orgId: string, fn: () => Promise<T>) {
  return scope.run({ orgId }, fn);
}

function slugFor(s: PromptScope) {
  s.slug ??= prisma.organization
    .findUnique({ where: { id: s.orgId }, select: { slug: true } })
    .then(org => org?.slug ?? null);
  return s.slug;
}

/** Message content as the model receives it, structured parts included. */
function contentText(content: unknown): string {
  return typeof content === 'string' ? content : JSON.stringify(content ?? '');
}

/** Throws ForbiddenPromptError when orgId is a portfolio brand and the text names its forbidden words. */
export async function assertOrgPromptClean(
  orgId: string,
  parts: Array<string | null | undefined>
) {
  const slug = await slugFor({ orgId });
  assertPromptClean(slug, parts);
}

/** Any text bound for a model, checked against the current scope's brand. */
export async function guardScopedText(...parts: unknown[]) {
  const s = scope.getStore();
  if (!s) return;
  assertPromptClean(await slugFor(s), parts.map(contentText));
}

/**
 * fetch for a direct model-API call: the request body is checked against
 * the current scope's brand before anything is sent.
 */
export async function modelFetch(
  input: string | URL | Request,
  init?: RequestInit
): Promise<Response> {
  await guardScopedText(typeof init?.body === 'string' ? init.body : '');
  return fetch(input, init);
}

/** Provider entry check: the whole request against the current scope's brand. */
export async function guardScopedRequest(request: {
  messages: Array<{ content: unknown }>;
  tools?: unknown;
}) {
  const s = scope.getStore();
  if (!s) return;
  assertPromptClean(await slugFor(s), [
    ...request.messages.map(m => contentText(m.content)),
    request.tools ? JSON.stringify(request.tools) : null,
  ]);
}
