'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageOff, ZoomIn } from 'lucide-react';
import { fadeIn } from '@/lib/animations';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  quality?: number;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  onLoad?: () => void;
  onError?: () => void;
  onClick?: () => void;
  sizes?: string;
  aspectRatio?: string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  lazy?: boolean;
  zoomable?: boolean;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  quality = 75,
  placeholder = 'empty',
  blurDataURL,
  onLoad,
  onError,
  onClick,
  sizes,
  aspectRatio = '16/9',
  objectFit = 'cover',
  lazy = true,
  zoomable = false
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!lazy || priority) {
      setIsInView(true);
      return;
    }
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px'
      }
    );
    
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    return () => observer.disconnect();
  }, [lazy, priority]);
  
  // Generate srcset for responsive images
  const generateSrcSet = () => {
    if (!width) return undefined;
    
    const widths = [320, 640, 768, 1024, 1280, 1536];
    return widths
      .filter(w => w <= width)
      .map(w => `${getOptimizedUrl(src, w, quality)} ${w}w`)
      .join(', ');
  };
  
  // Get optimized image URL (in production, this would use a CDN)
  const getOptimizedUrl = (url: string, width: number, quality: number) => {
    // Example with Cloudinary or similar service
    // return `https://res.cloudinary.com/your-cloud/image/upload/w_${width},q_${quality}/v1/${url}`;
    return url; // For now, return original URL
  };
  
  const handleLoad = () => {
    setLoaded(true);
    onLoad?.();
  };
  
  const handleError = () => {
    setError(true);
    onError?.();
  };
  
  const handleClick = () => {
    if (zoomable) {
      setIsZoomed(!isZoomed);
    }
    onClick?.();
  };
  
  // Error state
  if (error) {
    return (
      <div 
        className={`flex items-center justify-center bg-white/5 rounded-lg ${className}`}
        style={{ aspectRatio }}
      >
        <div className="text-center p-4">
          <ImageOff className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-xs text-gray-400">Failed to load image</p>
        </div>
      </div>
    );
  }
  
  return (
    <>
      <div 
        ref={containerRef}
        className={`relative overflow-hidden ${className} ${zoomable ? 'cursor-zoom-in' : ''}`}
        style={{ aspectRatio }}
        onClick={handleClick}
      >
        {/* Placeholder/Skeleton */}
        {!loaded && (
          <div className="absolute inset-0">
            {placeholder === 'blur' && blurDataURL ? (
              <img
                src={blurDataURL}
                alt=""
                className="w-full h-full object-cover filter blur-lg"
              />
            ) : (
              <Skeleton className="w-full h-full" />
            )}
          </div>
        )}
        
        {/* Main Image */}
        {isInView && (
          <motion.img
            ref={imgRef}
            src={src}
            alt={alt}
            width={width}
            height={height}
            loading={lazy && !priority ? 'lazy' : 'eager'}
            decoding="async"
            sizes={sizes}
            srcSet={generateSrcSet()}
            className={`
              w-full h-full
              ${loaded ? 'opacity-100' : 'opacity-0'}
              transition-opacity duration-300
              object-${objectFit}
            `}
            onLoad={handleLoad}
            onError={handleError}
            variants={fadeIn}
            initial="hidden"
            animate={loaded ? "visible" : "hidden"}
          />
        )}
        
        {/* Zoom indicator */}
        {zoomable && loaded && (
          <div className="absolute top-2 right-2 p-2 bg-black/50 rounded-lg opacity-0 hover:opacity-100 transition-opacity">
            <ZoomIn className="h-4 w-4 text-white" />
          </div>
        )}
      </div>
      
      {/* Zoomed view modal */}
      {isZoomed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setIsZoomed(false)}
        >
          <motion.img
            src={src}
            alt={alt}
            className="max-w-full max-h-full object-contain"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.8 }}
          />
        </motion.div>
      )}
    </>
  );
}

// Image gallery with optimization
export function ImageGallery({ 
  images,
  columns = 3,
  gap = 4
}: { 
  images: { src: string; alt: string }[];
  columns?: number;
  gap?: number;
}) {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  
  return (
    <>
      <div 
        className={`grid grid-cols-${columns} gap-${gap}`}
        style={{
          gridTemplateColumns: `repeat(${columns}, 1fr)`
        }}
      >
        {images.map((image, index) => (
          <OptimizedImage
            key={index}
            src={image.src}
            alt={image.alt}
            className="rounded-lg hover:scale-105 transition-transform cursor-pointer"
            onClick={() => setSelectedImage(index)}
            lazy
          />
        ))}
      </div>
      
      {/* Lightbox */}
      {selectedImage !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setSelectedImage(null)}
        >
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.8 }}
            className="relative max-w-7xl max-h-[90vh] p-4"
          >
            <img
              src={images[selectedImage].src}
              alt={images[selectedImage].alt}
              className="max-w-full max-h-full object-contain"
            />
            
            {/* Navigation */}
            {selectedImage > 0 && (
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImage(selectedImage - 1);
                }}
              >
                ←
              </button>
            )}
            
            {selectedImage < images.length - 1 && (
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImage(selectedImage + 1);
                }}
              >
                →
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </>
  );
}

// Avatar with optimization
export function OptimizedAvatar({
  src,
  alt,
  size = 40,
  fallback,
  className = ''
}: {
  src?: string;
  alt: string;
  size?: number;
  fallback?: string;
  className?: string;
}) {
  const [error, setError] = useState(false);
  
  if (!src || error) {
    return (
      <div 
        className={`flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 text-white font-semibold rounded-full ${className}`}
        style={{ width: size, height: size }}
      >
        {fallback || alt.charAt(0).toUpperCase()}
      </div>
    );
  }
  
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`rounded-full ${className}`}
      objectFit="cover"
      onError={() => setError(true)}
      priority
    />
  );
}

// Background image with optimization
export function OptimizedBackground({
  src,
  children,
  className = '',
  overlay = true,
  parallax = false
}: {
  src: string;
  children: React.ReactNode;
  className?: string;
  overlay?: boolean;
  parallax?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Background image */}
      <div 
        className={`absolute inset-0 ${parallax ? 'fixed' : ''}`}
        style={{
          transform: parallax ? 'translateZ(-1px) scale(2)' : undefined
        }}
      >
        <OptimizedImage
          src={src}
          alt=""
          className="w-full h-full"
          objectFit="cover"
          onLoad={() => setLoaded(true)}
          priority
        />
        
        {/* Overlay */}
        {overlay && (
          <div className="absolute inset-0 bg-black/50" />
        )}
      </div>
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}