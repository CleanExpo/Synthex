'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Plus,
  Award,
  Globe,
  Star,
  Eye,
  RefreshCw,
  Shield,
} from '@/components/icons';
import { GEOFeatureGate } from '@/components/geo/GEOFeatureGate';

interface AuthorProfile {
  id: number;
  name: string;
  slug: string;
  bio: string;
  expertiseAreas: string[];
  sameAsUrls: string[];
  eeatScore: number | null;
  createdAt: string;
  _count?: { articles: number; geoAnalyses: number };
}

export default function AuthorsPage() {
  const [authors, setAuthors] = useState<AuthorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newAuthor, setNewAuthor] = useState({ name: '', bio: '', expertiseAreas: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => { fetchAuthors(); }, []);

  const fetchAuthors = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/authors', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAuthors(data.authors || []);
      }
    } catch (err) {
      console.error('Failed to fetch authors:', err);
    } finally {
      setLoading(false);
    }
  };

  const createAuthor = async () => {
    if (!newAuthor.name || !newAuthor.bio || newAuthor.bio.length < 50) return;
    setCreating(true);
    try {
      const res = await fetch('/api/authors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newAuthor.name,
          bio: newAuthor.bio,
          expertiseAreas: newAuthor.expertiseAreas.split(',').map(s => s.trim()).filter(Boolean),
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setNewAuthor({ name: '', bio: '', expertiseAreas: '' });
        fetchAuthors();
      }
    } catch (err) {
      console.error('Failed to create author:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <GEOFeatureGate
      feature="Author Profiles"
      requiredPlan="professional"
      description="Create verified author identities with credentials, entity links, and Person schema for E-E-A-T compliance."
      benefits={[
        'Verified author profiles with credentials',
        'Cross-platform entity presence (sameAs links)',
        'Person + ProfilePage schema generation',
      ]}
    >
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="h-7 w-7 text-cyan-400" />
            Author Profiles
          </h1>
          <p className="text-gray-400 mt-1">Manage expert author identities for E-E-A-T compliance</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)} className="bg-cyan-600 hover:bg-cyan-700">
          <Plus className="h-4 w-4 mr-2" />
          New Author
        </Button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <Card className="bg-surface-base/80 border border-cyan-500/10">
          <CardContent className="p-6 space-y-4">
            <input
              value={newAuthor.name}
              onChange={(e) => setNewAuthor({ ...newAuthor, name: e.target.value })}
              placeholder="Author name"
              className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-4 py-2 text-sm placeholder:text-gray-500"
            />
            <textarea
              value={newAuthor.bio}
              onChange={(e) => setNewAuthor({ ...newAuthor, bio: e.target.value })}
              placeholder="Author bio (minimum 50 characters)"
              className="w-full h-24 bg-white/5 border border-white/10 text-white rounded-lg px-4 py-2 text-sm placeholder:text-gray-500 resize-y"
            />
            <input
              value={newAuthor.expertiseAreas}
              onChange={(e) => setNewAuthor({ ...newAuthor, expertiseAreas: e.target.value })}
              placeholder="Expertise areas (comma separated)"
              className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-4 py-2 text-sm placeholder:text-gray-500"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={createAuthor} disabled={creating || !newAuthor.name || newAuthor.bio.length < 50} className="bg-cyan-600 hover:bg-cyan-700">
                {creating ? 'Creating...' : 'Create Author'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Authors List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(i => (
            <Card key={i} className="bg-surface-base/80 border border-cyan-500/10">
              <CardContent className="p-6 animate-pulse space-y-3">
                <div className="h-6 bg-white/10 rounded w-1/3" />
                <div className="h-4 bg-white/10 rounded w-full" />
                <div className="h-4 bg-white/10 rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : authors.length === 0 ? (
        <Card className="bg-surface-base/80 border border-cyan-500/10">
          <CardContent className="p-12 text-center text-gray-400">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No author profiles yet</p>
            <p className="text-sm mt-1">Create author profiles to boost E-E-A-T signals</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {authors.map((author) => (
            <Card key={author.id} className="bg-surface-base/80 border border-cyan-500/10 hover:border-cyan-500/30 transition-all">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{author.name}</h3>
                    <p className="text-xs text-gray-500">/{author.slug}</p>
                  </div>
                  {author.eeatScore && (
                    <Badge className="bg-emerald-500/20 text-emerald-400">
                      <Shield className="h-3 w-3 mr-1" />
                      E-E-A-T: {author.eeatScore}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-gray-400 line-clamp-2 mb-3">{author.bio}</p>
                {author.expertiseAreas.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {author.expertiseAreas.slice(0, 4).map((area) => (
                      <Badge key={area} className="bg-white/5 text-gray-300 text-xs">{area}</Badge>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>{author.sameAsUrls.length} entity links</span>
                  <span>{author._count?.articles || 0} articles</span>
                  <span>{author._count?.geoAnalyses || 0} analyses</span>
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
