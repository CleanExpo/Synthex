import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { readDefault } from '@/lib/rate-limit';
import { recordUnsubscribe } from '@/lib/email/suppression';
import { notProvisionedResponse } from '@/lib/api/not-provisioned';
import { logger } from '@/lib/logger';

const EmailSchema = z
  .string()
  .trim()
  .email({ message: 'Please enter a valid email address.' });

/**
 * /api/newsletter/unsubscribe — public, no auth (RFC 8058 forbids requiring
 * cookies or login). Rate-limited at readDefault (120 req/min).
 *
 * POST, either:
 *   - RFC 8058 one-click: `Content-Type: application/x-www-form-urlencoded`,
 *     body `List-Unsubscribe=One-Click`, address in the `?email=` query
 *     (the URL from the List-Unsubscribe header). An `email` form field is
 *     also accepted.
 *   - JSON `{ "email": "..." }` (newsletter forms).
 *   Answers 200 with no redirect once the unsubscribe is recorded in at least
 *   one store and no store write failed; 500 when a write failed; 503
 *   FEATURE_NOT_PROVISIONED when no store is available to record it. Never a
 *   success that recorded nothing.
 *
 * GET ?email=... renders a confirm page whose button POSTs the one-click body.
 * GET never unsubscribes, so mail-scanner prefetch cannot unsubscribe anyone.
 */
export async function POST(req: NextRequest) {
  return readDefault(req, async () => {
    const contentType = req.headers.get('content-type') ?? '';
    const queryEmail = req.nextUrl.searchParams.get('email');
    const isForm = contentType.includes('application/x-www-form-urlencoded');

    let candidate: unknown;
    let method: 'one-click' | 'form' | 'json';

    if (isForm) {
      const form = new URLSearchParams(await req.text());
      method =
        form.get('List-Unsubscribe') === 'One-Click' ? 'one-click' : 'form';
      candidate = form.get('email') ?? queryEmail;
    } else {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
      }
      method = 'json';
      candidate = (body as { email?: unknown } | null)?.email ?? queryEmail;
    }

    const parsed = EmailSchema.safeParse(candidate);
    if (!parsed.success) {
      return respond(isForm, 400, 'Please provide a valid email address.');
    }

    const result = await recordUnsubscribe(parsed.data, method);

    if (result.failed.length > 0) {
      logger.error('[newsletter] unsubscribe write failed', {
        failed: result.failed,
        recorded: result.recorded,
      });
      return respond(
        isForm,
        500,
        'We could not record your unsubscribe. Please try again.'
      );
    }

    if (result.recorded.length === 0) {
      logger.error(
        '[newsletter] unsubscribe not recorded: no store available',
        {
          method,
        }
      );
      if (isForm) {
        return htmlResponse(
          503,
          'Unsubscribe unavailable',
          'We could not record your unsubscribe right now. Please try again later.'
        );
      }
      return notProvisionedResponse(
        'Unsubscribe could not be recorded: no mailing-list store is configured and the address is not a Synthex user.'
      );
    }

    logger.info('[newsletter] unsubscribe recorded', {
      method,
      recorded: result.recorded,
    });
    if (isForm) {
      return htmlResponse(
        200,
        "You've been unsubscribed",
        'You will not receive any more marketing emails from Synthex at this address.'
      );
    }
    return NextResponse.json(
      { message: 'Unsubscribed successfully', recorded: result.recorded },
      { status: 200 }
    );
  });
}

export async function GET(req: NextRequest) {
  const parsed = EmailSchema.safeParse(req.nextUrl.searchParams.get('email'));
  if (!parsed.success) {
    return htmlResponse(
      400,
      'Unsubscribe link incomplete',
      'This unsubscribe link is missing a valid email address.'
    );
  }

  const action = `/api/newsletter/unsubscribe?email=${encodeURIComponent(parsed.data)}`;
  return htmlResponse(
    200,
    'Unsubscribe from Synthex emails',
    `Stop marketing emails to <strong>${escapeHtml(parsed.data)}</strong>?`,
    `<form method="post" action="${escapeHtml(action)}">
    <input type="hidden" name="List-Unsubscribe" value="One-Click">
    <button type="submit" style="padding:12px 24px;font-size:16px;cursor:pointer;">Unsubscribe</button>
  </form>`
  );
}

function respond(isForm: boolean, status: number, message: string) {
  if (isForm) return htmlResponse(status, 'Unsubscribe failed', message);
  return NextResponse.json({ error: message }, { status });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function htmlResponse(
  status: number,
  title: string,
  messageHtml: string,
  extraHtml = ''
): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;">
  <h1 style="font-size:24px;">${escapeHtml(title)}</h1>
  <p style="font-size:16px;">${messageHtml}</p>
  ${extraHtml}
</body>
</html>`;
  return new NextResponse(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
