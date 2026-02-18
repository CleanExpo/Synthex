/**
 * Schema Markup Manager Hook
 *
 * @description Provides schema markup management functionality.
 * - validateSchema: Validate a JSON-LD schema object against schema.org rules
 * - extractFromUrl: Extract existing schema markup from any URL
 * - loadTemplates: Fetch predefined schema templates by category
 * - generatePreview: Generate a SERP-like rich results preview
 *
 * Uses raw fetch + useState pattern (no SWR/TanStack Query).
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  SchemaValidationResult,
  SchemaExtractionResult,
  SchemaTemplate,
  RichPreviewResult,
} from '@/lib/seo/schema-markup-service';
import { generateRichPreview } from '@/lib/seo/schema-markup-service';

// ============================================================================
// RESPONSE TYPES
// ============================================================================

interface ValidateResponse {
  success: boolean;
  validation?: SchemaValidationResult;
  error?: string;
}

interface ExtractResponse {
  success: boolean;
  extraction?: SchemaExtractionResult;
  error?: string;
}

interface TemplatesResponse {
  success: boolean;
  templates?: SchemaTemplate[];
  error?: string;
}

// ============================================================================
// HOOK
// ============================================================================

export function useSchemaMarkup() {
  // Validation state
  const [validationResult, setValidationResult] = useState<SchemaValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Extraction state
  const [extractionResult, setExtractionResult] = useState<SchemaExtractionResult | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  // Templates state
  const [templates, setTemplates] = useState<SchemaTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  // Rich preview state
  const [richPreview, setRichPreview] = useState<RichPreviewResult | null>(null);

  const mountedRef = useRef(true);
  const validateControllerRef = useRef<AbortController | null>(null);
  const extractControllerRef = useRef<AbortController | null>(null);
  const templatesControllerRef = useRef<AbortController | null>(null);

  /**
   * Validate a JSON-LD schema object against schema.org rules.
   */
  const validateSchema = useCallback(async (schema: object): Promise<SchemaValidationResult | null> => {
    // Cancel any in-flight validation request
    if (validateControllerRef.current) {
      validateControllerRef.current.abort();
    }

    const controller = new AbortController();
    validateControllerRef.current = controller;

    if (!mountedRef.current) return null;
    setIsValidating(true);
    setValidationResult(null);

    try {
      const response = await fetch('/api/seo/schema-markup/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({ schema }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          (errorData as { error?: string }).error || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const data: ValidateResponse = await response.json();

      if (mountedRef.current && data.validation) {
        setValidationResult(data.validation);
      }

      return data.validation || null;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }
      console.warn('Schema validation failed:', err);
      return null;
    } finally {
      if (mountedRef.current) {
        setIsValidating(false);
      }
    }
  }, []);

  /**
   * Extract JSON-LD schema markup from a URL.
   */
  const extractFromUrl = useCallback(async (url: string): Promise<SchemaExtractionResult | null> => {
    // Cancel any in-flight extraction request
    if (extractControllerRef.current) {
      extractControllerRef.current.abort();
    }

    const controller = new AbortController();
    extractControllerRef.current = controller;

    if (!mountedRef.current) return null;
    setIsExtracting(true);
    setExtractionResult(null);

    try {
      const response = await fetch('/api/seo/schema-markup/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          (errorData as { error?: string }).error || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const data: ExtractResponse = await response.json();

      if (mountedRef.current && data.extraction) {
        setExtractionResult(data.extraction);
      }

      return data.extraction || null;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }
      console.warn('Schema extraction failed:', err);
      return null;
    } finally {
      if (mountedRef.current) {
        setIsExtracting(false);
      }
    }
  }, []);

  /**
   * Load predefined schema templates from the API.
   */
  const loadTemplates = useCallback(async (): Promise<void> => {
    // Cancel any in-flight templates request
    if (templatesControllerRef.current) {
      templatesControllerRef.current.abort();
    }

    const controller = new AbortController();
    templatesControllerRef.current = controller;

    if (!mountedRef.current) return;
    setIsLoadingTemplates(true);

    try {
      const response = await fetch('/api/seo/schema-markup/templates', {
        credentials: 'include',
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          (errorData as { error?: string }).error || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const data: TemplatesResponse = await response.json();

      if (mountedRef.current) {
        setTemplates(data.templates || []);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      // Silently fail for templates — not critical
      console.warn('Failed to load schema templates:', err);
    } finally {
      if (mountedRef.current) {
        setIsLoadingTemplates(false);
      }
    }
  }, []);

  /**
   * Generate a SERP-like rich results preview for the given schema.
   * Calls the service function client-side (no API call needed).
   */
  const generatePreview = useCallback((schema: object): RichPreviewResult => {
    const preview = generateRichPreview(schema as Record<string, unknown>);
    if (mountedRef.current) {
      setRichPreview(preview);
    }
    return preview;
  }, []);

  // Cleanup on unmount — abort all in-flight requests
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (validateControllerRef.current) validateControllerRef.current.abort();
      if (extractControllerRef.current) extractControllerRef.current.abort();
      if (templatesControllerRef.current) templatesControllerRef.current.abort();
    };
  }, []);

  return {
    // Validation
    validationResult,
    isValidating,
    validateSchema,

    // Extraction
    extractionResult,
    isExtracting,
    extractFromUrl,

    // Templates
    templates,
    isLoadingTemplates,
    loadTemplates,

    // Rich Preview
    richPreview,
    generatePreview,
  };
}
