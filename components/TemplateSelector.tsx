'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  Sparkles, 
  TrendingUp, 
  Clock,
  ArrowRight,
  Star,
  Users,
  BookOpen,
  Megaphone,
  User
} from '@/components/icons';
import { 
  contentTemplates, 
  getTemplatesByCategory, 
  getMostPopularTemplates,
  searchTemplates,
  trackTemplateUsage,
  type ContentTemplate 
} from '@/lib/content-templates';
import { notify } from '@/lib/notifications';

interface TemplateSelectorProps {
  onSelectTemplate: (template: ContentTemplate) => void;
  platform?: string;
}

export function TemplateSelector({ onSelectTemplate, platform }: TemplateSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null);
  
  // Filter templates
  const filteredTemplates = searchQuery 
    ? searchTemplates(searchQuery)
    : selectedCategory === 'all' 
      ? contentTemplates
      : selectedCategory === 'popular'
      ? getMostPopularTemplates(10)
      : getTemplatesByCategory(selectedCategory as any);
  
  const categories = [
    { id: 'all', label: 'All Templates', icon: Sparkles },
    { id: 'popular', label: 'Most Popular', icon: TrendingUp },
    { id: 'marketing', label: 'Marketing', icon: Megaphone },
    { id: 'engagement', label: 'Engagement', icon: Users },
    { id: 'educational', label: 'Educational', icon: BookOpen },
    { id: 'promotional', label: 'Promotional', icon: Star },
    { id: 'personal', label: 'Personal Brand', icon: User },
  ];
  
  const handleSelectTemplate = (template: ContentTemplate) => {
    trackTemplateUsage(template.id);
    onSelectTemplate(template);
    notify.custom(`📝 Template loaded: ${template.name}`);
  };
  
  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
        />
      </div>
      
      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="grid grid-cols-7 bg-white/5">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <TabsTrigger
                key={category.id}
                value={category.id}
                className="flex items-center gap-2 data-[state=active]:bg-purple-500/20"
              >
                <Icon className="h-4 w-4" />
                <span className="hidden lg:inline">{category.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
      
      {/* Templates Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredTemplates.map((template) => (
          <Card
            key={template.id}
            variant="glass"
            className={`
              cursor-pointer transition-all duration-200
              hover:scale-[1.02] hover:border-purple-500/50
              ${hoveredTemplate === template.id ? 'ring-2 ring-purple-500' : ''}
            `}
            onMouseEnter={() => setHoveredTemplate(template.id)}
            onMouseLeave={() => setHoveredTemplate(null)}
            onClick={() => handleSelectTemplate(template)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{template.icon}</span>
                  <div>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription className="text-sm text-gray-400">
                      {template.description}
                    </CardDescription>
                  </div>
                </div>
                {hoveredTemplate === template.id && (
                  <ArrowRight className="h-5 w-5 text-purple-400 animate-pulse" />
                )}
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3">
              {/* Platforms */}
              <div className="flex flex-wrap gap-2">
                {template.platforms.map((p) => (
                  <Badge 
                    key={p} 
                    variant="secondary" 
                    className="bg-white/10 text-xs capitalize"
                  >
                    {p}
                  </Badge>
                ))}
              </div>
              
              {/* Preview */}
              <div className="text-sm text-gray-300 line-clamp-2">
                {template.structure.hook}
              </div>
              
              {/* Stats */}
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span>{template.popularity} uses</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>2 min</span>
                </div>
              </div>
              
              {/* Tips Preview */}
              {template.tips && template.tips.length > 0 && (
                <div className="pt-2 border-t border-white/10">
                  <p className="text-xs text-gray-400 italic">
                    💡 {template.tips[0]}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Empty State */}
      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No templates found</p>
            <p className="text-sm mt-2">Try adjusting your search or category filter</p>
          </div>
        </div>
      )}
      
      {/* Quick Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-white/10">
        <Button
          variant="ghost"
          className="text-gray-400"
          onClick={() => {
            setSearchQuery('');
            setSelectedCategory('all');
          }}
        >
          Clear Filters
        </Button>
        
        <Button
          variant="outline"
          className="bg-white/5 border-white/10"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Create Custom Template
        </Button>
      </div>
    </div>
  );
}

// Template Preview Modal
export function TemplatePreview({ template }: { template: ContentTemplate }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-4xl">{template.icon}</span>
        <div>
          <h3 className="text-xl font-semibold">{template.name}</h3>
          <p className="text-gray-400">{template.description}</p>
        </div>
      </div>
      
      <div className="space-y-3 p-4 bg-white/5 rounded-lg">
        <div>
          <p className="text-sm text-gray-400 mb-1">Hook:</p>
          <p className="text-white">{template.structure.hook}</p>
        </div>
        
        {template.structure.body && (
          <div>
            <p className="text-sm text-gray-400 mb-1">Body:</p>
            <p className="text-white whitespace-pre-wrap">{template.structure.body}</p>
          </div>
        )}
        
        {template.structure.cta && (
          <div>
            <p className="text-sm text-gray-400 mb-1">Call to Action:</p>
            <p className="text-white">{template.structure.cta}</p>
          </div>
        )}
        
        {template.structure.hashtags && (
          <div>
            <p className="text-sm text-gray-400 mb-1">Hashtags:</p>
            <div className="flex flex-wrap gap-2">
              {template.structure.hashtags.map((tag) => (
                <Badge key={tag} variant="secondary" className="bg-purple-500/20">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {template.tips && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-300">Pro Tips:</p>
          {template.tips.map((tip, index) => (
            <div key={index} className="flex items-start gap-2">
              <span className="text-purple-400">•</span>
              <p className="text-sm text-gray-400">{tip}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}