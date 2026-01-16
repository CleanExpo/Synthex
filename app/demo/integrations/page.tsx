'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { IntegrationModal } from '@/components/IntegrationModal';
import { 
  Twitter, 
  Linkedin, 
  Instagram, 
  Facebook, 
  Video,
  Link2,
  Unlink,
  CheckCircle,
  AlertCircle,
  Shield,
  Loader2,
  RefreshCw,
  Info
} from '@/components/icons';
import toast, { Toaster } from 'react-hot-toast';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: any;
  connected: boolean;
  color: string;
  accountName?: string;
  permissions?: string[];
}

export default function DemoIntegrationsPage() {
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);

  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 'twitter',
      name: 'Twitter / X',
      description: 'Connect your Twitter account to post and analyze tweets',
      icon: Twitter,
      connected: false,
      color: 'text-blue-400',
      permissions: ['Post tweets', 'Read analytics', 'Schedule posts']
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      description: 'Share professional content and track engagement',
      icon: Linkedin,
      connected: false,
      color: 'text-blue-600',
      permissions: ['Post updates', 'Read analytics', 'Manage pages']
    },
    {
      id: 'instagram',
      name: 'Instagram',
      description: 'Post photos, stories, and reels to Instagram',
      icon: Instagram,
      connected: false,
      color: 'text-pink-500',
      permissions: ['Post content', 'View insights', 'Manage comments']
    },
    {
      id: 'facebook',
      name: 'Facebook',
      description: 'Manage Facebook pages and track performance',
      icon: Facebook,
      connected: false,
      color: 'text-blue-500',
      permissions: ['Manage pages', 'Post content', 'Read insights']
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      description: 'Create and schedule TikTok videos',
      icon: Video,
      connected: false,
      color: 'text-gray-900',
      permissions: ['Post videos', 'View analytics', 'Manage account']
    }
  ]);

  const handleConnect = async (id: string) => {
    const integration = integrations.find(i => i.id === id);
    if (integration) {
      setSelectedIntegration(integration);
      setModalOpen(true);
    }
  };

  const handleModalConnect = async (credentials?: any) => {
    if (!selectedIntegration) return;
    
    setConnectingId(selectedIntegration.id);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Check if credentials were provided
      if (credentials && Object.keys(credentials).length > 0) {
        setIntegrations(prev => prev.map(integration => 
          integration.id === selectedIntegration.id 
            ? { 
                ...integration, 
                connected: true,
                accountName: `@demo_${integration.name.toLowerCase().replace(/\s+/g, '')}_user`
              }
            : integration
        ));
        
        toast.success(`${selectedIntegration.name} connected successfully! (Demo Mode)`);
        setModalOpen(false);
      } else {
        throw new Error('Please provide all required credentials');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to connect. Please try again.');
      throw error;
    } finally {
      setConnectingId(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    setConnectingId(id);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setIntegrations(prev => prev.map(integration => 
        integration.id === id 
          ? { ...integration, connected: false, accountName: undefined }
          : integration
      ));
      
      toast.success(`${integrations.find(i => i.id === id)?.name} disconnected`);
    } catch (error) {
      toast.error('Failed to disconnect. Please try again.');
    } finally {
      setConnectingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-purple-950/20 to-gray-950">
      <Toaster position="top-right" />
      
      {/* Demo Mode Banner */}
      <div className="bg-amber-500/10 border border-amber-500/20 p-3">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
          <Info className="w-4 h-4 text-amber-400" />
          <p className="text-sm text-amber-400">
            Demo Mode: Test the integration UI without authentication. Your data won't be saved.
          </p>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Platform Integrations</h1>
          <p className="text-gray-400">
            Connect your social media accounts using your own API credentials
          </p>
        </div>

        {/* How It Works Section */}
        <Card className="glass-card mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-400" />
              How Synthex Integrations Work
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-gray-300">
              <p className="flex items-start gap-2">
                <span className="text-purple-400 font-bold">1.</span>
                Each user connects their own social media accounts using their own API credentials
              </p>
              <p className="flex items-start gap-2">
                <span className="text-purple-400 font-bold">2.</span>
                Click "Connect" on any platform below to enter your API keys
              </p>
              <p className="flex items-start gap-2">
                <span className="text-purple-400 font-bold">3.</span>
                Your credentials are encrypted and stored securely in your account
              </p>
              <p className="flex items-start gap-2">
                <span className="text-purple-400 font-bold">4.</span>
                Posts go directly from Synthex to your social media accounts
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {integrations.map((integration) => {
            const Icon = integration.icon;
            const isConnecting = connectingId === integration.id;
            
            return (
              <Card key={integration.id} className="glass-card">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-gray-800/50 ${integration.color}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{integration.name}</CardTitle>
                        {integration.connected && integration.accountName && (
                          <p className="text-sm text-gray-400 mt-1">{integration.accountName}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant={integration.connected ? "default" : "secondary"}>
                      {integration.connected ? "Connected" : "Not connected"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CardDescription>{integration.description}</CardDescription>
                  
                  {integration.permissions && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-400 mb-2">Permissions:</p>
                      <div className="flex flex-wrap gap-1">
                        {integration.permissions.map((permission) => (
                          <Badge key={permission} variant="outline" className="text-xs">
                            {permission}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {integration.connected ? (
                      <>
                        <Button
                          onClick={() => handleDisconnect(integration.id)}
                          disabled={isConnecting}
                          variant="destructive"
                          size="sm"
                          className="flex-1"
                        >
                          {isConnecting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Unlink className="w-4 h-4" />
                          )}
                          Disconnect
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={() => handleConnect(integration.id)}
                        disabled={isConnecting}
                        className="w-full gradient-primary text-white"
                        size="sm"
                      >
                        {isConnecting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <Link2 className="w-4 h-4 mr-2" />
                            Connect
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="glass-card mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-400" />
              Security & Privacy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-gray-400">
              <p className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                Your credentials are encrypted and stored securely
              </p>
              <p className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                We only request necessary permissions for each platform
              </p>
              <p className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                You can revoke access at any time from this page
              </p>
              <p className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                Some features may require re-authentication after 30 days
              </p>
            </div>
          </CardContent>
        </Card>

        {selectedIntegration && (
          <IntegrationModal
            isOpen={modalOpen}
            onClose={() => {
              setModalOpen(false);
              setSelectedIntegration(null);
            }}
            integration={selectedIntegration}
            onConnect={handleModalConnect}
          />
        )}
      </div>
    </div>
  );
}