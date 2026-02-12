'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SEOFeatureGate } from '@/components/seo';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Code,
  ArrowLeft,
  Loader2,
  Copy,
  Check,
  FileCode,
  Building,
  Package,
  FileText,
  HelpCircle,
  ListOrdered,
  Calendar,
  Video,
  Star,
  Sparkles,
  CheckCircle,
  AlertTriangle,
} from '@/components/icons';

const SCHEMA_TYPES = [
  { value: 'Organization', label: 'Organization', icon: Building, description: 'Company or brand info' },
  { value: 'LocalBusiness', label: 'Local Business', icon: Building, description: 'Physical business location' },
  { value: 'Product', label: 'Product', icon: Package, description: 'Product listings with price' },
  { value: 'Article', label: 'Article', icon: FileText, description: 'News or blog articles' },
  { value: 'BlogPosting', label: 'Blog Post', icon: FileText, description: 'Blog content' },
  { value: 'FAQ', label: 'FAQ', icon: HelpCircle, description: 'Frequently asked questions' },
  { value: 'HowTo', label: 'How-To Guide', icon: ListOrdered, description: 'Step-by-step instructions' },
  { value: 'Event', label: 'Event', icon: Calendar, description: 'Events and happenings' },
  { value: 'VideoObject', label: 'Video', icon: Video, description: 'Video content' },
  { value: 'Review', label: 'Review', icon: Star, description: 'Product or service reviews' },
];

interface SchemaField {
  name: string;
  label: string;
  type: 'text' | 'url' | 'textarea' | 'number' | 'array';
  placeholder?: string;
  required?: boolean;
}

const SCHEMA_FIELDS: Record<string, SchemaField[]> = {
  Organization: [
    { name: 'name', label: 'Organization Name', type: 'text', required: true },
    { name: 'url', label: 'Website URL', type: 'url', required: true },
    { name: 'logo', label: 'Logo URL', type: 'url' },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'email', label: 'Contact Email', type: 'text' },
    { name: 'phone', label: 'Contact Phone', type: 'text' },
  ],
  Product: [
    { name: 'name', label: 'Product Name', type: 'text', required: true },
    { name: 'description', label: 'Description', type: 'textarea', required: true },
    { name: 'image', label: 'Image URL', type: 'url' },
    { name: 'sku', label: 'SKU', type: 'text' },
    { name: 'brand', label: 'Brand', type: 'text' },
    { name: 'price', label: 'Price', type: 'number', required: true },
    { name: 'currency', label: 'Currency', type: 'text', placeholder: 'USD' },
  ],
  Article: [
    { name: 'title', label: 'Article Title', type: 'text', required: true },
    { name: 'description', label: 'Description', type: 'textarea', required: true },
    { name: 'image', label: 'Featured Image URL', type: 'url' },
    { name: 'author', label: 'Author Name', type: 'text', required: true },
    { name: 'publishedDate', label: 'Published Date', type: 'text', placeholder: 'YYYY-MM-DD' },
    { name: 'publisher', label: 'Publisher Name', type: 'text' },
  ],
  FAQ: [
    { name: 'questions', label: 'Questions & Answers', type: 'array' },
  ],
};

