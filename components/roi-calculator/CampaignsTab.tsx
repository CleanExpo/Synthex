'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { Campaign } from './types';
import { formatCurrency, getROIColor, getStatusColor } from './helpers';

interface CampaignsTabProps {
  campaigns: Campaign[];
}

export function CampaignsTab({ campaigns }: CampaignsTabProps) {
  return (
    <div className="space-y-4">
      {campaigns.map(campaign => (
        <Card key={campaign.id} variant="glass">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-white">{campaign.name}</h3>
                  <Badge variant="secondary">{campaign.platform}</Badge>
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(campaign.status)}`} />
                </div>
                <p className="text-xs text-gray-400">
                  {new Date(campaign.startDate).toLocaleDateString()} - {new Date(campaign.endDate).toLocaleDateString()}
                </p>
              </div>
              <Badge className={`${getROIColor(campaign.roi)}`}>
                {campaign.roi}% ROI
              </Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
              <div>
                <p className="text-xs text-gray-400">Budget</p>
                <p className="text-sm font-medium text-white">{formatCurrency(campaign.budget)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Spent</p>
                <p className="text-sm font-medium text-white">{formatCurrency(campaign.spent)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Impressions</p>
                <p className="text-sm font-medium text-white">{campaign.impressions.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Conversions</p>
                <p className="text-sm font-medium text-white">{campaign.conversions}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Revenue</p>
                <p className="text-sm font-medium text-white">{formatCurrency(campaign.revenue)}</p>
              </div>
            </div>

            {campaign.spent > 0 && (
              <Progress value={(campaign.spent / campaign.budget) * 100} className="h-2 mt-3" />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
