import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Users, TrendingUp, Sparkles, Zap, Brain, Target, BarChart, Shield } from '@/components/icons';

const meta = {
  title: 'UI/Card',
  component: Card,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A card container with header, content, and footer sections. Includes premium glassmorphism variants.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'glass',
        'glass-solid',
        'glass-gradient',
        'glass-primary',
        'glass-secondary',
        'interactive',
        'glass-interactive',
      ],
      description: 'The visual style variant of the card',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description goes here.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This is the card content area where you can put any content.</p>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline">Cancel</Button>
        <Button>Save</Button>
      </CardFooter>
    </Card>
  ),
};

export const WithoutFooter: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Simple Card</CardTitle>
        <CardDescription>A card without a footer section.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This card only has a header and content section. The footer has been omitted for a cleaner look when actions aren't needed.</p>
      </CardContent>
    </Card>
  ),
};

export const CampaignCard: Story = {
  render: () => (
    <Card className="w-[380px]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Summer Sale Campaign</CardTitle>
            <CardDescription>Social media advertising</CardDescription>
          </div>
          <Badge variant="secondary">Active</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Jun 1 - Jul 31</span>
          </div>
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">12.5K reached</span>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Budget spent</span>
            <span>$2,450 / $3,000</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div className="bg-primary h-2 rounded-full" style={{ width: '82%' }}></div>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full">View Details</Button>
      </CardFooter>
    </Card>
  ),
  parameters: {
    docs: {
      description: {
        story: 'A campaign card showing campaign details, progress, and actions.',
      },
    },
  },
};

export const UserCard: Story = {
  render: () => (
    <Card className="w-[300px]">
      <CardHeader className="pb-4">
        <div className="flex items-center space-x-4">
          <Avatar>
            <AvatarImage src="https://github.com/shadcn.png" alt="User" />
            <AvatarFallback>JD</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-lg">John Doe</CardTitle>
            <CardDescription>Marketing Manager</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Campaigns</span>
          <span className="text-sm font-medium">24</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Success Rate</span>
          <span className="text-sm font-medium text-green-600">87%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Team</span>
          <span className="text-sm font-medium">Growth</span>
        </div>
      </CardContent>
      <CardFooter className="pt-4">
        <Button variant="outline" className="w-full">View Profile</Button>
      </CardFooter>
    </Card>
  ),
  parameters: {
    docs: {
      description: {
        story: 'A user profile card with avatar and key statistics.',
      },
    },
  },
};

export const MetricsCard: Story = {
  render: () => (
    <Card className="w-[280px]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">$45,231.89</div>
        <p className="text-xs text-muted-foreground">+20.1% from last month</p>
      </CardContent>
    </Card>
  ),
  parameters: {
    docs: {
      description: {
        story: 'A metrics card for displaying key performance indicators.',
      },
    },
  },
};

export const GlassmorphicCard: Story = {
  render: () => (
    <div className="bg-gradient-to-br from-cyan-400 to-blue-500 p-8 rounded-lg">
      <Card className="w-[350px] bg-white/10 backdrop-blur-xl border-white/20">
        <CardHeader>
          <CardTitle className="text-white">Glassmorphic Card</CardTitle>
          <CardDescription className="text-white/80">
            A card with glassmorphic effects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-white/90">
            This card uses a glassmorphic design with backdrop blur and transparency effects.
          </p>
        </CardContent>
        <CardFooter>
          <Button variant="secondary" className="bg-white/20 backdrop-blur-sm border-white/30 text-white hover:bg-white/30">
            Learn More
          </Button>
        </CardFooter>
      </Card>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'A card with glassmorphic design effects matching the SYNTHEX aesthetic.',
      },
    },
  },
};

export const CardGrid: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 w-[720px]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Impressions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">45,231</div>
          <p className="text-xs text-green-600">+12% ↗</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Clicks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">2,350</div>
          <p className="text-xs text-green-600">+5% ↗</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Conversions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">89</div>
          <p className="text-xs text-red-600">-2% ↘</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">$12,426</div>
          <p className="text-xs text-green-600">+8% ↗</p>
        </CardContent>
      </Card>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'A grid of metric cards typically used in dashboards.',
      },
    },
  },
};

