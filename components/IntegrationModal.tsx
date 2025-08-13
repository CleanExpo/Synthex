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
import { 
  ExternalLink, 
  Shield, 
  CheckCircle, 
  AlertTriangle, 
  Loader2,
  Key,
  Link2
} from 'lucide-react';

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

export function IntegrationModal({ 
  isOpen, 
  onClose, 
  integration, 
  onConnect 
}: IntegrationModalProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [step, setStep] = useState<'info' | 'auth' | 'success'>('info');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [error, setError] = useState('');

  const handleOAuthConnect = async () => {
    setIsConnecting(true);
    setError('');
    
    try {
      // Construct OAuth URL based on platform
      const oauthUrls: Record<string, string> = {
        twitter: `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${process.env.NEXT_PUBLIC_TWITTER_CLIENT_ID}&redirect_uri=${encodeURIComponent(window.location.origin + '/api/auth/oauth/twitter')}&scope=tweet.read%20tweet.write%20users.read&state=state&code_challenge=challenge&code_challenge_method=plain`,
        linkedin: `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(window.location.origin + '/api/auth/oauth/linkedin')}&scope=r_liteprofile%20r_emailaddress%20w_member_social`,
        instagram: `https://api.instagram.com/oauth/authorize?client_id=${process.env.NEXT_PUBLIC_INSTAGRAM_CLIENT_ID}&redirect_uri=${encodeURIComponent(window.location.origin + '/api/auth/oauth/instagram')}&scope=user_profile,user_media&response_type=code`,
        facebook: `https://www.facebook.com/v18.0/dialog/oauth?client_id=${process.env.NEXT_PUBLIC_FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(window.location.origin + '/api/auth/oauth/facebook')}&scope=pages_show_list,pages_manage_posts,pages_read_engagement`,
        tiktok: `https://www.tiktok.com/auth/authorize?client_key=${process.env.NEXT_PUBLIC_TIKTOK_CLIENT_KEY}&redirect_uri=${encodeURIComponent(window.location.origin + '/api/auth/oauth/tiktok')}&response_type=code&scope=user.info.basic,video.list`
      };

      const url = oauthUrls[integration.id];
      
      if (!url || url.includes('undefined')) {
        // Fallback to manual API key entry
        setStep('auth');
        setIsConnecting(false);
        return;
      }

      // Open OAuth window
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const authWindow = window.open(
        url,
        `${integration.name} OAuth`,
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Poll for completion
      const pollTimer = setInterval(async () => {
        try {
          if (authWindow?.closed) {
            clearInterval(pollTimer);
            // Check if connection was successful
            const response = await fetch(`/api/integrations/${integration.id}/status`);
            if (response.ok) {
              const data = await response.json();
              if (data.connected) {
                setStep('success');
                setTimeout(() => {
                  onConnect();
                  handleClose();
                }, 2000);
              } else {
                throw new Error('Connection failed');
              }
            }
          }
        } catch (err) {
          clearInterval(pollTimer);
          setError('Connection failed. Please try again.');
          setIsConnecting(false);
        }
      }, 1000);

    } catch (err: any) {
      setError(err.message || 'Failed to connect. Please try again.');
      setIsConnecting(false);
    }
  };

  const handleManualConnect = async () => {
    if (!apiKey) {
      setError('Please enter an API key');
      return;
    }

    setIsConnecting(true);
    setError('');

    try {
      await onConnect({ apiKey, apiSecret });
      setStep('success');
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to connect. Please check your credentials.');
      setIsConnecting(false);
    }
  };

  const handleClose = () => {
    setStep('info');
    setApiKey('');
    setApiSecret('');
    setError('');
    setIsConnecting(false);
    onClose();
  };

  const Icon = integration.icon;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md glass-card border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-gray-800/50 ${integration.color}`}>
              <Icon className="w-5 h-5" />
            </div>
            Connect {integration.name}
          </DialogTitle>
          <DialogDescription>
            {step === 'info' && 'Authorize Synthex to manage your account'}
            {step === 'auth' && 'Enter your API credentials'}
            {step === 'success' && 'Successfully connected!'}
          </DialogDescription>
        </DialogHeader>

        {step === 'info' && (
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                <div>
                  <p className="font-medium text-white">Post & Schedule Content</p>
                  <p className="text-sm text-gray-400">Create and schedule posts directly from Synthex</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                <div>
                  <p className="font-medium text-white">Analytics & Insights</p>
                  <p className="text-sm text-gray-400">Track performance and engagement metrics</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                <div>
                  <p className="font-medium text-white">Secure Connection</p>
                  <p className="text-sm text-gray-400">Your data is encrypted and secure</p>
                </div>
              </div>
            </div>

            <Alert className="border-amber-500/20 bg-amber-500/5">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-gray-300">
                You'll be redirected to {integration.name} to authorize the connection. 
                You can revoke access at any time.
              </AlertDescription>
            </Alert>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleOAuthConnect}
                disabled={isConnecting}
                className="gradient-primary text-white"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4 mr-2" />
                    Connect with {integration.name}
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'auth' && (
          <div className="space-y-4 py-4">
            <Alert className="border-blue-500/20 bg-blue-500/5">
              <Shield className="h-4 w-4 text-blue-500" />
              <AlertDescription className="text-gray-300">
                Enter your API credentials for {integration.name}. 
                These will be encrypted and stored securely.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Enter your API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="bg-white/5 border-white/10"
                />
              </div>
              
              {integration.id === 'twitter' && (
                <div className="space-y-2">
                  <Label htmlFor="apiSecret">API Secret</Label>
                  <Input
                    id="apiSecret"
                    type="password"
                    placeholder="Enter your API secret (optional)"
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                    className="bg-white/5 border-white/10"
                  />
                </div>
              )}
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="text-sm text-gray-400">
              <p>Need help finding your API credentials?</p>
              <a 
                href={`https://synthex.ai/docs/integrations/${integration.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 inline-flex items-center gap-1 mt-1"
              >
                View documentation
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep('info')}>
                Back
              </Button>
              <Button 
                onClick={handleManualConnect}
                disabled={isConnecting || !apiKey}
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
                    Connect
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'success' && (
          <div className="py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Successfully Connected!
            </h3>
            <p className="text-gray-400">
              {integration.name} has been connected to your account.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}