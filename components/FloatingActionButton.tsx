'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  X, 
  Edit, 
  Calendar, 
  TrendingUp, 
  Users,
  Sparkles,
  Camera,
  Mic,
  FileText,
  Link2,
  Hash,
  Image,
  Video,
  Send
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { notify } from '@/lib/notifications';
import { useRouter } from 'next/navigation';

interface FABAction {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  onClick: () => void;
}

export function FloatingActionButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();
  
  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // FAB Actions
  const actions: FABAction[] = [
    {
      id: 'create-post',
      label: 'Create Post',
      icon: Edit,
      color: 'bg-blue-500',
      onClick: () => {
        router.push('/create?type=post');
        setIsOpen(false);
        notify.success('Opening post creator...');
      }
    },
    {
      id: 'schedule',
      label: 'Schedule',
      icon: Calendar,
      color: 'bg-green-500',
      onClick: () => {
        router.push('/schedule');
        setIsOpen(false);
        notify.success('Opening scheduler...');
      }
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: TrendingUp,
      color: 'bg-cyan-500',
      onClick: () => {
        router.push('/analytics');
        setIsOpen(false);
      }
    },
    {
      id: 'ai-generate',
      label: 'AI Generate',
      icon: Sparkles,
      color: 'bg-pink-500',
      onClick: () => {
        router.push('/create?ai=true');
        setIsOpen(false);
        notify.custom('✨ AI Assistant ready!');
      }
    },
    {
      id: 'quick-photo',
      label: 'Photo',
      icon: Camera,
      color: 'bg-orange-500',
      onClick: () => {
        router.push('/create?type=photo');
        setIsOpen(false);
      }
    },
    {
      id: 'quick-video',
      label: 'Video',
      icon: Video,
      color: 'bg-red-500',
      onClick: () => {
        router.push('/create?type=video');
        setIsOpen(false);
      }
    }
  ];
  
  // Quick compose actions (simplified for mobile)
  const quickActions = [
    { icon: FileText, action: 'text' },
    { icon: Image, action: 'image' },
    { icon: Video, action: 'video' },
    { icon: Link2, action: 'link' },
    { icon: Hash, action: 'hashtag' }
  ];
  
  // Don't render on desktop
  if (!isMobile) return null;
  
  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>
      
      {/* Speed Dial Actions */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed bottom-24 right-6 z-50 space-y-3">
            {actions.map((action, index) => (
              <motion.div
                key={action.id}
                initial={{ opacity: 0, scale: 0, y: 20 }}
                animate={{ 
                  opacity: 1, 
                  scale: 1, 
                  y: 0,
                  transition: { delay: index * 0.05 }
                }}
                exit={{ 
                  opacity: 0, 
                  scale: 0, 
                  y: 20,
                  transition: { delay: (actions.length - index) * 0.02 }
                }}
                className="flex items-center justify-end gap-3"
              >
                <span className="text-sm font-medium text-white bg-black/70 px-3 py-1 rounded-full">
                  {action.label}
                </span>
                <button
                  onClick={action.onClick}
                  className={`
                    w-12 h-12 rounded-full ${action.color} 
                    flex items-center justify-center shadow-lg
                    transform transition-transform active:scale-95
                  `}
                >
                  <action.icon className="h-5 w-5 text-white" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
      
      {/* Main FAB Button */}
      <motion.button
        className={`
          fixed bottom-6 right-6 z-50
          w-14 h-14 rounded-full shadow-2xl
          flex items-center justify-center
          transform transition-all duration-200
          ${isOpen 
            ? 'bg-red-500 rotate-45' 
            : 'bg-gradient-to-r from-cyan-500 to-cyan-500'
          }
        `}
        onClick={() => setIsOpen(!isOpen)}
        whileTap={{ scale: 0.9 }}
      >
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.2 }}
        >
          {isOpen ? (
            <X className="h-6 w-6 text-white" />
          ) : (
            <Plus className="h-6 w-6 text-white" />
          )}
        </motion.div>
      </motion.button>
      
      {/* Quick Compose Bar (Alternative compact design) */}
      {!isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 left-6 right-20 z-40 md:hidden"
        >
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-full px-4 py-2 flex items-center justify-around">
            {quickActions.map((action) => (
              <button
                key={action.action}
                onClick={() => {
                  router.push(`/create?type=${action.action}`);
                  notify.custom(`Opening ${action.action} creator...`);
                }}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <action.icon className="h-5 w-5" />
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </>
  );
}

// Mini FAB for specific pages
export function MiniFAB({ 
  icon: Icon = Plus, 
  onClick,
  className = ''
}: { 
  icon?: React.ElementType;
  onClick: () => void;
  className?: string;
}) {
  return (
    <motion.button
      className={`
        fixed bottom-6 right-6 z-40
        w-12 h-12 rounded-full
        bg-cyan-500 shadow-lg
        flex items-center justify-center
        md:hidden
        ${className}
      `}
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
    >
      <Icon className="h-5 w-5 text-white" />
    </motion.button>
  );
}

// Context-aware FAB
export function SmartFAB({ context }: { context?: string }) {
  const [suggestion, setSuggestion] = useState<string>('');
  const router = useRouter();
  
  useEffect(() => {
    // Smart suggestions based on context
    const hour = new Date().getHours();
    
    if (context === 'dashboard') {
      if (hour < 12) {
        setSuggestion('Schedule morning posts');
      } else if (hour < 17) {
        setSuggestion('Check analytics');
      } else {
        setSuggestion('Plan tomorrow');
      }
    } else if (context === 'analytics') {
      setSuggestion('Create viral content');
    } else if (context === 'schedule') {
      setSuggestion('Fill content gaps');
    }
  }, [context]);
  
  if (!suggestion) return <FloatingActionButton />;
  
  return (
    <div className="fixed bottom-20 right-6 z-40 md:hidden">
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] px-4 py-2 rounded-full flex items-center gap-2 mb-2"
      >
        <Sparkles className="h-4 w-4 text-cyan-400" />
        <span className="text-sm text-white">{suggestion}</span>
      </motion.div>
      <FloatingActionButton />
    </div>
  );
}

// Draggable FAB
export function DraggableFAB() {
  const [position, setPosition] = useState({ x: -70, y: -100 });
  const [isDragging, setIsDragging] = useState(false);
  
  return (
    <motion.div
      className="fixed bottom-20 right-20 z-50 md:hidden"
      drag
      dragConstraints={{
        left: -window.innerWidth + 100,
        right: 0,
        top: -window.innerHeight + 200,
        bottom: 0
      }}
      dragElastic={0.2}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={(e, info) => {
        setIsDragging(false);
        setPosition({ x: info.offset.x, y: info.offset.y });
      }}
      animate={position}
      whileDrag={{ scale: 1.1 }}
    >
      <div className={`
        w-14 h-14 rounded-full
        bg-gradient-to-r from-cyan-500 to-cyan-500
        shadow-2xl flex items-center justify-center
        ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}
      `}>
        <Plus className="h-6 w-6 text-white" />
      </div>
    </motion.div>
  );
}