// ============================================
// PREMIUM GLASSMORPHISM CARD VARIANTS
// ============================================

export const GlassCard: Story = {
  render: () => (
    <Card variant="glass" className="w-[350px]">
      <CardHeader>
        <CardTitle className="text-white">Glass Card</CardTitle>
        <CardDescription className="text-white/70">
          Premium glassmorphism with subtle transparency
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-white/90">
          This card uses a refined glass effect with backdrop blur and subtle borders.
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="glass" className="w-full">Learn More</Button>
      </CardFooter>
    </Card>
  ),
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story: 'Basic glass card with backdrop blur effect.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="bg-gradient-to-br from-slate-900 via-cyan-900 to-slate-900 p-8 rounded-xl">
        <Story />
      </div>
    ),
  ],
};

export const GlassPrimaryCard: Story = {
  render: () => (
    <Card variant="glass-primary" className="w-[350px]">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/20">
            <Sparkles className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <CardTitle className="text-white text-lg">AI Strategy</CardTitle>
            <CardDescription className="text-cyan-200/70">
              Powered by machine learning
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-white/80 text-sm">
          Advanced AI algorithms analyze millions of data points to optimize your marketing strategy.
        </p>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-cyan-300">✓ Viral detection</span>
          <span className="text-cyan-300">✓ Trend analysis</span>
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="glass-primary" className="w-full">
          <Sparkles className="mr-2 h-4 w-4" />
          Get Started
        </Button>
      </CardFooter>
    </Card>
  ),
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story: 'Primary glass card with cyan gradient accent.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="bg-gradient-to-br from-slate-900 via-cyan-900/50 to-slate-900 p-8 rounded-xl">
        <Story />
      </div>
    ),
  ],
};

export const GlassSecondaryCard: Story = {
  render: () => (
    <Card variant="glass-secondary" className="w-[350px]">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/20">
            <Zap className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <CardTitle className="text-white text-lg">Performance</CardTitle>
            <CardDescription className="text-cyan-200/70">
              Real-time analytics
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-white/70">Engagement Rate</span>
              <span className="text-cyan-400">87%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full" style={{ width: '87%' }}></div>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="glass-secondary" className="w-full">
          <BarChart className="mr-2 h-4 w-4" />
          View Analytics
        </Button>
      </CardFooter>
    </Card>
  ),
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story: 'Secondary glass card with cyan/blue gradient accent.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="bg-gradient-to-br from-slate-900 via-blue-900/50 to-slate-900 p-8 rounded-xl">
        <Story />
      </div>
    ),
  ],
};

export const GlassInteractiveCard: Story = {
  render: () => (
    <Card variant="glass-interactive" className="w-[300px]">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="p-2 rounded-lg bg-emerald-500/20">
            <Target className="h-5 w-5 text-emerald-400" />
          </div>
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
            Active
          </Badge>
        </div>
        <CardTitle className="text-white text-lg mt-3">Campaign</CardTitle>
        <CardDescription className="text-white/60">
          Summer Sale 2026
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between text-sm">
          <span className="text-white/50">Reach</span>
          <span className="text-white font-medium">12.5K</span>
        </div>
      </CardContent>
    </Card>
  ),
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story: 'Interactive glass card with hover lift effect.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 rounded-xl">
        <Story />
      </div>
    ),
  ],
};

