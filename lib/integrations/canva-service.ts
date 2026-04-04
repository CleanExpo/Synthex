/**
 * Canva Integration Service
 *
 * @description Manages Canva Connect API interactions for design import and management.
 * Uses fetch() directly - no SDKs.
 *
 * API Reference: https://api.canva.com/rest/v1/
 */

import type {
  IntegrationCredentials,
  CanvaDesign,
  CanvaImportResult,
} from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

const CANVA_API_BASE = 'https://api.canva.com/rest/v1';

// ============================================================================
// SERVICE
// ============================================================================

export class CanvaService {
  private credentials: IntegrationCredentials;

  constructor(credentials: IntegrationCredentials) {
    this.credentials = credentials;
  }

  /**
   * Validate the current credentials by making a test API call
   */
  async validateCredentials(): Promise<{ valid: boolean; error?: string }> {
    try {
      const response = await fetch(`${CANVA_API_BASE}/users/me`, {
        headers: this.getHeaders(),
      });

      if (response.ok) {
        return { valid: true };
      }

      if (response.status === 401) {
        return { valid: false, error: 'Invalid or expired access token' };
      }

      return { valid: false, error: `Canva API returned status ${response.status}` };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Failed to connect to Canva',
      };
    }
  }

  /**
   * List designs from the user's Canva account
   */
  async listDesigns(limit: number = 20): Promise<CanvaDesign[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    const response = await fetch(`${CANVA_API_BASE}/designs?${params.toString()}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      await this.handleApiError(response, 'Failed to list designs');
    }

    const data = await response.json();
    const items = data.items || data.designs || [];

    return items.map((design: Record<string, unknown>) => ({
      id: design.id as string,
      title: (design.title as string) || 'Untitled',
      url: (design.url as string) || '',
      thumbnailUrl: ((design.thumbnail as Record<string, unknown>)?.url as string) || '',
      createdAt: (design.created_at as string) || new Date().toISOString(),
      updatedAt: (design.updated_at as string) || new Date().toISOString(),
    }));
  }

  /**
   * Import a design by exporting it to a usable format
   */
  async importDesign(designId: string): Promise<CanvaImportResult> {
    const response = await fetch(`${CANVA_API_BASE}/designs/${designId}/export`, {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        format: 'png',
      }),
    });

    if (!response.ok) {
      await this.handleApiError(response, 'Failed to export design');
    }

    const data = await response.json();

    return {
      designId,
      title: (data.title as string) || 'Untitled',
      exportUrl: (data.url as string) || (data.export_url as string) || '',
      format: 'png',
    };
  }

  /**
   * Get a direct URL to view/edit a design in Canva
   */
  async getDesignUrl(designId: string): Promise<string> {
    const response = await fetch(`${CANVA_API_BASE}/designs/${designId}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      await this.handleApiError(response, 'Failed to get design');
    }

    const data = await response.json();
    return (data.url as string) || `https://www.canva.com/design/${designId}`;
  }

  /**
   * Disconnect — cleans up any service-side state (no-op for Canva, token revocation is handled at the API route level)
   */
  async disconnect(): Promise<void> {
    // Canva OAuth tokens are revoked at the connection level
    // No additional cleanup needed on the service side
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.credentials.accessToken}`,
      Accept: 'application/json',
    };
  }

  private async handleApiError(response: Response, context: string): Promise<never> {
    let message = context;
    try {
      const errorData = await response.json();
      message = `${context}: ${errorData.message || errorData.error || response.statusText}`;
    } catch {
      message = `${context}: ${response.statusText}`;
    }
    throw new Error(message);
  }
}
