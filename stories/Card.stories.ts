import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Users, TrendingUp } from 'lucide-react';

const meta = {
  title: 'UI/Card',
  component: Card,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A card container with header, content, and footer sections.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
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
    <div className="bg-gradient-to-br from-purple-400 to-blue-500 p-8 rounded-lg">
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