'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Database,
  Download,
  Clock,
  CheckCircle,
  AlertCircle,
  Archive,
  RefreshCw,
  Calendar,
  HardDrive,
  Shield,
  Loader2,
  Play,
  Pause,
  Settings
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

interface Backup {
  id: string;
  created_at: string;
  type: 'scheduled' | 'manual';
  status: 'completed' | 'failed' | 'in_progress';
  statistics?: {
    profileCount: number;
    postCount: number;
    campaignCount: number;
    analyticsCount: number;
  };
  size_bytes?: number;
}

export default function BackupsPage() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [nextBackup, setNextBackup] = useState<Date | null>(null);

  useEffect(() => {
    fetchBackups();
    calculateNextBackup();
  }, []);

  const fetchBackups = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/backup');
      if (response.ok) {
        const data = await response.json();
        setBackups(data.backups || []);
        setLastBackup(data.lastBackup);
      }
    } catch (error) {
      console.error('Failed to fetch backups:', error);
      toast.error('Failed to load backup history');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateNextBackup = () => {
    // Calculate next scheduled backup (daily at 2 AM)
    const now = new Date();
    const next = new Date();
    next.setHours(2, 0, 0, 0);
    
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    
    setNextBackup(next);
  };

  const createManualBackup = async () => {
    setIsCreatingBackup(true);
    try {
      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'manual-backup'}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Backup created successfully! Size: ${data.backup.size}`);
        fetchBackups();
      } else {
        throw new Error('Backup failed');
      }
    } catch (error) {
      console.error('Failed to create backup:', error);
      toast.error('Failed to create backup');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const downloadBackup = (backupId: string) => {
    // In production, this would download from cloud storage
    toast.success('Backup download started');
  };

  const restoreBackup = (backupId: string) => {
    if (confirm('Are you sure you want to restore this backup? This will overwrite current data.')) {
      toast.success('Backup restoration initiated');
      // In production, this would trigger a restoration process
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-green-500/20 text-green-400">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-500/20 text-red-400">
            <AlertCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            In Progress
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Backup Management</h1>
          <p className="text-gray-400">Automated database backups and recovery</p>
        </div>
        <Button
          onClick={createManualBackup}
          disabled={isCreatingBackup}
          className="gradient-primary text-white"
        >
          {isCreatingBackup ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating Backup...
            </>
          ) : (
            <>
              <Database className="w-4 h-4 mr-2" />
              Create Backup Now
            </>
          )}
        </Button>
      </div>

      {/* Backup Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <Shield className="w-4 h-4 mr-2 text-green-400" />
              Backup Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Auto Backup</span>
              <Badge className={autoBackupEnabled ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"}>
                {autoBackupEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <Clock className="w-4 h-4 mr-2 text-blue-400" />
              Last Backup
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-white">
              {lastBackup ? new Date(lastBackup).toLocaleString() : 'Never'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {lastBackup ? `${Math.floor((Date.now() - new Date(lastBackup).getTime()) / (1000 * 60 * 60))} hours ago` : 'No backups yet'}
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <Calendar className="w-4 h-4 mr-2 text-purple-400" />
              Next Backup
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-white">
              {nextBackup ? nextBackup.toLocaleString() : 'Not scheduled'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {nextBackup ? `In ${Math.floor((nextBackup.getTime() - Date.now()) / (1000 * 60 * 60))} hours` : ''}
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <HardDrive className="w-4 h-4 mr-2 text-yellow-400" />
              Total Backups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{backups.length}</p>
            <p className="text-xs text-gray-400 mt-1">Stored backups</p>
          </CardContent>
        </Card>
      </div>

      {/* Backup Settings */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="w-5 h-5 mr-2" />
            Backup Configuration
          </CardTitle>
          <CardDescription>Configure automated backup settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
              <div>
                <p className="font-medium text-white">Automated Daily Backups</p>
                <p className="text-sm text-gray-400">Backup database every day at 2:00 AM</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoBackupEnabled(!autoBackupEnabled)}
                className={autoBackupEnabled ? "border-green-400 text-green-400" : "border-gray-400"}
              >
                {autoBackupEnabled ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Disable
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Enable
                  </>
                )}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">Retention Period</p>
                <p className="text-lg font-medium text-white">30 Days</p>
              </div>
              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">Backup Location</p>
                <p className="text-lg font-medium text-white">Cloud Storage</p>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Backups include all user data, posts, campaigns, and analytics from the last 30 days.
                Older backups are automatically deleted after the retention period.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      {/* Backup History */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Archive className="w-5 h-5 mr-2" />
            Backup History
          </CardTitle>
          <CardDescription>Recent backups and restore points</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-8">
              <Database className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">No backups found</p>
              <p className="text-sm text-gray-500 mt-2">Create your first backup to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {backups.map((backup) => (
                <div key={backup.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <Database className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white">
                          Backup {new Date(backup.created_at).toLocaleDateString()}
                        </p>
                        {getStatusBadge(backup.status)}
                        <Badge variant="outline" className="text-xs">
                          {backup.type === 'scheduled' ? 'Auto' : 'Manual'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-400">
                        {new Date(backup.created_at).toLocaleTimeString()} • 
                        {backup.size_bytes ? ` ${formatBytes(backup.size_bytes)}` : ' Size unknown'}
                      </p>
                      {backup.statistics && (
                        <p className="text-xs text-gray-500 mt-1">
                          {backup.statistics.profileCount} users • 
                          {backup.statistics.postCount} posts • 
                          {backup.statistics.campaignCount} campaigns
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => downloadBackup(backup.id)}
                      className="text-gray-400 hover:text-white"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => restoreBackup(backup.id)}
                      className="text-gray-400 hover:text-white"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}