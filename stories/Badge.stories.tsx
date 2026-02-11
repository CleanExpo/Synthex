import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from '@/components/ui/badge';

const meta = {
  title: 'UI/Badge',
  component: Badge,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A small status indicator or label component.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline'],
      description: 'The visual style variant of the badge',
    },
    children: {
      control: 'text',
      description: 'Badge content',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
  args: {
    children: 'Badge',
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Default',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary',
  },
};

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'Destructive',
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Outline',
  },
};

// Status badges
export const StatusBadges: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="default">Active</Badge>
      <Badge variant="secondary">Inactive</Badge>
      <Badge variant="destructive">Error</Badge>
      <Badge variant="outline">Pending</Badge>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Different badge variants used for status indicators.',
      },
    },
  },
};

// Campaign status badges
export const CampaignStatus: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm">Draft:</span>
        <Badge variant="outline">Draft</Badge>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm">Scheduled:</span>
        <Badge variant="secondary">Scheduled</Badge>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm">Active:</span>
        <Badge variant="default">Active</Badge>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm">Paused:</span>
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
          Paused
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm">Completed:</span>
        <Badge variant="secondary" className="bg-green-50 text-green-700">
          Completed
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm">Failed:</span>
        <Badge variant="destructive">Failed</Badge>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Campaign status badges with custom colors.',
      },
    },
  },
};

// Number badges
export const NumberBadges: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <div className="relative">
        <span className="text-sm">Notifications</span>
        <Badge variant="destructive" className="ml-2 text-xs px-1 py-0 min-w-[20px] h-5 rounded-full flex items-center justify-center">
          3
        </Badge>
      </div>
      <div className="relative">
        <span className="text-sm">Messages</span>
        <Badge variant="default" className="ml-2 text-xs px-1 py-0 min-w-[20px] h-5 rounded-full flex items-center justify-center">
          12
        </Badge>
      </div>
      <div className="relative">
        <span className="text-sm">Tasks</span>
        <Badge variant="secondary" className="ml-2 text-xs px-1 py-0 min-w-[20px] h-5 rounded-full flex items-center justify-center">
          99+
        </Badge>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Number badges for counts and notifications.',
      },
    },
  },
};

// Social platform badges
export const SocialPlatforms: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge className="bg-blue-500 hover:bg-blue-600">Facebook</Badge>
      <Badge className="bg-sky-500 hover:bg-sky-600">Twitter</Badge>
      <Badge className="bg-gradient-to-r from-cyan-500 to-pink-500">Instagram</Badge>
      <Badge className="bg-blue-700 hover:bg-blue-800">LinkedIn</Badge>
      <Badge className="bg-red-500 hover:bg-red-600">YouTube</Badge>
      <Badge className="bg-green-500 hover:bg-green-600">WhatsApp</Badge>
      <Badge className="bg-pink-500 hover:bg-pink-600">TikTok</Badge>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Custom colored badges for social media platforms.',
      },
    },
  },
};

// Size variations
export const SizeVariations: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Badge className="text-xs px-1.5 py-0.5">Small</Badge>
      <Badge>Normal</Badge>
      <Badge className="text-sm px-3 py-1">Large</Badge>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Different sized badges using custom classes.',
      },
    },
  },
};

// Interactive badges
export const InteractiveBadges: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge 
        variant="outline" 
        className="cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        Clickable Badge
      </Badge>
      <Badge 
        variant="secondary"
        className="cursor-pointer hover:bg-secondary/80 transition-colors group"
      >
        Hover Effect
        <span className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity">✕</span>
      </Badge>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Interactive badges with hover effects and click handlers.',
      },
    },
  },
};