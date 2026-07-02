type RequestWithNextUrl = {
  nextUrl: {
    origin: string;
    hostname: string;
  };
};

function cleanBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, '');
}

function isLocalHost(hostname: string): boolean {
  return (
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  );
}

export function getOAuthBaseUrl(request: RequestWithNextUrl): string | null {
  const requestOrigin = cleanBaseUrl(request.nextUrl.origin);
  const configured = cleanBaseUrl(process.env.NEXT_PUBLIC_APP_URL);

  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.SYNTHEX_OAUTH_USE_REQUEST_ORIGIN === 'true' &&
    requestOrigin &&
    isLocalHost(request.nextUrl.hostname)
  ) {
    return requestOrigin;
  }

  if (configured) return configured;

  if (process.env.NODE_ENV !== 'production') {
    return requestOrigin ?? 'http://localhost:3008';
  }

  return null;
}

export function requireOAuthBaseUrl(request: RequestWithNextUrl): string {
  const baseUrl = getOAuthBaseUrl(request);
  if (!baseUrl) {
    throw new Error(
      'NEXT_PUBLIC_APP_URL must be configured for OAuth in production.'
    );
  }
  return baseUrl;
}
