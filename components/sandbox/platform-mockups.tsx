'use client';

/**
 * Platform Mockups Component
 * Platform-specific post mockups (Twitter, Instagram, LinkedIn, etc.)
 */

import {
  Image as ImageIcon,
  Video,
  MessageSquare,
  Heart,
  Repeat,
  Bookmark,
  Send,
  MoreHorizontal,
  CheckCircle,
} from '@/components/icons';
import { platformConfigs } from './sandbox-config';
import type { MediaType } from './types';

interface PlatformMockupProps {
  platform: string;
  content: string;
  mediaType: MediaType;
}

function TwitterMockup({ content, mediaType }: { content: string; mediaType: MediaType }) {
  return (
    <div className="bg-black rounded-lg p-4">
      <div className="flex items-start space-x-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500"></div>
        <div className="flex-1">
          <div className="flex items-center space-x-1">
            <span className="font-bold text-white">Your Name</span>
            <CheckCircle className="h-4 w-4 text-blue-400" />
            <span className="text-gray-500">@username · now</span>
          </div>
          <div className="mt-2 text-white whitespace-pre-wrap">
            {content || 'Your content will appear here...'}
          </div>
          {mediaType !== 'none' && (
            <div className="mt-3 bg-gray-800 rounded-lg h-48 flex items-center justify-center">
              {mediaType === 'image' && <ImageIcon className="h-12 w-12 text-gray-600" />}
              {mediaType === 'video' && <Video className="h-12 w-12 text-gray-600" />}
            </div>
          )}
          <div className="mt-3 flex items-center space-x-6 text-gray-500">
            <button className="flex items-center space-x-1 hover:text-blue-400">
              <MessageSquare className="h-5 w-5" />
              <span className="text-sm">0</span>
            </button>
            <button className="flex items-center space-x-1 hover:text-green-400">
              <Repeat className="h-5 w-5" />
              <span className="text-sm">0</span>
            </button>
            <button className="flex items-center space-x-1 hover:text-red-400">
              <Heart className="h-5 w-5" />
              <span className="text-sm">0</span>
            </button>
            <button className="flex items-center space-x-1 hover:text-blue-400">
              <Bookmark className="h-5 w-5" />
            </button>
            <button className="flex items-center space-x-1 hover:text-blue-400">
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
        <button className="text-gray-500 hover:text-white">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function InstagramMockup({ content, mediaType }: { content: string; mediaType: MediaType }) {
  return (
    <div className="bg-white rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500"></div>
          <span className="font-semibold text-sm">username</span>
        </div>
        <MoreHorizontal className="h-5 w-5 text-gray-700" />
      </div>
      {mediaType !== 'none' ? (
        <div className="bg-gray-200 h-96 flex items-center justify-center">
          {mediaType === 'image' && <ImageIcon className="h-16 w-16 text-gray-400" />}
          {mediaType === 'video' && <Video className="h-16 w-16 text-gray-400" />}
        </div>
      ) : (
        <div className="bg-gradient-to-br from-cyan-500 to-teal-500 h-96 flex items-center justify-center">
          <p className="text-white text-center px-4">{content || 'Your content preview'}</p>
        </div>
      )}
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-3">
            <Heart className="h-6 w-6" />
            <MessageSquare className="h-6 w-6" />
            <Send className="h-6 w-6" />
          </div>
          <Bookmark className="h-6 w-6" />
        </div>
        <p className="font-semibold text-sm mb-1">0 likes</p>
        <p className="text-sm">
          <span className="font-semibold">username</span> {content || 'Caption here...'}
        </p>
      </div>
    </div>
  );
}

function LinkedInMockup({ content, mediaType }: { content: string; mediaType: MediaType }) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-start space-x-3">
        <div className="w-12 h-12 rounded-full bg-blue-600"></div>
        <div className="flex-1">
          <div>
            <p className="font-semibold">Your Name</p>
            <p className="text-sm text-gray-600">Professional Title</p>
            <p className="text-xs text-gray-500">now · 🌐</p>
          </div>
          <div className="mt-3 text-gray-900 whitespace-pre-wrap">
            {content || 'Your professional content will appear here...'}
          </div>
          {mediaType !== 'none' && (
            <div className="mt-3 bg-gray-100 rounded-lg h-48 flex items-center justify-center border">
              {mediaType === 'image' && <ImageIcon className="h-12 w-12 text-gray-400" />}
              {mediaType === 'video' && <Video className="h-12 w-12 text-gray-400" />}
            </div>
          )}
          <div className="mt-3 pt-3 border-t flex items-center justify-between text-gray-600">
            <div className="flex items-center space-x-4">
              <button className="flex items-center space-x-1 hover:text-blue-600">
                <span className="text-sm">👍 Like</span>
              </button>
              <button className="flex items-center space-x-1 hover:text-blue-600">
                <span className="text-sm">💬 Comment</span>
              </button>
              <button className="flex items-center space-x-1 hover:text-blue-600">
                <span className="text-sm">🔄 Repost</span>
              </button>
              <button className="flex items-center space-x-1 hover:text-blue-600">
                <span className="text-sm">📤 Send</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DefaultMockup({ platform, content }: { platform: string; content: string }) {
  const config = platformConfigs[platform];
  return (
    <div className={`${config.mockupBg} rounded-lg p-6`}>
      <p className={`${config.textColor} whitespace-pre-wrap`}>
        {content || 'Your content will appear here...'}
      </p>
    </div>
  );
}

export function PlatformMockup({ platform, content, mediaType }: PlatformMockupProps) {
  switch (platform) {
    case 'twitter':
      return <TwitterMockup content={content} mediaType={mediaType} />;
    case 'instagram':
      return <InstagramMockup content={content} mediaType={mediaType} />;
    case 'linkedin':
      return <LinkedInMockup content={content} mediaType={mediaType} />;
    default:
      return <DefaultMockup platform={platform} content={content} />;
  }
}
