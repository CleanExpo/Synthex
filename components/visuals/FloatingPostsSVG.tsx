'use client';

import { useState, useEffect } from 'react';
import { Heart, MessageCircle, Share2, Bookmark } from '@/components/icons';

interface Post {
  id: number;
  username: string;
  handle: string;
  content: string;
  likes: string;
  comments: string;
  shares: string;
  verified: boolean;
  gradient: string;
  offset: number;
}

const posts: Post[] = [
  {
    id: 1,
    username: 'TechCEO',
    handle: '@techceo',
    content: 'Just launched our new AI features! The engagement metrics are through the roof 🚀 Thanks to @SYNTHEX',
    likes: '12.5K',
    comments: '342',
    shares: '1.2K',
    verified: true,
    gradient: 'from-cyan-500 to-cyan-600',
    offset: 0,
  },
  {
    id: 2,
    username: 'MarketingPro',
    handle: '@marketingpro',
    content: 'Stop paying agencies $10K/month. Started using SYNTHEX last month and our engagement is up 300%.',
    likes: '8.3K',
    comments: '189',
    shares: '567',
    verified: false,
    gradient: 'from-pink-500 to-rose-600',
    offset: 1.5,
  },
  {
    id: 3,
    username: 'StartupFounder',
    handle: '@founder',
    content: 'The AI-generated content is indistinguishable from human writing. Game changer. 🔥',
    likes: '15.7K',
    comments: '423',
    shares: '2.1K',
    verified: true,
    gradient: 'from-cyan-500 to-blue-600',
    offset: 3,
  },
];

function PostCard({ post, index }: { post: Post; index: number }) {
  const [liked, setLiked] = useState(false);
  const [floatY, setFloatY] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFloatY(Math.sin(Date.now() / 1000 + post.offset) * 10);
    }, 50);
    return () => clearInterval(interval);
  }, [post.offset]);

  const rotation = index === 0 ? 'rotate-[-5deg]' : index === 2 ? 'rotate-[5deg]' : '';
  const scale = index === 1 ? 'scale-105 z-20' : 'z-10';

  return (
    <div
      className={`relative ${rotation} ${scale} transition-all duration-300 hover:scale-110 hover:z-30`}
      style={{ transform: `translateY(${floatY}px)` }}
    >
      {/* Glow effect */}
      <div className={`absolute -inset-4 bg-gradient-to-r ${post.gradient} rounded-3xl blur-2xl opacity-30`} />

      {/* Card */}
      <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-2xl p-6 border border-white/10 w-[320px] shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${post.gradient}`} />
          <div className="flex-1">
            <div className="flex items-center gap-1">
              <span className="font-bold text-white">{post.username}</span>
              {post.verified && (
                <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                </svg>
              )}
            </div>
            <span className="text-slate-400 text-sm">{post.handle}</span>
          </div>
        </div>

        {/* Content */}
        <p className="text-white/90 text-sm leading-relaxed mb-4">{post.content}</p>

        {/* Engagement */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <button
            className={`flex items-center gap-2 transition-all ${liked ? 'text-red-500 scale-110' : 'text-slate-400 hover:text-red-500'}`}
            onClick={() => setLiked(!liked)}
          >
            <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
            <span className="text-sm">{post.likes}</span>
          </button>
          <button className="flex items-center gap-2 text-slate-400 hover:text-blue-400 transition-colors">
            <MessageCircle className="w-5 h-5" />
            <span className="text-sm">{post.comments}</span>
          </button>
          <button className="flex items-center gap-2 text-slate-400 hover:text-green-400 transition-colors">
            <Share2 className="w-5 h-5" />
            <span className="text-sm">{post.shares}</span>
          </button>
          <button className="text-slate-400 hover:text-cyan-400 transition-colors">
            <Bookmark className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FloatingPostsSVG() {
  return (
    <div className="w-full h-[600px] relative rounded-2xl overflow-hidden bg-surface-void">
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.3),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_80%_80%,rgba(217,70,239,0.15),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_20%_80%,rgba(59,130,246,0.15),transparent)]" />
      </div>

      {/* Particle ring effect */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(30)].map((_, i) => {
          const angle = (i / 30) * Math.PI * 2;
          const radius = 280 + Math.random() * 40;
          const x = 50 + Math.cos(angle) * (radius / 8);
          const y = 50 + Math.sin(angle) * (radius / 10);
          return (
            <div
              key={i}
              className="absolute w-1 h-1 bg-cyan-400 rounded-full animate-pulse"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                opacity: 0.4,
                animationDelay: `${i * 0.1}s`,
              }}
            />
          );
        })}
      </div>

      {/* Floating cards */}
      <div className="relative z-10 h-full flex items-center justify-center gap-8 px-8">
        {posts.map((post, i) => (
          <PostCard key={post.id} post={post} index={i} />
        ))}
      </div>

      {/* Bottom label */}
      <div className="absolute bottom-4 left-4 right-4 text-center pointer-events-none z-20">
        <p className="text-white/60 text-sm backdrop-blur-sm bg-black/20 rounded-full px-4 py-2 inline-block">
          Hover to interact • Click hearts to like • Real engagement visualization
        </p>
      </div>
    </div>
  );
}
