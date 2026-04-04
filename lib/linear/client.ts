import { LinearClient } from '@linear/sdk';

let _client: LinearClient | null = null;

export function getLinearClient(): LinearClient {
  if (!_client) {
    const apiKey = process.env.LINEAR_API_KEY;
    if (!apiKey) throw new Error('LINEAR_API_KEY is not set');
    _client = new LinearClient({ apiKey });
  }
  return _client;
}
