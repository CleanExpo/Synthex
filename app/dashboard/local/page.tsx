'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Map,
  Plus,
  MapPin,
  Eye,
} from '@/components/icons';
import { GEOFeatureGate } from '@/components/geo/GEOFeatureGate';

interface CaseStudy {
  id: number;
  title: string;
  slug: string;
  suburb: string;
  city: string;
  state: string;
  postcode: string;
  summary: string;
  publishedAt: string | null;
  createdAt: string;
}

export default function LocalPage() {
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchCaseStudies(); }, []);

  const fetchCaseStudies = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/local/case-studies', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCaseStudies(data.caseStudies || []);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  return (
    <GEOFeatureGate
      feature="Local Case Studies"
      requiredPlan="professional"
      description="Build hyper-local case studies with NAP consistency, LocalBusiness schema, and original before/after visuals."
      benefits={[
        'Suburb-level case study content generation',
        'NAP consistency validation across directories',
        'LocalBusiness + Service schema markup',
      ]}
    >
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Map className="h-7 w-7 text-cyan-400" />
            Local Case Studies
          </h1>
          <p className="text-gray-400 mt-1">Hyper-local case studies with NAP consistency and location schema</p>
        </div>
        <Button className="bg-cyan-600 hover:bg-cyan-700">
          <Plus className="h-4 w-4 mr-2" />
          New Case Study
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(i => (
            <Card key={i} className="bg-[#0f172a]/80 border border-cyan-500/10">
              <CardContent className="p-6 animate-pulse space-y-3">
                <div className="h-6 bg-white/10 rounded w-2/3" />
                <div className="h-4 bg-white/10 rounded w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : caseStudies.length === 0 ? (
        <Card className="bg-[#0f172a]/80 border border-cyan-500/10">
          <CardContent className="p-12 text-center text-gray-400">
            <Map className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No case studies yet</p>
            <p className="text-sm mt-1">Create suburb-level case studies to boost local SEO</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {caseStudies.map((cs) => (
            <Card key={cs.id} className="bg-[#0f172a]/80 border border-cyan-500/10 hover:border-cyan-500/30 transition-all">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-white">{cs.title}</h3>
                  <Badge className={cs.publishedAt ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}>
                    {cs.publishedAt ? 'Published' : 'Draft'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                  <MapPin className="h-4 w-4 text-cyan-400" />
                  <span>{cs.suburb}, {cs.city}, {cs.state} {cs.postcode}</span>
                </div>
                <p className="text-sm text-gray-400 line-clamp-2">{cs.summary}</p>
                <div className="flex justify-end mt-3">
                  <Button variant="ghost" size="sm" className="text-cyan-400">
                    <Eye className="h-4 w-4 mr-1" /> View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
    </GEOFeatureGate>
  );
}
