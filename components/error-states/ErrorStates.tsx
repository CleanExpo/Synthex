/**
 * Error State Components
 * Reusable error and empty state components for dashboard pages
 */

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  RefreshCw,
  FileX,
  WifiOff,
  ServerOff,
  SearchX,
  FolderOpen,
  Plus,
} from 'lucide-react';

interface ErrorCardProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function APIErrorCard({
  title = 'Something went wrong',
  message = 'Failed to load data. Please try again.',
  onRetry,
  retryLabel = 'Try Again',
}: ErrorCardProps) {
  return (
    <Card variant="glass" className="border-red-500/20">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="p-4 rounded-full bg-red-500/10 mb-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-gray-400 mb-6 max-w-md">{message}</p>
        {onRetry && (
          <Button onClick={onRetry} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            {retryLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function NetworkErrorCard({ onRetry }: { onRetry?: () => void }) {
  return (
    <Card variant="glass" className="border-yellow-500/20">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="p-4 rounded-full bg-yellow-500/10 mb-4">
          <WifiOff className="w-8 h-8 text-yellow-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No Internet Connection</h3>
        <p className="text-gray-400 mb-6 max-w-md">
          Please check your internet connection and try again.
        </p>
        {onRetry && (
          <Button onClick={onRetry} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function ServerErrorCard({ onRetry }: { onRetry?: () => void }) {
  return (
    <Card variant="glass" className="border-red-500/20">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="p-4 rounded-full bg-red-500/10 mb-4">
          <ServerOff className="w-8 h-8 text-red-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Server Error</h3>
        <p className="text-gray-400 mb-6 max-w-md">
          Our servers are experiencing issues. Please try again later.
        </p>
        {onRetry && (
          <Button onClick={onRetry} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Try Again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

interface EmptyStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: 'folder' | 'search' | 'file' | 'plus';
}

export function EmptyState({
  title = 'No data found',
  message = 'There is nothing to display here yet.',
  actionLabel,
  onAction,
  icon = 'folder',
}: EmptyStateProps) {
  const IconComponent = {
    folder: FolderOpen,
    search: SearchX,
    file: FileX,
    plus: Plus,
  }[icon];

  return (
    <Card variant="glass">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="p-4 rounded-full bg-white/5 mb-4">
          <IconComponent className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-gray-400 mb-6 max-w-md">{message}</p>
        {onAction && actionLabel && (
          <Button onClick={onAction} className="gradient-primary text-white gap-2">
            <Plus className="w-4 h-4" />
            {actionLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function NoResultsState({
  searchQuery,
  onClear,
}: {
  searchQuery?: string;
  onClear?: () => void;
}) {
  return (
    <Card variant="glass">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="p-4 rounded-full bg-white/5 mb-4">
          <SearchX className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No results found</h3>
        <p className="text-gray-400 mb-6 max-w-md">
          {searchQuery
            ? `No results found for "${searchQuery}". Try a different search term.`
            : 'Try adjusting your search or filters.'}
        </p>
        {onClear && (
          <Button onClick={onClear} variant="outline">
            Clear Filters
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

interface NotFoundStateProps {
  resource?: string;
  onBack?: () => void;
}

export function NotFoundState({ resource = 'page', onBack }: NotFoundStateProps) {
  return (
    <Card variant="glass">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="p-4 rounded-full bg-white/5 mb-4">
          <FileX className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">
          {resource.charAt(0).toUpperCase() + resource.slice(1)} Not Found
        </h3>
        <p className="text-gray-400 mb-6 max-w-md">
          The {resource} you're looking for doesn't exist or has been removed.
        </p>
        {onBack && (
          <Button onClick={onBack} variant="outline">
            Go Back
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default {
  APIErrorCard,
  NetworkErrorCard,
  ServerErrorCard,
  EmptyState,
  NoResultsState,
  NotFoundState,
};
