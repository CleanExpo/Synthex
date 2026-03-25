'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

// CSS for floating animation and gradient borders
const styles = `
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-8px); }
  }
  .float-animation {
    animation: float 3s ease-in-out infinite;
  }
  @keyframes gradientShift {
    0% { border-color: rgba(255, 107, 53, 0.4); }
    25% { border-color: rgba(255, 214, 10, 0.4); }
    50% { border-color: rgba(52, 211, 153, 0.4); }
    75% { border-color: rgba(244, 114, 182, 0.4); }
    100% { border-color: rgba(255, 107, 53, 0.4); }
  }
  .gradient-border-hover:hover {
    animation: gradientShift 3s ease infinite;
  }
`;

// MediaItemType defines the structure of a media item
interface MediaItemType {
  id: number;
  type: string;
  title: string;
  desc: string;
  url: string;
  span: string;
}

// MediaItem component renders either a video or image based on item.type
const MediaItem = ({
  item,
  className,
  onClick,
}: {
  item: MediaItemType;
  className?: string;
  onClick?: () => void;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '50px',
      threshold: 0.1,
    };

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        setIsInView(entry.isIntersecting);
      });
    }, options);

    const node = videoRef.current;
    if (node) {
      observer.observe(node);
    }

    return () => {
      if (node) {
        observer.unobserve(node);
      }
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const handleVideoPlay = async () => {
      if (!videoRef.current || !isInView || !mounted) return;

      try {
        if (videoRef.current.readyState >= 3) {
          setIsBuffering(false);
          await videoRef.current.play();
        } else {
          setIsBuffering(true);
          await new Promise(resolve => {
            if (videoRef.current) {
              videoRef.current.oncanplay = resolve;
            }
          });
          if (mounted) {
            setIsBuffering(false);
            await videoRef.current.play();
          }
        }
      } catch (error) {
        console.warn('Video playback failed:', error);
      }
    };

    if (isInView) {
      handleVideoPlay();
    } else if (videoRef.current) {
      videoRef.current.pause();
    }

    const node = videoRef.current;
    return () => {
      mounted = false;
      if (node) {
        node.pause();
        node.removeAttribute('src');
        node.load();
      }
    };
  }, [isInView]);

  if (item.type === 'video') {
    return (
      <div className={cn('relative overflow-hidden', className)}>
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          onClick={onClick}
          playsInline
          muted
          loop
          preload="auto"
          style={{
            opacity: isBuffering ? 0.8 : 1,
            transition: 'opacity 0.2s',
            transform: 'translateZ(0)',
            willChange: 'transform',
          }}
        >
          <source src={item.url} type="video/mp4" />
        </video>
        {isBuffering && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>
    );
  }

  return (
    <img
      src={item.url}
      alt={item.title}
      className={cn('object-cover cursor-pointer', className)}
      onClick={onClick}
      loading="lazy"
      decoding="async"
    />
  );
};

// GalleryModal component displays the selected media item in a modal
interface GalleryModalProps {
  selectedItem: MediaItemType;
  isOpen: boolean;
  onClose: () => void;
  setSelectedItem: (item: MediaItemType | null) => void;
  mediaItems: MediaItemType[];
}

