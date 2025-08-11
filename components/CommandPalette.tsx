'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  FileText, 
  BarChart3, 
  Calendar, 
  Settings,
  User,
  Plus,
  Sparkles,
  TrendingUp,
  LogOut,
  Home,
  Command,
  ArrowRight
} from 'lucide-react';
import { notify } from '@/lib/notifications';

interface CommandItem {
  id: string;
  title: string;
  description?: string;
  icon: React.ElementType;
  action: () => void;
  category: 'navigation' | 'actions' | 'settings' | 'help';
  keywords: string[];
}

export function CommandPalette() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  
  const commands: CommandItem[] = [
    // Navigation
    {
      id: 'dashboard',
      title: 'Go to Dashboard',
      icon: Home,
      action: () => router.push('/dashboard'),
      category: 'navigation',
      keywords: ['home', 'dashboard', 'main']
    },
    {
      id: 'content',
      title: 'Content Generator',
      icon: FileText,
      action: () => router.push('/dashboard/content'),
      category: 'navigation',
      keywords: ['content', 'generate', 'create', 'write']
    },
    {
      id: 'analytics',
      title: 'Analytics',
      icon: BarChart3,
      action: () => router.push('/dashboard/analytics'),
      category: 'navigation',
      keywords: ['analytics', 'stats', 'metrics', 'data']
    },
    {
      id: 'schedule',
      title: 'Schedule',
      icon: Calendar,
      action: () => router.push('/dashboard/schedule'),
      category: 'navigation',
      keywords: ['schedule', 'calendar', 'plan']
    },
    
    // Actions
    {
      id: 'new-content',
      title: 'Create New Content',
      description: 'Generate AI-powered content',
      icon: Plus,
      action: () => {
        router.push('/dashboard/content');
        notify.custom('Ready to create amazing content! ✨');
      },
      category: 'actions',
      keywords: ['new', 'create', 'generate', 'ai']
    },
    {
      id: 'analyze-trends',
      title: 'Analyze Viral Trends',
      description: 'Discover what\'s trending now',
      icon: TrendingUp,
      action: () => {
        router.push('/dashboard/patterns');
        notify.loading('Analyzing trending patterns...');
      },
      category: 'actions',
      keywords: ['trends', 'viral', 'popular', 'analyze']
    },
    {
      id: 'quick-post',
      title: 'Quick Post',
      description: 'Post to all platforms',
      icon: Sparkles,
      action: () => {
        // Open quick post modal
        const event = new CustomEvent('openQuickPost');
        window.dispatchEvent(event);
      },
      category: 'actions',
      keywords: ['post', 'quick', 'publish', 'share']
    },
    
    // Settings
    {
      id: 'settings',
      title: 'Settings',
      icon: Settings,
      action: () => router.push('/dashboard/settings'),
      category: 'settings',
      keywords: ['settings', 'preferences', 'config']
    },
    {
      id: 'profile',
      title: 'Profile',
      icon: User,
      action: () => router.push('/dashboard/settings#profile'),
      category: 'settings',
      keywords: ['profile', 'account', 'user']
    },
    {
      id: 'logout',
      title: 'Sign Out',
      icon: LogOut,
      action: () => {
        localStorage.clear();
        notify.logoutSuccess();
        router.push('/login');
      },
      category: 'settings',
      keywords: ['logout', 'signout', 'exit']
    },
  ];
  
  // Filter commands based on search
  const filteredCommands = commands.filter(cmd => {
    const searchLower = search.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(searchLower) ||
      cmd.description?.toLowerCase().includes(searchLower) ||
      cmd.keywords.some(k => k.includes(searchLower))
    );
  });
  
  // Group commands by category
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, CommandItem[]>);
  
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen(true);
      }
      
      if (!isOpen) return;
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            setIsOpen(false);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          break;
      }
    };
    
    // Custom event listener for opening
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('openCommandPalette', handleOpen);
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('openCommandPalette', handleOpen);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, selectedIndex, filteredCommands]);
  
  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setSearch('');
      setSelectedIndex(0);
    }
  }, [isOpen]);
  
  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = listRef.current?.children[selectedIndex] as HTMLElement;
    selectedElement?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);
  
  if (!isOpen) return null;
  
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Command Palette */}
      <div className="fixed top-1/4 left-1/2 transform -translate-x-1/2 w-full max-w-2xl z-50">
        <div className="glass-card rounded-xl shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center border-b border-white/10 px-4">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type a command or search..."
              className="flex-1 px-4 py-4 bg-transparent text-white placeholder-gray-400 focus:outline-none"
            />
            <kbd className="px-2 py-1 text-xs bg-gray-800 rounded">ESC</kbd>
          </div>
          
          {/* Commands List */}
          <div ref={listRef} className="max-h-96 overflow-y-auto p-2">
            {Object.entries(groupedCommands).map(([category, items]) => (
              <div key={category} className="mb-4">
                <div className="px-2 py-1 text-xs text-gray-500 uppercase">
                  {category}
                </div>
                {items.map((cmd, idx) => {
                  const Icon = cmd.icon;
                  const isSelected = filteredCommands.indexOf(cmd) === selectedIndex;
                  
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => {
                        cmd.action();
                        setIsOpen(false);
                      }}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left
                        transition-colors duration-150
                        ${isSelected 
                          ? 'bg-purple-500/20 text-white' 
                          : 'text-gray-300 hover:bg-white/5 hover:text-white'
                        }
                      `}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{cmd.title}</div>
                        {cmd.description && (
                          <div className="text-xs text-gray-500 truncate">
                            {cmd.description}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
            
            {filteredCommands.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No commands found for "{search}"
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="border-t border-white/10 px-4 py-2 flex items-center justify-between text-xs text-gray-500">
            <div className="flex gap-4">
              <span><kbd>↑↓</kbd> Navigate</span>
              <span><kbd>↵</kbd> Select</span>
              <span><kbd>ESC</kbd> Close</span>
            </div>
            <div className="flex items-center gap-1">
              <Command className="w-3 h-3" />
              <span>+K</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}