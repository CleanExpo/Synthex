/**
 * Schema Markup Manager Hook
 *
 * @description Provides schema markup management functionality.
 * - validateSchema: Validate a JSON-LD schema object against schema.org rules
 * - extractFromUrl: Extract existing schema markup from any URL
 * - loadTemplates: Fetch predefined schema templates by category
 * - generatePreview: Generate a SERP-like rich results preview
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import useSWR from 'swr';
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
// FETCHER
// ============================================================================

async function fetchTemplates(url: string): Promise<SchemaTemplate[]> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      (errorData as { error?: string }).error ||
        `HTTP ${res.status}: ${res.statusText}`
    );
  }
  const data: TemplatesResponse = await res.json();
  return data.templates || [];
}

// ============================================================================
// HOOK
// ============================================================================

export function useSchemaMarkup() {
  // Validation state — on-demand POST
  const [validationResult, setValidationResult] =
    useState<SchemaValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Extraction state — on-demand POST
  const [extractionResult, setExtractionResult] =
    useState<SchemaExtractionResult | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  // Templates — lazy-loaded via SWR (key starts null, set on first loadTemplates call)
  const [templatesEnabled, setTemplatesEnabled] = useState(false);

  const {
    data: templates = [],
    isLoading: isLoadingTemplates,
    mutate: mutateTemplates,
  } = useSWR<SchemaTemplate[]>(
    templatesEnabled ? '/api/seo/schema-markup/templates' : null,
    fetchTemplates,
    { revalidateOnFocus: false }
  );

  // Rich preview state
  const [richPreview, setRichPreview] = useState<RichPreviewResult | null>(
    null
  );

  const validateControllerRef = useRef<AbortController | null>(null);
  const extractControllerRef = useRef<AbortController | null>(null);

  /**
   * Validate a JSON-LD schema object against schema.org rules.
   */
  const validateSchema = useCallback(
    async (schema: object): Promise<SchemaValidationResult | null> => {
      // Cancel any in-flight validation request
      if (validateControllerRef.current) {
        validateControllerRef.current.abort();
      }

      const controller = new AbortController();
      validateControllerRef.current = controller;

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
            (errorData as { error?: string }).error ||
              `HTTP ${response.status}: ${response.statusText}`
          );
        }

        const data: ValidateResponse = await response.json();

        if (data.validation) {
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
        setIsValidating(false);
      }
    },
    []
  );

  /**
   * Extract JSON-LD schema markup from a URL.
   */
  const extractFromUrl = useCallback(
    async (url: string): Promise<SchemaExtractionResult | null> => {
      // Cancel any in-flight extraction request
      if (extractControllerRef.current) {
        extractControllerRef.current.abort();
      }

      const controller = new AbortController();
      extractControllerRef.current = controller;

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
            (errorData as { error?: string }).error ||
              `HTTP ${response.status}: ${response.statusText}`
          );
        }

        const data: ExtractResponse = await response.json();

        if (data.extraction) {
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
        setIsExtracting(false);
      }
    },
    []
  );

  /**
   * Load predefined schema templates from the API.
   * Enables SWR fetching on first call; subsequent calls revalidate.
   */
  const loadTemplates = useCallback(async (): Promise<void> => {
    if (!templatesEnabled) {
      setTemplatesEnabled(true);
    } else {
      await mutateTemplates();
    }
  }, [templatesEnabled, mutateTemplates]);

  /**
   * Generate a SERP-like rich results preview for the given schema.
   * Calls the service function client-side (no API call needed).
   */
  const generatePreview = useCallback((schema: object): RichPreviewResult => {
    const preview = generateRichPreview(schema as Record<string, unknown>);
    setRichPreview(preview);
    return preview;
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
