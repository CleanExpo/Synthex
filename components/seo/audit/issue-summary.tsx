'use client';

/**
 * Issue Summary Component
 * Grid showing counts of issues by severity
 */

import { XCircle, AlertTriangle, Info, CheckCircle } from '@/components/icons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface IssueSummaryProps {
  issues: {
    critical: number;
    major: number;
    minor: number;
    info: number;
  };
  crawledPages: number;
}

export function IssueSummary({ issues, crawledPages }: IssueSummaryProps) {
  return (
    <Card className="bg-surface-base/80 backdrop-blur-xl border border-cyan-500/10 lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-white">Issues Found</CardTitle>
        <CardDescription>Across {crawledPages} pages analyzed</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
          <XCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-red-400">{issues.critical}</p>
          <p className="text-sm text-gray-400">Critical</p>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 text-center">
          <AlertTriangle className="w-6 h-6 text-orange-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-orange-400">{issues.major}</p>
          <p className="text-sm text-gray-400">Major</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-center">
          <Info className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-yellow-400">{issues.minor}</p>
          <p className="text-sm text-gray-400">Minor</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-center">
          <CheckCircle className="w-6 h-6 text-blue-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-blue-400">{issues.info}</p>
          <p className="text-sm text-gray-400">Info</p>
        </div>
      </CardContent>
    </Card>
  );
}
