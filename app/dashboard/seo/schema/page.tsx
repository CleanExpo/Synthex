'use client';

/**
 * Schema Markup Manager Page
 * Create, validate, extract, browse templates, and preview rich results for JSON-LD structured data.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SEOFeatureGate } from '@/components/seo';
import { useToast } from '@/hooks/use-toast';
import { useSchemaMarkup } from '@/hooks/useSchemaMarkup';
import {
  Code,
  ArrowLeft,
  Loader2,
  Sparkles,
  Search,
  Globe,
  Copy,
  Check,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Star,
  ExternalLink,
  FileCode,
  Layout,
} from '@/components/icons';
import {
  FAQItem,
  getFieldsForType,
  TypeSelector,
  SchemaFields,
  FAQEditor,
  SchemaPreview,
} from '@/components/seo/schema';

// ============================================================================
// TYPES
// ============================================================================

type ActiveTab = 'editor' | 'validator' | 'extractor' | 'templates' | 'serp';

type TemplateCategory = 'all' | 'business' | 'content' | 'commerce' | 'media' | 'navigation';

// ============================================================================
// SCORE BADGE
// ============================================================================

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? 'bg-green-500/20 text-green-400 border-green-500/30'
      : score >= 50
        ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
        : 'bg-red-500/20 text-red-400 border-red-500/30';

  return (
    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${color}`}>
      {score}/100
    </span>
  );
}

// ============================================================================
// STAR RATING
// ============================================================================

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${i < count ? 'text-yellow-400' : 'text-gray-600'}`}
        />
      ))}
    </div>
  );
}

// ============================================================================
// SERP PREVIEW RENDERER
// ============================================================================

function SERPPreviewCard({
  preview,
}: {
  preview: {
    type: string;
    previewType: string;
    previewData: Record<string, string | number | boolean | string[]>;
  };
}) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const { previewType, previewData } = preview;

  const googleTitle = (previewData.name as string) || (previewData.headline as string) || (previewData.title as string) || preview.type;
  const googleUrl = (previewData.url as string) || 'https://example.com/page';
  const googleDesc = (previewData.description as string) || '';

  if (previewType === 'faq') {
    const questions = Array.isArray(previewData.questions) ? (previewData.questions as string[]) : [];
    const answers = Array.isArray(previewData.answers) ? (previewData.answers as string[]) : [];

    return (
      <div className="bg-white text-black rounded-xl shadow-xl p-5 max-w-2xl">
        {/* Mock search result row */}
        <div className="mb-4 pb-4 border-b border-gray-200">
          <div className="text-xs text-gray-500 mb-1">{googleUrl}</div>
          <div className="text-blue-700 text-lg font-medium hover:underline cursor-pointer">
            {googleTitle || 'Your Page Title'}
          </div>
          <div className="text-sm text-gray-700 mt-1">{googleDesc}</div>
        </div>
        {/* FAQ dropdowns */}
        <div className="space-y-2">
          {questions.slice(0, 5).map((q, i) => (
            <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-800 hover:bg-gray-50"
              >
                <span>{q}</span>
                {expandedIndex === i ? (
                  <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                )}
              </button>
              {expandedIndex === i && answers[i] && (
                <div className="px-4 pb-3 text-sm text-gray-600 bg-gray-50">{answers[i]}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (previewType === 'product-card') {
    const price = previewData.price as string;
    const currency = (previewData.currency as string) || 'USD';
    const availability = previewData.availability as string;
    const rating = previewData.rating as number;
    const reviewCount = previewData.reviewCount as number;

    return (
      <div className="bg-white text-black rounded-xl shadow-xl p-5 max-w-2xl">
        <div className="text-xs text-gray-500 mb-1">{googleUrl}</div>
        <div className="text-blue-700 text-lg font-medium hover:underline cursor-pointer mb-2">
          {googleTitle}
        </div>
        {price && (
          <div className="text-green-700 font-semibold text-base">
            {currency} {price}
          </div>
        )}
        {availability && (
          <div className="text-sm text-gray-600 mt-1">
            {availability === 'InStock' ? (
              <span className="text-green-600">In Stock</span>
            ) : (
              <span className="text-red-600">{availability}</span>
            )}
          </div>
        )}
        {rating > 0 && (
          <div className="flex items-center gap-1 mt-2">
            <StarRating count={Math.round(rating)} />
            <span className="text-sm text-gray-600">
              {rating.toFixed(1)} ({reviewCount} reviews)
            </span>
          </div>
        )}
        {googleDesc && <p className="text-sm text-gray-700 mt-2">{googleDesc}</p>}
      </div>
    );
  }

  if (previewType === 'article') {
    const author = previewData.author as string;
    const datePublished = previewData.datePublished as string;
    const formattedDate = datePublished
      ? new Date(datePublished).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      : '';

    return (
      <div className="bg-white text-black rounded-xl shadow-xl p-5 max-w-2xl">
        <div className="text-xs text-gray-500 mb-1">{googleUrl}</div>
        <div className="text-blue-700 text-lg font-medium hover:underline cursor-pointer">{googleTitle}</div>
        {(formattedDate || author) && (
          <div className="text-xs text-gray-500 mt-1">
            {formattedDate && <span>{formattedDate}</span>}
            {formattedDate && author && <span> — </span>}
            {author && <span>{author}</span>}
          </div>
        )}
        {googleDesc && <p className="text-sm text-gray-700 mt-2 leading-relaxed">{googleDesc}</p>}
      </div>
    );
  }

  if (previewType === 'event') {
    const startDate = previewData.startDate as string;
    const location = previewData.location as string;
    const ticketPrice = previewData.ticketPrice as string;
    const ticketCurrency = (previewData.ticketCurrency as string) || 'USD';
    const formattedDate = startDate
      ? new Date(startDate).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '';

    return (
      <div className="bg-white text-black rounded-xl shadow-xl p-5 max-w-2xl">
        <div className="text-xs text-gray-500 mb-1">{googleUrl}</div>
        <div className="text-blue-700 text-lg font-medium hover:underline cursor-pointer">{googleTitle}</div>
        {formattedDate && (
          <div className="text-sm text-gray-700 mt-1 font-medium">{formattedDate}</div>
        )}
        {location && (
          <div className="text-sm text-gray-600 mt-0.5">{location}</div>
        )}
        {ticketPrice && (
          <div className="text-sm text-green-700 mt-1">
            Tickets from {ticketCurrency} {ticketPrice}
          </div>
        )}
      </div>
    );
  }

  // Generic / knowledge-panel / etc.
  return (
    <div className="bg-white text-black rounded-xl shadow-xl p-5 max-w-2xl">
      <div className="text-xs text-gray-500 mb-1">{googleUrl}</div>
      <div className="text-blue-700 text-lg font-medium hover:underline cursor-pointer">{googleTitle}</div>
      {googleDesc && <p className="text-sm text-gray-700 mt-2 leading-relaxed">{googleDesc}</p>}
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function SchemaMarkupManagerPage() {
  const { toast } = useToast();
  const hook = useSchemaMarkup();

  // Editor state
  const [schemaType, setSchemaType] = useState<string>('Organization');
  const [formData, setFormData] = useState<Record<string, string | number>>({});
  const [faqItems, setFaqItems] = useState<FAQItem[]>([{ question: '', answer: '' }]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSchema, setGeneratedSchema] = useState<object | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<ActiveTab>('editor');

  // Validator state
  const [validatorInput, setValidatorInput] = useState('');

  // Extractor state
  const [extractUrl, setExtractUrl] = useState('');
  const [expandedSchemaIndex, setExpandedSchemaIndex] = useState<number | null>(null);

  // Templates state
  const [templateCategory, setTemplateCategory] = useState<TemplateCategory>('all');

  // Copy state
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // ---- Editor handlers ----

  const handleFieldChange = (name: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddFaqItem = () => {
    setFaqItems((prev) => [...prev, { question: '', answer: '' }]);
  };

  const handleRemoveFaqItem = (index: number) => {
    setFaqItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFaqChange = (index: number, field: 'question' | 'answer', value: string) => {
    setFaqItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const data = schemaType === 'FAQ' ? { questions: faqItems } : formData;
      const response = await fetch('/api/seo/schema', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: schemaType, data, url: formData.url }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to generate schema');
      setGeneratedSchema(result.schema);
      toast({ title: 'Schema Generated', description: 'Your JSON-LD schema is ready to use' });
    } catch (error) {
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'Failed to generate schema',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleValidateGenerated = async () => {
    if (!generatedSchema) return;
    await hook.validateSchema(generatedSchema);
    toast({ title: 'Validation complete', description: 'Schema has been validated' });
  };

  // ---- Validator handlers ----

  const handleValidatorSubmit = async () => {
    try {
      const parsed = JSON.parse(validatorInput);
      await hook.validateSchema(parsed);
    } catch {
      toast({
        title: 'Invalid JSON',
        description: 'Please enter valid JSON-LD to validate',
        variant: 'destructive',
      });
    }
  };

  // ---- Extractor handlers ----

  const handleExtract = async () => {
    if (!extractUrl.trim()) return;
    await hook.extractFromUrl(extractUrl.trim());
    setExpandedSchemaIndex(null);
  };

  const handleCopyExtracted = async (json: object, index: number) => {
    await navigator.clipboard.writeText(JSON.stringify(json, null, 2));
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleEditExtracted = (schemaData: object) => {
    // Load into editor — set generatedSchema and switch tab
    setGeneratedSchema(schemaData);
    setActiveTab('editor');
    toast({ title: 'Schema loaded', description: 'Schema loaded into editor' });
  };

  // ---- Template handlers ----

  const handleLoadTemplates = async () => {
    if (hook.templates.length === 0) {
      await hook.loadTemplates();
    }
  };

  const handleUseTemplate = (fields: Record<string, unknown>) => {
    setGeneratedSchema(fields);
    setActiveTab('editor');
    toast({ title: 'Template loaded', description: 'Template loaded into editor' });
  };

  const handleTabChange = async (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === 'templates') {
      await handleLoadTemplates();
    }
    if (tab === 'serp' && generatedSchema) {
      hook.generatePreview(generatedSchema);
    }
  };

  const fields = getFieldsForType(schemaType);

  const filteredTemplates =
    templateCategory === 'all'
      ? hook.templates
      : hook.templates.filter((t) => t.category === templateCategory);

  const TABS: { id: ActiveTab; label: string }[] = [
    { id: 'editor', label: 'Editor' },
    { id: 'validator', label: 'Validator' },
    { id: 'extractor', label: 'Extractor' },
    { id: 'templates', label: 'Templates' },
    { id: 'serp', label: 'SERP Preview' },
  ];

  const TEMPLATE_CATEGORIES: { id: TemplateCategory; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'business', label: 'Business' },
    { id: 'content', label: 'Content' },
    { id: 'commerce', label: 'Commerce' },
    { id: 'media', label: 'Media' },
    { id: 'navigation', label: 'Navigation' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/seo">
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Code className="w-8 h-8 text-cyan-400" />
            Schema Markup Manager
          </h1>
          <p className="text-gray-400 mt-1">
            Create, validate, and manage JSON-LD structured data for rich search results
          </p>
        </div>
      </div>

      <SEOFeatureGate
        feature="Schema Markup Manager"
        requiredPlan="professional"
        description="Generate and validate JSON-LD structured data for enhanced search visibility and rich snippets."
      >
        {/* Tab Bar */}
        <div className="flex items-center gap-2 border-b border-cyan-500/10 pb-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 border-b-transparent'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ================================================================ */}
        {/* TAB 1: EDITOR                                                     */}
        {/* ================================================================ */}
        {activeTab === 'editor' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Form */}
            <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
              <CardHeader>
                <CardTitle className="text-white">Schema Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <TypeSelector value={schemaType} onChange={setSchemaType} />

                {schemaType === 'FAQ' ? (
                  <FAQEditor
                    items={faqItems}
                    onItemChange={handleFaqChange}
                    onAddItem={handleAddFaqItem}
                    onRemoveItem={handleRemoveFaqItem}
                  />
                ) : (
                  <SchemaFields
                    fields={fields}
                    formData={formData}
                    onFieldChange={handleFieldChange}
                  />
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="flex-1 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate Schema
                      </>
                    )}
                  </Button>
                  {generatedSchema && (
                    <Button
                      onClick={handleValidateGenerated}
                      disabled={hook.isValidating}
                      variant="outline"
                      className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                    >
                      {hook.isValidating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-1" />
                          Validate
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {/* Inline validation score badge */}
                {hook.validationResult && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-white/5">
                    <span className="text-sm text-gray-400">Validation score:</span>
                    <ScoreBadge score={hook.validationResult.score} />
                    {hook.validationResult.isValid ? (
                      <span className="text-xs text-green-400 ml-1">Valid</span>
                    ) : (
                      <span className="text-xs text-red-400 ml-1">
                        {hook.validationResult.errors.length} error(s)
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Preview */}
            <SchemaPreview schema={generatedSchema} />
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 2: VALIDATOR                                                  */}
        {/* ================================================================ */}
        {activeTab === 'validator' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input */}
            <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-cyan-400" />
                  Paste JSON-LD
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <textarea
                  value={validatorInput}
                  onChange={(e) => setValidatorInput(e.target.value)}
                  placeholder={'{\n  "@context": "https://schema.org",\n  "@type": "Organization",\n  "name": "Your Company"\n}'}
                  className="w-full h-72 px-4 py-3 rounded-lg bg-black/30 border border-cyan-500/20 text-gray-200 font-mono text-sm resize-none focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 placeholder-gray-600"
                />
                <Button
                  onClick={handleValidatorSubmit}
                  disabled={hook.isValidating || !validatorInput.trim()}
                  className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white"
                >
                  {hook.isValidating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Validate Schema
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Results */}
            <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Search className="w-5 h-5 text-cyan-400" />
                  Validation Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!hook.validationResult ? (
                  <div className="text-center py-12 text-gray-500">
                    <Check className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>Paste JSON-LD above and click Validate</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Score */}
                    <div className="flex items-center justify-between p-4 rounded-lg bg-white/5">
                      <span className="text-sm text-gray-400">Overall Score</span>
                      <div className="flex items-center gap-3">
                        <ScoreBadge score={hook.validationResult.score} />
                        {hook.validationResult.isValid ? (
                          <span className="text-sm text-green-400 font-medium">Valid</span>
                        ) : (
                          <span className="text-sm text-red-400 font-medium">Invalid</span>
                        )}
                      </div>
                    </div>

                    {/* Errors */}
                    {hook.validationResult.errors.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-red-400">
                          Errors ({hook.validationResult.errors.length})
                        </p>
                        {hook.validationResult.errors.map((err, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20"
                          >
                            <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm text-red-300 font-medium">{err.field}</p>
                              <p className="text-xs text-red-400/80">{err.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Warnings */}
                    {hook.validationResult.warnings.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-yellow-400">
                          Warnings ({hook.validationResult.warnings.length})
                        </p>
                        {hook.validationResult.warnings.map((warn, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20"
                          >
                            <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm text-yellow-300 font-medium">{warn.field}</p>
                              <p className="text-xs text-yellow-400/80">{warn.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* All good */}
                    {hook.validationResult.errors.length === 0 &&
                      hook.validationResult.warnings.length === 0 && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                          <Check className="w-4 h-4 text-green-400" />
                          <p className="text-sm text-green-400">
                            Schema is valid with no issues found.
                          </p>
                        </div>
                      )}

                    {/* Fix suggestions */}
                    {hook.validationResult.errors.length > 0 && (
                      <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
                        <p className="text-xs text-cyan-400 font-medium mb-1">Fix Issues</p>
                        <p className="text-xs text-gray-400">
                          Add the missing required fields highlighted above. Ensure all URLs use
                          valid https:// format and dates are in ISO 8601 format (e.g. 2024-01-15).
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 3: EXTRACTOR                                                  */}
        {/* ================================================================ */}
        {activeTab === 'extractor' && (
          <div className="space-y-6">
            {/* URL Input */}
            <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Globe className="w-5 h-5 text-cyan-400" />
                  Extract Schema from URL
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Input
                    value={extractUrl}
                    onChange={(e) => setExtractUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleExtract()}
                    placeholder="https://example.com/page"
                    className="flex-1 bg-black/30 border-cyan-500/20 text-white placeholder-gray-600 focus:border-cyan-500/50"
                  />
                  <Button
                    onClick={handleExtract}
                    disabled={hook.isExtracting || !extractUrl.trim()}
                    className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white"
                  >
                    {hook.isExtracting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Extracting...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Extract
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            {hook.extractionResult && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <p className="text-sm text-gray-400">
                    Found{' '}
                    <span className="text-white font-medium">
                      {hook.extractionResult.totalFound}
                    </span>{' '}
                    schema(s) at{' '}
                    <span className="text-cyan-400">{hook.extractionResult.url}</span>
                  </p>
                  {hook.extractionResult.isDemo && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-full">
                      Demo Data
                    </span>
                  )}
                </div>

                {hook.extractionResult.schemas.map((s, i) => (
                  <Card key={i} className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-0.5 text-xs font-semibold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-full">
                            {s.type}
                          </span>
                          <ScoreBadge score={s.validationResult.score} />
                          {s.isValid ? (
                            <span className="text-xs text-green-400">Valid</span>
                          ) : (
                            <span className="text-xs text-red-400">
                              {s.validationResult.errors.length} error(s)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCopyExtracted(s.data, i)}
                            className="text-gray-400 hover:text-white h-8"
                          >
                            {copiedIndex === i ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditExtracted(s.data)}
                            className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 h-8 text-xs"
                          >
                            Edit in Editor
                          </Button>
                          <button
                            onClick={() => setExpandedSchemaIndex(expandedSchemaIndex === i ? null : i)}
                            className="text-gray-400 hover:text-white"
                          >
                            {expandedSchemaIndex === i ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {expandedSchemaIndex === i && (
                        <pre className="mt-3 p-3 rounded-lg bg-black/40 text-xs text-gray-300 font-mono overflow-x-auto max-h-60 overflow-y-auto">
                          {JSON.stringify(s.data, null, 2)}
                        </pre>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {!hook.extractionResult && !hook.isExtracting && (
              <div className="text-center py-16 text-gray-500">
                <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Enter a URL above to extract its JSON-LD schema markup</p>
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 4: TEMPLATES                                                  */}
        {/* ================================================================ */}
        {activeTab === 'templates' && (
          <div className="space-y-6">
            {/* Category filter */}
            <div className="flex flex-wrap items-center gap-2">
              {TEMPLATE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setTemplateCategory(cat.id)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    templateCategory === cat.id
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'text-gray-400 hover:text-white bg-white/5 hover:bg-white/10'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {hook.isLoadingTemplates && (
              <div className="text-center py-16 text-gray-500">
                <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin opacity-50" />
                <p>Loading templates...</p>
              </div>
            )}

            {!hook.isLoadingTemplates && hook.templates.length === 0 && (
              <div className="text-center py-16 text-gray-500">
                <Layout className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No templates loaded yet</p>
                <Button
                  onClick={handleLoadTemplates}
                  className="mt-4 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30"
                >
                  Load Templates
                </Button>
              </div>
            )}

            {!hook.isLoadingTemplates && filteredTemplates.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTemplates.map((template) => (
                  <Card
                    key={template.id}
                    className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10 hover:border-cyan-500/30 transition-all duration-200"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <span className="px-2 py-0.5 text-xs font-semibold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-full">
                          {template.type}
                        </span>
                        <StarRating count={template.popularity} />
                      </div>
                      <h3 className="text-sm font-semibold text-white mb-1">{template.name}</h3>
                      <p className="text-xs text-gray-400 leading-relaxed mb-4">
                        {template.description}
                      </p>
                      <Button
                        size="sm"
                        onClick={() => handleUseTemplate(template.fields as Record<string, unknown>)}
                        className="w-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 text-xs"
                      >
                        Use Template
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 5: SERP PREVIEW                                               */}
        {/* ================================================================ */}
        {activeTab === 'serp' && (
          <div className="space-y-6">
            {!generatedSchema && !hook.richPreview ? (
              <div className="text-center py-20 text-gray-500">
                <Layout className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="mb-2">No schema to preview yet</p>
                <p className="text-sm">Generate or load a schema in the Editor tab first</p>
                <Button
                  onClick={() => setActiveTab('editor')}
                  className="mt-4 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30"
                >
                  Go to Editor
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-medium">Rich Results Preview</h3>
                    <p className="text-sm text-gray-400 mt-0.5">
                      How your schema may appear in Google Search results
                    </p>
                  </div>
                  {generatedSchema && (
                    <Button
                      onClick={() => hook.generatePreview(generatedSchema)}
                      variant="outline"
                      size="sm"
                      className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                    >
                      <Sparkles className="w-4 h-4 mr-1" />
                      Refresh Preview
                    </Button>
                  )}
                </div>

                {hook.richPreview ? (
                  <div className="space-y-4">
                    {/* Preview type badge */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">Preview type:</span>
                      <span className="px-2 py-0.5 text-xs font-semibold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-full capitalize">
                        {hook.richPreview.previewType.replace('-', ' ')}
                      </span>
                    </div>

                    {/* Google-like container */}
                    <div className="p-6 rounded-xl bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
                      <div className="flex items-center gap-2 mb-4">
                        <Search className="w-4 h-4 text-gray-500" />
                        <div className="flex-1 h-8 rounded-full bg-white/10 border border-white/20 flex items-center px-3">
                          <span className="text-sm text-gray-400">Google Search preview</span>
                        </div>
                      </div>
                      <SERPPreviewCard preview={hook.richPreview} />
                    </div>

                    <p className="text-xs text-gray-500 italic">
                      Note: Actual search appearance may vary. Rich results eligibility depends on
                      Google's indexing and schema quality.
                    </p>
                  </div>
                ) : (
                  generatedSchema && (
                    <div className="text-center py-12 text-gray-500">
                      <Button
                        onClick={() => hook.generatePreview(generatedSchema)}
                        className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate SERP Preview
                      </Button>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}
      </SEOFeatureGate>
    </div>
  );
}