export const GlassCardShowcase: Story = {
  render: () => (
    <div className="bg-gradient-to-br from-slate-900 via-cyan-900/30 to-slate-900 p-8 rounded-xl">
      <h2 className="text-white text-xl font-semibold mb-6">Glass Card Variants</h2>

      <div className="grid grid-cols-3 gap-6">
        <Card variant="glass" className="w-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">Glass</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-white/70 text-sm">Basic transparency</p>
          </CardContent>
        </Card>

        <Card variant="glass-solid" className="w-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">Glass Solid</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-white/70 text-sm">More opaque glass</p>
          </CardContent>
        </Card>

        <Card variant="glass-gradient" className="w-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">Glass Gradient</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-white/70 text-sm">Subtle gradient</p>
          </CardContent>
        </Card>

        <Card variant="glass-primary" className="w-full">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <CardTitle className="text-white text-base">Glass Primary</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-cyan-200/70 text-sm">Violet accent</p>
          </CardContent>
        </Card>

        <Card variant="glass-secondary" className="w-full">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-cyan-400" />
              <CardTitle className="text-white text-base">Glass Secondary</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-cyan-200/70 text-sm">Cyan accent</p>
          </CardContent>
        </Card>

        <Card variant="glass-interactive" className="w-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">Interactive</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-white/70 text-sm">Hover to lift</p>
          </CardContent>
        </Card>
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story: 'Complete showcase of all premium glass card variants.',
      },
    },
  },
};

export const GlassFeatureGrid: Story = {
  render: () => (
    <div className="bg-gradient-to-br from-slate-900 via-cyan-900/20 to-slate-900 p-8 rounded-xl">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">AI-Powered Features</h2>
        <p className="text-white/60">Everything you need to dominate social media</p>
      </div>

      <div className="grid grid-cols-3 gap-4 w-[900px]">
        <Card variant="glass-interactive">
          <CardHeader className="pb-3">
            <div className="p-2 rounded-lg bg-cyan-500/20 w-fit mb-2">
              <Brain className="h-5 w-5 text-cyan-400" />
            </div>
            <CardTitle className="text-white text-base">AI Strategy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-white/60 text-sm">
              Analyzes viral patterns and optimal strategies for your niche.
            </p>
          </CardContent>
        </Card>

        <Card variant="glass-interactive">
          <CardHeader className="pb-3">
            <div className="p-2 rounded-lg bg-cyan-500/20 w-fit mb-2">
              <Sparkles className="h-5 w-5 text-cyan-400" />
            </div>
            <CardTitle className="text-white text-base">Content Creator</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-white/60 text-sm">
              Generates authentic, on-brand content that maximizes engagement.
            </p>
          </CardContent>
        </Card>

        <Card variant="glass-interactive">
          <CardHeader className="pb-3">
            <div className="p-2 rounded-lg bg-cyan-500/20 w-fit mb-2">
              <BarChart className="h-5 w-5 text-cyan-400" />
            </div>
            <CardTitle className="text-white text-base">Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-white/60 text-sm">
              Real-time insights with predictive performance metrics.
            </p>
          </CardContent>
        </Card>

        <Card variant="glass-interactive">
          <CardHeader className="pb-3">
            <div className="p-2 rounded-lg bg-emerald-500/20 w-fit mb-2">
              <Target className="h-5 w-5 text-emerald-400" />
            </div>
            <CardTitle className="text-white text-base">Growth Hacker</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-white/60 text-sm">
              Advanced strategies to accelerate your follower growth.
            </p>
          </CardContent>
        </Card>

        <Card variant="glass-interactive">
          <CardHeader className="pb-3">
            <div className="p-2 rounded-lg bg-amber-500/20 w-fit mb-2">
              <Calendar className="h-5 w-5 text-amber-400" />
            </div>
            <CardTitle className="text-white text-base">Scheduler</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-white/60 text-sm">
              AI-optimized posting times across all platforms.
            </p>
          </CardContent>
        </Card>

        <Card variant="glass-interactive">
          <CardHeader className="pb-3">
            <div className="p-2 rounded-lg bg-rose-500/20 w-fit mb-2">
              <Shield className="h-5 w-5 text-rose-400" />
            </div>
            <CardTitle className="text-white text-base">Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-white/60 text-sm">
              Ensures content follows platform guidelines and best practices.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story: 'Feature grid using interactive glass cards - matches SYNTHEX landing page design.',
      },
    },
  },
};