const GalleryModal = ({
  selectedItem,
  isOpen,
  onClose,
  setSelectedItem,
  mediaItems,
}: GalleryModalProps) => {
  const [dockPosition, setDockPosition] = useState({ x: 0, y: 0 });

  if (!isOpen) return null;

  return (
    <>
      {/* Main Modal */}
      <div
        className="fixed inset-0 w-full min-h-screen sm:h-[90vh] md:h-[600px] backdrop-blur-lg
                   rounded-none sm:rounded-lg md:rounded-xl overflow-hidden z-10
                   bg-[#080e1a]/90 border-[0.5px] border-white/[0.06]"
      >
        {/* Main Content */}
        <div className="h-full flex flex-col">
          <div className="flex-1 p-2 sm:p-3 md:p-4 flex items-center justify-center bg-[#0a1628]/50">
            <div
              key={selectedItem.id}
              className="relative w-full aspect-[16/9] max-w-[95%] sm:max-w-[85%] md:max-w-3xl
                         h-auto max-h-[70vh] rounded-sm overflow-hidden shadow-md
                         border-[0.5px] border-white/[0.06]"
              onClick={onClose}
            >
              <MediaItem
                item={selectedItem}
                className="w-full h-full object-contain bg-[#0a1628]/20"
                onClick={onClose}
              />
              <div
                className="absolute bottom-0 left-0 right-0 p-2 sm:p-3 md:p-4
                              bg-gradient-to-t from-black/70 to-transparent"
              >
                <h3 className="text-white text-base sm:text-lg md:text-xl font-semibold">
                  {selectedItem.title}
                </h3>
                <p className="text-white/60 text-xs sm:text-sm mt-1">
                  {selectedItem.desc}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Close Button */}
        <button
          className="absolute top-2 sm:top-2.5 md:top-3 right-2 sm:right-2.5 md:right-3
                     p-2 rounded-full bg-white/[0.08] text-white/60 hover:bg-white/[0.12] hover:scale-110
                     text-xs sm:text-sm backdrop-blur-sm border-[0.5px] border-white/[0.06] transition-transform"
          onClick={onClose}
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Dock */}
      <div
        className="fixed z-50 left-1/2 bottom-4 -translate-x-1/2 touch-none"
        style={{
          transform: `translateX(calc(-50% + ${dockPosition.x}px)) translateY(${dockPosition.y}px)`,
        }}
      >
        <div
          className="relative rounded-sm backdrop-blur-xl cursor-grab active:cursor-grabbing"
          style={{
            background:
              'linear-gradient(135deg, rgba(255,107,53,0.1) 0%, rgba(244,114,182,0.08) 100%)',
            border: '1px solid rgba(255,107,53,0.4)',
            boxShadow: '0 0 30px rgba(255,107,53,0.3)',
          }}
        >
          <div className="flex items-center -space-x-2 px-3 py-2">
            {mediaItems.map((item, index) => (
              <div
                key={item.id}
                onClick={e => {
                  e.stopPropagation();
                  setSelectedItem(item);
                }}
                className={cn(
                  'relative group w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 flex-shrink-0',
                  'rounded-sm overflow-hidden cursor-pointer hover:z-20 hover:scale-110 transition-transform'
                )}
                style={{
                  zIndex:
                    selectedItem.id === item.id
                      ? 30
                      : mediaItems.length - index,
                  border:
                    selectedItem.id === item.id
                      ? '2px solid #FF6B35'
                      : '1px solid rgba(255,107,53,0.2)',
                  boxShadow:
                    selectedItem.id === item.id
                      ? '0 0 15px rgba(255,107,53,0.6)'
                      : 'none',
                }}
              >
                <MediaItem
                  item={item}
                  className="w-full h-full"
                  onClick={() => setSelectedItem(item)}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-white/20" />
                {selectedItem.id === item.id && (
                  <div className="absolute -inset-2 bg-orange-400/20 blur-xl" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

interface InteractiveBentoGalleryProps {
  mediaItems: MediaItemType[];
  title: string;
  description: string;
}

const InteractiveBentoGallery: React.FC<InteractiveBentoGalleryProps> = ({
  mediaItems,
  title,
  description,
}) => {
  const [selectedItem, setSelectedItem] = useState<MediaItemType | null>(null);
  const [items, setItems] = useState(mediaItems);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
    return () => styleSheet.remove();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8 text-center">
        <h1
          className="text-2xl sm:text-3xl md:text-4xl font-bold bg-clip-text text-transparent
                     bg-gradient-to-r from-white via-orange-400 to-white"
        >
          {title}
        </h1>
        <p className="mt-2 text-sm sm:text-base text-white/60">{description}</p>
      </div>

      {selectedItem ? (
        <GalleryModal
          selectedItem={selectedItem}
          isOpen={true}
          onClose={() => setSelectedItem(null)}
          setSelectedItem={setSelectedItem}
          mediaItems={items}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3 auto-rows-[60px]">
          {items.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                'relative overflow-hidden rounded-sm cursor-pointer group',
                'gradient-border-hover',
                item.span
              )}
              onClick={() => !isDragging && setSelectedItem(item)}
              style={{
                background:
                  'linear-gradient(135deg, rgba(18,18,30,0.6) 0%, rgba(26,15,35,0.5) 100%)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,107,53,0.3)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              }}
            >
              <MediaItem
                item={item}
                className="absolute inset-0 w-full h-full"
                onClick={() => !isDragging && setSelectedItem(item)}
              />
              <div className="absolute inset-0 flex flex-col justify-end p-2 sm:p-3 md:p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="absolute inset-0 flex flex-col justify-end p-2 sm:p-3 md:p-4">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                  <h3 className="relative text-white text-xs sm:text-sm md:text-base font-medium line-clamp-1">
                    {item.title}
                  </h3>
                  <p className="relative text-white/60 text-[10px] sm:text-xs md:text-sm mt-0.5 line-clamp-2">
                    {item.desc}
                  </p>
                </div>
              </div>

              {/* Candy glow effect on hover */}
              <div
                className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(255,107,53,0.1) 0%, rgba(244,114,182,0.08) 100%)',
                  boxShadow: 'inset 0 0 20px rgba(255,107,53,0.3)',
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InteractiveBentoGallery;
