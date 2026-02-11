'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ExternalLink, 
  Shield, 
  CheckCircle, 
  AlertTriangle, 
  Loader2,
  Key,
  Link2,
  Info,
  Copy,
  Book
} from '@/components/icons';
import { toast } from 'sonner';

interface IntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  integration: {
    id: string;
    name: string;
    icon: any;
    color: string;
  };
  onConnect: (credentials?: any) => Promise<void>;
}

// Platform-specific credential requirements
const platformCredentials: Record<string, Array<{
  key: string;
  label: string;
  type: string;
  placeholder: string;
  required: boolean;
  help?: string;
}>> = {
  twitter: [
    { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Enter your Twitter API Key', required: true },
    { key: 'apiSecret', label: 'API Secret', type: 'password', placeholder: 'Enter your Twitter API Secret', required: true },
    { key: 'accessToken', label: 'Access Token', type: 'password', placeholder: 'Enter your Access Token', required: true },
    { key: 'accessTokenSecret', label: 'Access Token Secret', type: 'password', placeholder: 'Enter your Access Token Secret', required: true },
  ],
  linkedin: [
    { key: 'clientId', label: 'Client ID', type: 'password', placeholder: 'Enter your LinkedIn Client ID', required: true },
    { key: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: 'Enter your LinkedIn Client Secret', required: true },
    { key: 'accessToken', label: 'Access Token', type: 'password', placeholder: 'Enter your Access Token', required: true, help: 'Generate from LinkedIn Developer Portal' },
  ],
  instagram: [
    { key: 'accessToken', label: 'Access Token', type: 'password', placeholder: 'Enter your Instagram Access Token', required: true },
    { key: 'businessAccountId', label: 'Business Account ID', type: 'text', placeholder: 'Enter your Business Account ID', required: true },
  ],
  facebook: [
    { key: 'pageAccessToken', label: 'Page Access Token', type: 'password', placeholder: 'Enter your Page Access Token', required: true },
    { key: 'pageId', label: 'Page ID', type: 'text', placeholder: 'Enter your Facebook Page ID', required: true },
  ],
  tiktok: [
    { key: 'accessToken', label: 'Access Token', type: 'password', placeholder: 'Enter your TikTok Access Token', required: true },
    { key: 'openId', label: 'Open ID', type: 'text', placeholder: 'Enter your TikTok Open ID', required: true },
  ],
};

// Instructions for getting API keys
const platformInstructions: Record<string, Array<{ step: number; text: string }>> = {
  twitter: [
    { step: 1, text: 'Go to developer.twitter.com and sign in' },
    { step: 2, text: 'Create a new app or select existing one' },
    { step: 3, text: 'Navigate to "Keys and tokens" tab' },
    { step: 4, text: 'Generate API Key & Secret' },
    { step: 5, text: 'Generate Access Token & Secret' },
    { step: 6, text: 'Copy all four values to Synthex' },
  ],
  linkedin: [
    { step: 1, text: 'Visit linkedin.com/developers' },
    { step: 2, text: 'Create a new app or select existing' },
    { step: 3, text: 'Go to "Auth" tab for Client ID & Secret' },
    { step: 4, text: 'Use OAuth 2.0 tools to generate Access Token' },
    { step: 5, text: 'Copy credentials to Synthex' },
  ],
  instagram: [
    { step: 1, text: 'Go to developers.facebook.com' },
    { step: 2, text: 'Create/select app with Instagram Basic Display' },
    { step: 3, text: 'Generate long-lived Access Token' },
    { step: 4, text: 'Get your Instagram Business Account ID' },
    { step: 5, text: 'Enter both values in Synthex' },
  ],
  facebook: [
    { step: 1, text: 'Visit developers.facebook.com' },
    { step: 2, text: 'Create app or use existing' },
    { step: 3, text: 'Go to Graph API Explorer' },
    { step: 4, text: 'Generate Page Access Token with required permissions' },
    { step: 5, text: 'Get your Page ID from page settings' },
    { step: 6, text: 'Enter both in Synthex' },
  ],
  tiktok: [
    { step: 1, text: 'Go to developers.tiktok.com' },
    { step: 2, text: 'Create or select your app' },
    { step: 3, text: 'Generate Access Token via OAuth' },
    { step: 4, text: 'Get your Open ID from user info' },
    { step: 5, text: 'Copy both to Synthex' },
  ],
};

export function IntegrationModal({ 
  isOpen, 
  onClose, 
  integration, 
  onConnect 
}: IntegrationModalProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('credentials');

  const handleConnect = async () => {
    // Validate required fields
    const requiredFields = platformCredentials[integration.id] || [];
    const missingFields = requiredFields
      .filter(field => field.required && !credentials[field.key])
      .map(field => field.label);

    if (missingFields.length > 0) {
      setError(`Please fill in required fields: ${missingFields.join(', ')}`);
      return;
    }

    setIsConnecting(true);
    setError('');

    try {
      await onConnect(credentials);
      toast.success(`${integration.name} connected successfully!`);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to connect. Please check your credentials.');
      setIsConnecting(false);
    }
  };

  const handleClose = () => {
    setCredentials({});
    setError('');
    setIsConnecting(false);
    setActiveTab('credentials');
    onClose();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const Icon = integration.icon;
  const fields = platformCredentials[integration.id] || [];
  const instructions = platformInstructions[integration.id] || [];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl bg-white/[0.02] backdrop-blur-xl border border-white/[0.08]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-gray-800/50 ${integration.color}`}>
              <Icon className="w-5 h-5" />
            </div>
            Connect {integration.name}
          </DialogTitle>
          <DialogDescription>
            Enter your {integration.name} API credentials to connect your account
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="credentials">API Credentials</TabsTrigger>
            <TabsTrigger value="instructions">How to Get Keys</TabsTrigger>
          </TabsList>

          <TabsContent value="credentials" className="space-y-4 mt-4">
            <Alert className="border-blue-500/20 bg-blue-500/5">
              <Shield className="h-4 w-4 text-blue-500" />
              <AlertDescription className="text-gray-300">
                Your credentials are encrypted and stored securely. We never share them with third parties.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              {fields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key}>
                    {field.label}
                    {field.required && <span className="text-red-400 ml-1">*</span>}
                  </Label>
                  <Input
                    id={field.key}
                    type={field.type}
                    placeholder={field.placeholder}
                    value={credentials[field.key] || ''}
                    onChange={(e) => setCredentials(prev => ({
                      ...prev,
                      [field.key]: e.target.value
                    }))}
                    className="bg-white/5 border-white/10"
                  />
                  {field.help && (
                    <p className="text-xs text-gray-400">{field.help}</p>
                  )}
                </div>
              ))}
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Alert className="border-amber-500/20 bg-amber-500/5">
              <Info className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-gray-300">
                Don't have API keys yet? Switch to the "How to Get Keys" tab for step-by-step instructions.
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="instructions" className="space-y-4 mt-4">
            <Alert className="border-green-500/20 bg-green-500/5">
              <Book className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-gray-300">
                Follow these steps to get your {integration.name} API credentials
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              {instructions.map((instruction) => (
                <div key={instruction.step} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-cyan-500/20 flex items-center justify-center">
                    <span className="text-xs font-semibold text-cyan-400">
                      {instruction.step}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 pt-1">{instruction.text}</p>
                </div>
              ))}
            </div>

            <div className="p-4 bg-white/5 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white">Quick Links</h4>
              </div>
              {integration.id === 'twitter' && (
                <a 
                  href="https://developer.twitter.com/en/portal/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300"
                >
                  Twitter Developer Portal
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {integration.id === 'linkedin' && (
                <a 
                  href="https://www.linkedin.com/developers/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300"
                >
                  LinkedIn Developer Portal
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {integration.id === 'facebook' && (
                <a 
                  href="https://developers.facebook.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300"
                >
                  Facebook Developer Portal
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {integration.id === 'instagram' && (
                <a 
                  href="https://developers.facebook.com/docs/instagram-basic-display-api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300"
                >
                  Instagram Basic Display API
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {integration.id === 'tiktok' && (
                <a 
                  href="https://developers.tiktok.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300"
                >
                  TikTok Developer Portal
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleConnect}
            disabled={isConnecting || activeTab !== 'credentials'}
            className="gradient-primary text-white"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Key className="w-4 h-4 mr-2" />
                Connect Account
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}