'use client';

/**
 * Schema Generator Page
 * Create JSON-LD structured data for rich search results
 */

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SEOFeatureGate } from '@/components/seo';
import { useToast } from '@/hooks/use-toast';
import { Code, ArrowLeft, Loader2, Sparkles } from '@/components/icons';
import {
  FAQItem,
  getFieldsForType,
  TypeSelector,
  SchemaFields,
  FAQEditor,
  SchemaPreview,
} from '@/components/seo/schema';

export default function SchemaGeneratorPage() {
  const { toast } = useToast();
  const [schemaType, setSchemaType] = useState<string>('Organization');
  const [formData, setFormData] = useState<Record<string, string | number>>({});
  const [faqItems, setFaqItems] = useState<FAQItem[]>([{ question: '', answer: '' }]);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedSchema, setGeneratedSchema] = useState<object | null>(null);

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
    setIsLoading(true);

    try {
      const data = schemaType === 'FAQ' ? { questions: faqItems } : formData;

      const response = await fetch('/api/seo/schema', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: schemaType,
          data,
          url: formData.url,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate schema');
      }

      setGeneratedSchema(result.schema);
      toast({
        title: 'Schema Generated',
        description: 'Your JSON-LD schema is ready to use',
      });
    } catch (error) {
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'Failed to generate schema',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fields = getFieldsForType(schemaType);

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
            Schema Generator
          </h1>
          <p className="text-gray-400 mt-1">
            Create JSON-LD structured data for rich search results
          </p>
        </div>
      </div>

      <SEOFeatureGate
        feature="Schema Generator"
        requiredPlan="professional"
        description="Generate and validate JSON-LD structured data for enhanced search visibility and rich snippets."
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
            <CardHeader>
              <CardTitle className="text-white">Schema Configuration</CardTitle>
              <CardDescription>Select a schema type and fill in the details</CardDescription>
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

              <Button
                onClick={handleGenerate}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25"
              >
                {isLoading ? (
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
            </CardContent>
          </Card>

          {/* Preview */}
          <SchemaPreview schema={generatedSchema} />
        </div>
      </SEOFeatureGate>
    </div>
  );
}
