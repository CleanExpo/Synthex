'use client';

/**
 * Schema Preview Component
 * Displays generated schema with copy and validation
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check, CheckCircle, AlertTriangle, FileCode } from '@/components/icons';
import { useToast } from '@/hooks/use-toast';

interface SchemaPreviewProps {
  schema: object | null;
}

export function SchemaPreview({ schema }: SchemaPreviewProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!schema) return;

    const scriptTag = `<script type="application/ld+json">
${JSON.stringify(schema, null, 2)}
</script>`;

    await navigator.clipboard.writeText(scriptTag);
    setCopied(true);
    toast({ title: 'Copied to clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="bg-surface-base/80 backdrop-blur-xl border border-cyan-500/10">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-white">Generated Schema</CardTitle>
          <CardDescription>Ready-to-use JSON-LD markup</CardDescription>
        </div>
        {schema && (
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
        {schema ? (
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
                    schema,
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
  );
}
