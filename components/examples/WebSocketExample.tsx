/**
 * WebSocket Example Component
 * Demonstrates real-time notifications and WebSocket integration
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useWebSocketContext, useNotificationSender } from '@/components/WebSocketProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  Wifi, 
  WifiOff, 
  Send, 
  Bell, 
  Users, 
  MessageSquare, 
  Activity,
  RefreshCw 
} from '@/components/icons';

export function WebSocketExample() {
  const ws = useWebSocketContext();
  const { sendTestNotification, sendCustomNotification } = useNotificationSender();
  
  // Custom notification form state
  const [customNotification, setCustomNotification] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'success' | 'warning' | 'error',
    actionUrl: '',
    actionText: '',
    persistent: false,
  });

  // Channel subscription state
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const [newChannel, setNewChannel] = useState('');

  // Message log
  const [messages, setMessages] = useState<Array<{
    id: string;
    type: string;
    content: any;
    timestamp: Date;
  }>>([]);

  // Subscribe to messages for logging
  useEffect(() => {
    if (ws) {
      const handleMessage = (message: any) => {
        setMessages(prev => [{
          id: Date.now().toString(),
          type: message.type || 'unknown',
          content: message,
          timestamp: new Date(),
        }, ...prev].slice(0, 20)); // Keep last 20 messages
      };

      ws.send = ((originalSend) => {
        return (message: any) => {
          handleMessage({ ...message, direction: 'outgoing' });
          return originalSend.call(ws, message);
        };
      })(ws.send);

      // Note: In a real implementation, you'd properly set up message listeners
    }
  }, [ws]);

  const handleSubscribe = (channel: string) => {
    if (channel && !subscriptions.includes(channel)) {
      ws.subscribe(channel);
      setSubscriptions(prev => [...prev, channel]);
      setNewChannel('');
    }
  };

  const handleUnsubscribe = (channel: string) => {
    ws.unsubscribe(channel);
    setSubscriptions(prev => prev.filter(c => c !== channel));
  };

  const handleSendCustomNotification = () => {
    if (customNotification.title && customNotification.message) {
      sendCustomNotification(
        customNotification.title,
        customNotification.message,
        {
          type: customNotification.type,
          actionUrl: customNotification.actionUrl || undefined,
          actionText: customNotification.actionText || undefined,
          persistent: customNotification.persistent,
        }
      );
      
      // Reset form
      setCustomNotification({
        title: '',
        message: '',
        type: 'info',
        actionUrl: '',
        actionText: '',
        persistent: false,
      });
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">WebSocket Demo</h1>
          <p className="text-muted-foreground">
            Real-time notifications and messaging
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <Badge 
            variant={ws.isConnected ? 'default' : 'destructive'}
            className="flex items-center space-x-2"
          >
            {ws.isConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            <span>{ws.connectionState}</span>
          </Badge>
          
          {ws.reconnectCount > 0 && (
            <Badge variant="outline">
              Reconnect attempts: {ws.reconnectCount}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connection Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Connection Status</span>
            </CardTitle>
            <CardDescription>
              WebSocket connection information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Status</Label>
                <div className="flex items-center space-x-2 mt-1">
                  {ws.isConnected ? (
                    <>
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-green-600">Connected</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 bg-red-500 rounded-full" />
                      <span className="text-red-600">Disconnected</span>
                    </>
                  )}
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium">State</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {ws.connectionState}
                </p>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <Button
                size="sm"
                onClick={() => ws.connect()}
                disabled={ws.isConnected || ws.connectionState === 'CONNECTING'}
              >
                <Wifi className="h-4 w-4 mr-2" />
                Connect
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => ws.disconnect()}
                disabled={!ws.isConnected}
              >
                <WifiOff className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => ws.connect()}
                disabled={ws.connectionState === 'CONNECTING'}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reconnect
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Test Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bell className="h-5 w-5" />
              <span>Test Notifications</span>
            </CardTitle>
            <CardDescription>
              Send test notifications to see the system in action
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => sendTestNotification('info')}
                disabled={!ws.isConnected}
              >
                Info
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => sendTestNotification('success')}
                disabled={!ws.isConnected}
              >
                Success
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => sendTestNotification('warning')}
                disabled={!ws.isConnected}
              >
                Warning
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => sendTestNotification('error')}
                disabled={!ws.isConnected}
              >
                Error
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Channel Subscriptions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Channel Subscriptions</span>
            </CardTitle>
            <CardDescription>
              Subscribe to specific channels for targeted notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex space-x-2">
              <Input
                placeholder="Channel name (e.g., user:123, global)"
                value={newChannel}
                onChange={(e) => setNewChannel(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSubscribe(newChannel)}
              />
              <Button
                size="sm"
                onClick={() => handleSubscribe(newChannel)}
                disabled={!ws.isConnected || !newChannel}
              >
                Subscribe
              </Button>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">Active Subscriptions</Label>
              {subscriptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active subscriptions</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {subscriptions.map(channel => (
                    <Badge 
                      key={channel} 
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => handleUnsubscribe(channel)}
                    >
                      {channel} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Custom Notification Sender */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Send className="h-5 w-5" />
              <span>Custom Notification</span>
            </CardTitle>
            <CardDescription>
              Send custom notifications with your own content
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Notification title"
                  value={customNotification.title}
                  onChange={(e) => setCustomNotification(prev => ({
                    ...prev,
                    title: e.target.value
                  }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={customNotification.type}
                  onValueChange={(value: any) => setCustomNotification(prev => ({
                    ...prev,
                    type: value
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Notification message"
                value={customNotification.message}
                onChange={(e) => setCustomNotification(prev => ({
                  ...prev,
                  message: e.target.value
                }))}
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="actionUrl">Action URL (optional)</Label>
                <Input
                  id="actionUrl"
                  placeholder="https://example.com"
                  value={customNotification.actionUrl}
                  onChange={(e) => setCustomNotification(prev => ({
                    ...prev,
                    actionUrl: e.target.value
                  }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="actionText">Action Text</Label>
                <Input
                  id="actionText"
                  placeholder="View Details"
                  value={customNotification.actionText}
                  onChange={(e) => setCustomNotification(prev => ({
                    ...prev,
                    actionText: e.target.value
                  }))}
                />
              </div>
            </div>
            
            <Button 
              onClick={handleSendCustomNotification}
              disabled={!ws.isConnected || !customNotification.title || !customNotification.message}
              className="w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              Send Custom Notification
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Message Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-5 w-5" />
              <span>Message Log</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMessages([])}
            >
              Clear Log
            </Button>
          </CardTitle>
          <CardDescription>
            Real-time log of WebSocket messages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No messages yet</p>
            ) : (
              messages.map(message => (
                <div key={message.id} className="p-2 bg-muted rounded text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="outline" className="text-xs">
                      {message.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(message.timestamp)}
                    </span>
                  </div>
                  <pre className="text-xs overflow-x-auto">
                    {JSON.stringify(message.content, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default WebSocketExample;