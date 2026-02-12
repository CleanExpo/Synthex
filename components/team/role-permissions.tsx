'use client';

/**
 * Role Permissions Component
 * Guide showing permissions for each role
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Crown, Edit, Eye } from 'lucide-react';

export function RolePermissionsCard() {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <Shield className="mr-2 h-5 w-5" />
          Role Permissions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <Crown className="h-4 w-4 text-red-400" />
            <span className="text-sm font-medium text-red-400">Admin</span>
          </div>
          <ul className="text-xs text-slate-400 space-y-1 ml-6">
            <li>• Full system access</li>
            <li>• Manage team members</li>
            <li>• Billing and settings</li>
            <li>• All content permissions</li>
          </ul>
        </div>

        <div>
          <div className="flex items-center space-x-2 mb-2">
            <Edit className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium text-blue-400">Editor</span>
          </div>
          <ul className="text-xs text-slate-400 space-y-1 ml-6">
            <li>• Create and edit content</li>
            <li>• Schedule posts</li>
            <li>• Access analytics</li>
            <li>• Use AI features</li>
          </ul>
        </div>

        <div>
          <div className="flex items-center space-x-2 mb-2">
            <Eye className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-400">Viewer</span>
          </div>
          <ul className="text-xs text-slate-400 space-y-1 ml-6">
            <li>• View all content</li>
            <li>• Access reports</li>
            <li>• Export data</li>
            <li>• No edit permissions</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
