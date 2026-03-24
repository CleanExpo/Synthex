/**
 * API Key Gate — Provider Configuration
 *
 * Per-provider setup instructions and metadata used by ApiKeyGate and
 * ApiKeySetupModal to guide users through obtaining and saving their keys.
 *
 * YouTube URLs are placeholders — replace once Phil provides the tutorial links.
 */

export interface ProviderConfig {
  id: string;
  name: string;
  label: string;
  /** Step-by-step instructions shown in the setup modal */
  instructions: string[];
  /** Optional YouTube tutorial URL — null until provided */
  youtubeUrl: string | null;
  /** Path within the Synthex app to save the key */
  settingsPath: string;
  /** Official docs link for the provider's API keys page */
  docsUrl: string;
}

export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    label: 'OpenAI API Key',
    instructions: [
      'Go to platform.openai.com and sign in to your account',
      'Click your profile icon (top-right) and select "API Keys"',
      'Click "Create new secret key" and give it a descriptive name',
      'Copy the key immediately — it will not be shown again',
      'Paste the key in Settings → Integrations → OpenAI and click Save',
    ],
    youtubeUrl: null, // TODO: Phil to provide tutorial link
    settingsPath: '/dashboard/settings/integrations',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    label: 'Anthropic API Key',
    instructions: [
      'Go to console.anthropic.com and sign in',
      'Click "API Keys" in the left sidebar',
      'Click "Create Key" and give it a name',
      'Copy the key immediately — it is only shown once',
      'Paste the key in Settings → Integrations → Anthropic and click Save',
    ],
    youtubeUrl: null,
    settingsPath: '/dashboard/settings/integrations',
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  google: {
    id: 'google',
    name: 'Google AI (Gemini)',
    label: 'Google AI API Key',
    instructions: [
      'Go to aistudio.google.com and sign in with your Google account',
      'Click "Get API key" in the left sidebar',
      'Click "Create API key" and choose or create a Google Cloud project',
      'Copy the generated API key',
      'Paste the key in Settings → Integrations → Google AI and click Save',
    ],
    youtubeUrl: null,
    settingsPath: '/dashboard/settings/integrations',
    docsUrl: 'https://aistudio.google.com/apikey',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    label: 'OpenRouter API Key',
    instructions: [
      'Go to openrouter.ai and create a free account (or sign in)',
      'Click "Keys" in the top navigation',
      'Click "Create Key" — optionally set a spend limit for safety',
      'Copy the key (it starts with sk-or-)',
      'Paste the key in Settings → Integrations → OpenRouter and click Save',
    ],
    youtubeUrl: null,
    settingsPath: '/dashboard/settings/integrations',
    docsUrl: 'https://openrouter.ai/keys',
  },
  elevenlabs: {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    label: 'ElevenLabs API Key',
    instructions: [
      'Go to elevenlabs.io and sign in to your account',
      'Click your profile icon (top-right) and select "Profile + API Key"',
      'Click the eye icon to reveal your API key, then click the copy icon',
      'Paste the key in Settings → Integrations → ElevenLabs and click Save',
    ],
    youtubeUrl: null,
    settingsPath: '/dashboard/settings/integrations',
    docsUrl: 'https://elevenlabs.io/app/speech-synthesis',
  },
};

/**
 * Get config for a provider, falling back to a generic config if unknown.
 */
export function getProviderConfig(providerId: string): ProviderConfig {
  return (
    PROVIDER_CONFIGS[providerId] ?? {
      id: providerId,
      name: providerId.charAt(0).toUpperCase() + providerId.slice(1),
      label: `${providerId} API Key`,
      instructions: [
        `Obtain your API key from the ${providerId} developer dashboard`,
        'Copy the key and paste it in Settings → Integrations',
      ],
      youtubeUrl: null,
      settingsPath: '/dashboard/settings/integrations',
      docsUrl: '#',
    }
  );
}