export default function SchemaGeneratorPage() {
  const { toast } = useToast();
  const [schemaType, setSchemaType] = useState<string>('Organization');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [faqItems, setFaqItems] = useState([{ question: '', answer: '' }]);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedSchema, setGeneratedSchema] = useState<object | null>(null);
  const [copied, setCopied] = useState(false);

  const handleFieldChange = (name: string, value: string | string[] | number) => {
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

  const handleCopy = async () => {
    if (!generatedSchema) return;

    const scriptTag = `<script type="application/ld+json">
${JSON.stringify(generatedSchema, null, 2)}
</script>`;

    await navigator.clipboard.writeText(scriptTag);
    setCopied(true);
    toast({ title: 'Copied to clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };

  const fields = SCHEMA_FIELDS[schemaType] || SCHEMA_FIELDS.Organization;

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
              {/* Schema Type Selector */}
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">
                  Schema Type
                </label>
                <Select value={schemaType} onValueChange={setSchemaType}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="Select schema type" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0f172a] border-white/10">
                    {SCHEMA_TYPES.map((type) => (
                      <SelectItem
                        key={type.value}
                        value={type.value}
                        className="text-white hover:bg-white/5"
                      >
                        <div className="flex items-center gap-2">
                          <type.icon className="w-4 h-4 text-cyan-400" />
                          <span>{type.label}</span>
                          <span className="text-gray-500 text-xs">- {type.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Dynamic Fields */}
              {schemaType === 'FAQ' ? (
                <div className="space-y-4">
                  <label className="text-sm font-medium text-gray-300">Questions & Answers</label>
                  {faqItems.map((item, index) => (
                    <div key={index} className="space-y-2 p-4 bg-white/5 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">Q{index + 1}</span>
                        {faqItems.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFaqItem(index)}
                            className="text-red-400 hover:text-red-300"
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                      <Input
                        placeholder="Question"
                        value={item.question}
                        onChange={(e) => handleFaqChange(index, 'question', e.target.value)}
                        className="bg-white/5 border-white/10 text-white"
                      />
                      <Textarea
                        placeholder="Answer"
                        value={item.answer}
                        onChange={(e) => handleFaqChange(index, 'answer', e.target.value)}
                        className="bg-white/5 border-white/10 text-white min-h-[80px]"
                      />
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    onClick={handleAddFaqItem}
                    className="w-full border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                  >
                    Add Another Question
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {fields.map((field) => (
                    <div key={field.name}>
                      <label className="text-sm font-medium text-gray-300 mb-2 block">
                        {field.label}
                        {field.required && <span className="text-red-400 ml-1">*</span>}
                      </label>
                      {field.type === 'textarea' ? (
                        <Textarea
                          placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                          value={formData[field.name] || ''}
                          onChange={(e) => handleFieldChange(field.name, e.target.value)}
                          className="bg-white/5 border-white/10 text-white min-h-[80px]"
                        />
                      ) : (
                        <Input
                          type={field.type === 'number' ? 'number' : 'text'}
                          placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                          value={formData[field.name] || ''}
                          onChange={(e) =>
                            handleFieldChange(
                              field.name,
                              field.type === 'number' ? parseFloat(e.target.value) : e.target.value
                            )
                          }
                          className="bg-white/5 border-white/10 text-white"
                        />
                      )}
                    </div>
                  ))}
                </div>
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
          <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-white">Generated Schema</CardTitle>
                <CardDescription>Ready-to-use JSON-LD markup</CardDescription>
              </div>
              {generatedSchema && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {generatedSchema ? (
                <div className="space-y-4">
                  {/* Validation Status */}
                  <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="text-green-400 text-sm">Valid JSON-LD schema</span>
                  </div>

                  {/* Code Preview */}
                  <div className="relative">
                    <pre className="bg-black/30 p-4 rounded-lg overflow-auto max-h-[400px] text-sm">
                      <code className="text-cyan-300">
                        {`<script type="application/ld+json">\n${JSON.stringify(
                          generatedSchema,
                          null,
                          2
                        )}\n</script>`}
                      </code>
                    </pre>
                  </div>

                  {/* Recommendations */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-300">Recommendations</h4>
                    <div className="flex items-start gap-2 text-sm text-gray-400">
                      <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5" />
                      <span>Test with Google Rich Results Test before deploying</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-gray-400">
                      <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5" />
                      <span>Add this script tag to your page&apos;s &lt;head&gt; section</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16">
                  <FileCode className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No Schema Generated</h3>
                  <p className="text-gray-400 max-w-sm mx-auto">
                    Fill in the form on the left and click &quot;Generate Schema&quot; to create your
                    JSON-LD structured data.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SEOFeatureGate>
    </div>
  );
}
