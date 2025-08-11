import type { Preview } from '@storybook/react';
import { themes } from '@storybook/theming';

// Import global styles
import '../app/globals.css';

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
      expanded: true,
    },
    
    docs: {
      theme: themes.light,
      toc: true,
    },
    
    // Dark mode configuration
    darkMode: {
      dark: { ...themes.dark, appBg: 'black' },
      light: { ...themes.normal, appBg: 'white' },
      current: 'light',
      stylePreview: true,
      darkClass: 'dark',
      lightClass: 'light',
    },
    
    // Viewport configuration
    viewport: {
      viewports: {
        mobile1: {
          name: 'Small Mobile',
          styles: {
            width: '320px',
            height: '568px',
          },
        },
        mobile2: {
          name: 'Large Mobile',
          styles: {
            width: '414px',
            height: '896px',
          },
        },
        tablet: {
          name: 'Tablet',
          styles: {
            width: '768px',
            height: '1024px',
          },
        },
        desktop: {
          name: 'Desktop',
          styles: {
            width: '1024px',
            height: '768px',
          },
        },
        largeDesktop: {
          name: 'Large Desktop',
          styles: {
            width: '1440px',
            height: '900px',
          },
        },
      },
    },
    
    // Layout configuration
    layout: 'centered',
    
    // Background configuration
    backgrounds: {
      default: 'light',
      values: [
        {
          name: 'light',
          value: '#ffffff',
        },
        {
          name: 'dark',
          value: '#1a1a1a',
        },
        {
          name: 'synthex',
          value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        },
      ],
    },
  },
  
  // Global decorators
  decorators: [
    (Story) => (
      <div className="font-sans antialiased">
        <div className="min-h-screen bg-background text-foreground">
          <Story />
        </div>
      </div>
    ),
  ],
  
  // Global args
  args: {},
  
  // Global arg types
  argTypes: {
    // Common prop types
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the component is disabled',
    },
    variant: {
      control: 'select',
      description: 'Component variant',
    },
    size: {
      control: 'select',
      description: 'Component size',
    },
  },
  
  // Tags for autodocs
  tags: ['autodocs'],
};

export default preview;