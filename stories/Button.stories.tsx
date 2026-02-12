import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@/components/ui/button';
import { Mail, Download, Trash2, Plus, Sparkles, Zap, Shield, Check } from '@/components/icons';

const meta = {
  title: 'UI/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A versatile button component with multiple variants and sizes, including premium glassmorphism styles.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'destructive',
        'outline',
        'secondary',
        'ghost',
        'link',
        'glass',
        'glass-primary',
        'glass-secondary',
        'glass-destructive',
        'glass-success',
        'premium-primary',
        'premium-secondary',
      ],
      description: 'The visual style variant of the button',
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
      description: 'The size of the button',
    },
    asChild: {
      control: 'boolean',
      description: 'Render as a child component',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the button is disabled',
    },
    children: {
      control: 'text',
      description: 'Button content',
    },
  },
  args: {
    children: 'Button',
    disabled: false,
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// Basic variants
export const Default: Story = {
  args: {
    children: 'Default Button',
  },
};

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'Delete',
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Outline Button',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary Button',
  },
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: 'Ghost Button',
  },
};

export const Link: Story = {
  args: {
    variant: 'link',
    children: 'Link Button',
  },
};

// Sizes
export const Small: Story = {
  args: {
    size: 'sm',
    children: 'Small Button',
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
    children: 'Large Button',
  },
};

// With icons
export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Mail className="mr-2 h-4 w-4" />
        Login with Email
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Button with an icon using Lucide React icons.',
      },
    },
  },
};

export const IconOnly: Story = {
  args: {
    variant: 'outline',
    size: 'icon',
    children: <Plus className="h-4 w-4" />,
  },
  parameters: {
    docs: {
      description: {
        story: 'Icon-only button with equal width and height.',
      },
    },
  },
};

// States
export const Disabled: Story = {
  args: {
    disabled: true,
    children: 'Disabled Button',
  },
};

export const Loading: Story = {
  args: {
    disabled: true,
    children: (
      <>
        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        Loading...
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Button in loading state with spinner animation.',
      },
    },
  },
};

// Action buttons
export const ActionButtons: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button>
        <Plus className="mr-2 h-4 w-4" />
        Create New
      </Button>
      <Button variant="outline">
        <Download className="mr-2 h-4 w-4" />
        Download
      </Button>
      <Button variant="destructive">
        <Trash2 className="mr-2 h-4 w-4" />
        Delete
      </Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Common action buttons with appropriate icons and variants.',
      },
    },
  },
};

// Button group
export const ButtonGroup: Story = {
  render: () => (
    <div className="flex">
      <Button variant="outline" className="rounded-r-none border-r-0">
        Day
      </Button>
      <Button variant="outline" className="rounded-none border-r-0">
        Week
      </Button>
      <Button variant="outline" className="rounded-l-none">
        Month
      </Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Grouped buttons for related actions like view toggles.',
      },
    },
  },
};

// ============================================
// PREMIUM GLASSMORPHISM VARIANTS
// ============================================

