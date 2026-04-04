import type { StorybookConfig } from '@storybook/nextjs';

const config: StorybookConfig = {
  stories: [
    '../stories/**/*.stories.@(ts|tsx)',
    '../components/**/*.stories.@(ts|tsx)',
    '../app/**/*.stories.@(ts|tsx)',
  ],
  
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y',
    '@storybook/addon-viewport',
    '@storybook/addon-controls',
    '@storybook/addon-docs',
    '@storybook/addon-styling',
  ],
  
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  
  docs: {
    autodocs: 'tag',
    defaultName: 'Documentation',
  },
  
  typescript: {
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop) => {
        if (prop.parent) {
          return !prop.parent.fileName.includes('node_modules');
        }
        return true;
      },
    },
  },
  
  staticDirs: ['../public'],
  
  features: {
    experimentalRSC: true,
  },
  
  env: (config) => ({
    ...config,
    STORYBOOK: 'true',
  }),
  
  webpackFinal: async (config) => {
    // Add any custom webpack configuration here
    if (config.resolve) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@': require('path').resolve(__dirname, '../'),
      };
    }
    
    return config;
  },
};

export default config;
