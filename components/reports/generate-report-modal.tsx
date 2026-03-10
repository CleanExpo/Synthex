'use client';

/**
 * Generate Report Modal Component
 * Modal for creating new reports
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from '@/components/icons';
import { reportTypes, formatOptions } from './reports-config';

interface GenerateReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportName: string;
  onReportNameChange: (name: string) => void;
  reportType: string;
  onReportTypeChange: (type: string) => void;
  reportFormat: string;
  onReportFormatChange: (format: string) => void;
  isGenerating: boolean;
  onGenerate: () => void;
}

export function GenerateReportModal({
  isOpen,
  onClose,
  reportName,
  onReportNameChange,
  reportType,
  onReportTypeChange,
  reportFormat,
  onReportFormatChange,
  isGenerating,
  onGenerate,
}: GenerateReportModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Generate New Report</CardTitle>
          <CardDescription>Choose report type and format</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Report Name
            </label>
            <input
              type="text"
              value={reportName}
              onChange={(e) => onReportNameChange(e.target.value)}
              placeholder="Enter report name..."
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Report Type
            </label>
            <div className="grid grid-cols-1 gap-2">
              {reportTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => onReportTypeChange(type.id)}
                  className={`p-3 rounded-lg text-left transition-colors ${
                    reportType === type.id
                      ? 'bg-cyan-500/20 border border-cyan-500'
                      : 'bg-white/5 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <type.icon className="w-5 h-5 text-cyan-400" />
                    <div>
                      <p className="font-medium text-white">{type.name}</p>
                      <p className="text-xs text-gray-400">{type.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Format
            </label>
            <div className="flex gap-2">
              {formatOptions.map((format) => (
                <Button
                  key={format}
                  variant={reportFormat === format ? 'default' : 'outline'}
                  onClick={() => onReportFormatChange(format)}
                >
                  {format.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="flex-1 gradient-primary text-white"
              onClick={onGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Generate
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
