'use client';

/**
 * Security Tab Content
 * Security status and threat monitoring
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Globe } from '@/components/icons';
import type { SecurityMetrics } from './types';

interface SecurityTabProps {
  metrics: SecurityMetrics;
}

export function SecurityTab({ metrics }: SecurityTabProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Security Overview</CardTitle>
        <CardDescription>Threat detection and prevention status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-white/5 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <Shield className="w-5 h-5 text-green-400" />
                <Badge className="bg-green-400/20 text-green-400">Active</Badge>
              </div>
              <p className="text-sm text-gray-400">Firewall Status</p>
              <p className="text-lg font-bold text-white">Protected</p>
            </div>

            <div className="p-4 bg-white/5 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <Globe className="w-5 h-5 text-green-400" />
                <Badge className="bg-green-400/20 text-green-400">Valid</Badge>
              </div>
              <p className="text-sm text-gray-400">SSL Certificate</p>
              <p className="text-lg font-bold text-white">Expires in 89 days</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between py-2 border-b border-white/10">
              <span className="text-sm text-gray-400">Active Threats</span>
              <span className="text-sm font-bold text-green-400">{metrics.threats}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/10">
              <span className="text-sm text-gray-400">Blocked Attempts (24h)</span>
              <span className="text-sm font-bold text-yellow-400">{metrics.blockedAttempts}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/10">
              <span className="text-sm text-gray-400">Last Security Scan</span>
              <span className="text-sm font-bold text-white">{metrics.lastScan}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-sm text-gray-400">DDoS Protection</span>
              <span className="text-sm font-bold text-green-400">Enabled</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