export const Glass: Story = {
  args: {
    variant: 'glass',
    children: 'Glass Button',
  },
  parameters: {
    backgrounds: { default: 'dark' },
    docs: {
      description: {
        story: 'Basic glass button with backdrop blur and subtle border.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="bg-gradient-to-br from-slate-900 via-cyan-900 to-slate-900 p-8 rounded-lg">
        <Story />
      </div>
    ),
  ],
};

export const GlassPrimary: Story = {
  args: {
    variant: 'glass-primary',
    children: (
      <>
        <Sparkles className="mr-2 h-4 w-4" />
        Get Started
      </>
    ),
  },
  parameters: {
    backgrounds: { default: 'dark' },
    docs: {
      description: {
        story: 'Primary glass button with cyan gradient and glow effect on hover.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="bg-gradient-to-br from-slate-900 via-cyan-900 to-slate-900 p-8 rounded-lg">
        <Story />
      </div>
    ),
  ],
};

export const GlassSecondary: Story = {
  args: {
    variant: 'glass-secondary',
    children: (
      <>
        <Zap className="mr-2 h-4 w-4" />
        Learn More
      </>
    ),
  },
  parameters: {
    backgrounds: { default: 'dark' },
    docs: {
      description: {
        story: 'Secondary glass button with cyan/blue gradient for alternative actions.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8 rounded-lg">
        <Story />
      </div>
    ),
  ],
};

export const GlassDestructive: Story = {
  args: {
    variant: 'glass-destructive',
    children: (
      <>
        <Trash2 className="mr-2 h-4 w-4" />
        Delete
      </>
    ),
  },
  parameters: {
    backgrounds: { default: 'dark' },
    docs: {
      description: {
        story: 'Destructive glass button with red tint for dangerous actions.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="bg-gradient-to-br from-slate-900 via-red-900/30 to-slate-900 p-8 rounded-lg">
        <Story />
      </div>
    ),
  ],
};

export const GlassSuccess: Story = {
  args: {
    variant: 'glass-success',
    children: (
      <>
        <Check className="mr-2 h-4 w-4" />
        Confirm
      </>
    ),
  },
  parameters: {
    backgrounds: { default: 'dark' },
    docs: {
      description: {
        story: 'Success glass button with emerald tint for positive confirmations.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="bg-gradient-to-br from-slate-900 via-emerald-900/30 to-slate-900 p-8 rounded-lg">
        <Story />
      </div>
    ),
  ],
};

export const PremiumPrimary: Story = {
  args: {
    variant: 'premium-primary',
    size: 'lg',
    children: (
      <>
        <Sparkles className="mr-2 h-5 w-5" />
        Start Free Trial
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Premium solid gradient button for primary CTAs with lift effect on hover.',
      },
    },
  },
};

export const PremiumSecondary: Story = {
  args: {
    variant: 'premium-secondary',
    size: 'lg',
    children: (
      <>
        <Shield className="mr-2 h-5 w-5" />
        Upgrade to Pro
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Premium secondary gradient button for upsell CTAs.',
      },
    },
  },
};

export const GlassButtonShowcase: Story = {
  render: () => (
    <div className="bg-gradient-to-br from-slate-900 via-cyan-900 to-slate-900 p-8 rounded-xl space-y-6">
      <div className="text-white text-lg font-semibold mb-4">Premium Glass Buttons</div>

      <div className="flex flex-wrap gap-3">
        <Button variant="glass">Glass</Button>
        <Button variant="glass-primary">
          <Sparkles className="mr-2 h-4 w-4" />
          Primary
        </Button>
        <Button variant="glass-secondary">
          <Zap className="mr-2 h-4 w-4" />
          Secondary
        </Button>
        <Button variant="glass-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Destructive
        </Button>
        <Button variant="glass-success">
          <Check className="mr-2 h-4 w-4" />
          Success
        </Button>
      </div>

      <div className="text-white text-lg font-semibold mb-4 mt-8">Premium Solid Buttons</div>

      <div className="flex flex-wrap gap-3">
        <Button variant="premium-primary" size="lg">
          <Sparkles className="mr-2 h-5 w-5" />
          Start Free Trial
        </Button>
        <Button variant="premium-secondary" size="lg">
          <Shield className="mr-2 h-5 w-5" />
          Upgrade to Pro
        </Button>
      </div>

      <div className="text-white text-lg font-semibold mb-4 mt-8">Size Variations</div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="glass-primary" size="sm">Small</Button>
        <Button variant="glass-primary">Default</Button>
        <Button variant="glass-primary" size="lg">Large</Button>
        <Button variant="glass-primary" size="xl">Extra Large</Button>
        <Button variant="glass-primary" size="icon">
          <Sparkles className="h-4 w-4" />
        </Button>
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story: 'Complete showcase of all premium glassmorphism button variants.',
      },
    },
  },
};