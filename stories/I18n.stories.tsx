import type { Meta, StoryObj } from '@storybook/react';
import { I18nExample } from '@/components/examples/I18nExample';

const meta = {
  title: 'Features/Internationalization',
  component: I18nExample,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Internationalization (i18n) system with multiple language support and localized formatting.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof I18nExample>;

export default meta;
type Story = StoryObj<typeof meta>;

export const I18nDemo: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Complete internationalization demo showing translations, language switching, and localized formatting for dates, numbers, and currencies.',
      },
    },
  },
};

// Individual components
export const LanguageSwitcher: Story = {
  render: () => (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Language Switcher</h2>
        <p className="text-muted-foreground mb-4">
          The language switcher component allows users to change the interface language.
        </p>
        <div className="bg-muted p-4 rounded-lg">
          <p className="text-sm">
            <strong>Supported Languages:</strong>
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            <li>🇺🇸 English</li>
            <li>🇪🇸 Español (Spanish)</li>
            <li>🇫🇷 Français (French) - Coming Soon</li>
            <li>🇩🇪 Deutsch (German) - Coming Soon</li>
            <li>🇵🇹 Português (Portuguese) - Coming Soon</li>
            <li>🇯🇵 日本語 (Japanese) - Coming Soon</li>
            <li>🇨🇳 中文 (Chinese) - Coming Soon</li>
          </ul>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Language switcher component with flag indicators and language names.',
      },
    },
  },
};

export const TranslationExamples: Story = {
  render: () => (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Translation Examples</h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">English</h3>
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p><strong>Save:</strong> Save</p>
              <p><strong>Cancel:</strong> Cancel</p>
              <p><strong>Delete:</strong> Delete</p>
              <p><strong>Sign In:</strong> Sign In</p>
              <p><strong>Dashboard:</strong> Dashboard</p>
              <p><strong>Campaigns:</strong> Campaigns</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Español</h3>
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p><strong>Save:</strong> Guardar</p>
              <p><strong>Cancel:</strong> Cancelar</p>
              <p><strong>Delete:</strong> Eliminar</p>
              <p><strong>Sign In:</strong> Iniciar Sesión</p>
              <p><strong>Dashboard:</strong> Panel de Control</p>
              <p><strong>Campaigns:</strong> Campañas</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Side-by-side comparison of translations in different languages.',
      },
    },
  },
};

export const LocalizedFormatting: Story = {
  render: () => {
    const sampleDate = new Date('2024-03-15');
    const sampleNumber = 1234567.89;
    const sampleCurrency = 99.99;
    
    return (
      <div className="p-8 space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-4">Localized Formatting</h2>
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Dates</h3>
              <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                <p><strong>US:</strong> 03/15/2024</p>
                <p><strong>EU:</strong> 15/03/2024</p>
                <p><strong>DE:</strong> 15.03.2024</p>
                <p><strong>JP:</strong> 2024/03/15</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Numbers</h3>
              <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                <p><strong>US:</strong> 1,234,567.89</p>
                <p><strong>ES:</strong> 1.234.567,89</p>
                <p><strong>FR:</strong> 1 234 567,89</p>
                <p><strong>DE:</strong> 1.234.567,89</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Currency</h3>
              <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                <p><strong>USD:</strong> $99.99</p>
                <p><strong>EUR:</strong> €99,99</p>
                <p><strong>JPY:</strong> ¥100</p>
                <p><strong>CNY:</strong> ¥99.99</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Examples of localized formatting for dates, numbers, and currencies across different locales.',
      },
    },
  },
};