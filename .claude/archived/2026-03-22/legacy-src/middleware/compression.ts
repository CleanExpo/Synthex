import { Request, Response, NextFunction } from 'express';
import { createGzip, createDeflate, createBrotliCompress } from 'zlib';

// Compression configuration
interface CompressionOptions {
  threshold?: number; // Minimum response size to compress (bytes)
  level?: number; // Compression level (1-9 for gzip/deflate, 0-11 for brotli)
  filter?: (req: Request, res: Response) => boolean;
  chunkSize?: number;
}

const defaultOptions: CompressionOptions = {
  threshold: 1024, // 1KB minimum
  level: 6, // Balanced compression
  chunkSize: 16 * 1024, // 16KB chunks
  filter: (req, res) => {
    // Don't compress if response is already encoded
    if (res.getHeader('Content-Encoding')) {
      return false;
    }
    
    // Don't compress images, videos, or already compressed files
    const contentType = res.getHeader('Content-Type') as string;
    if (contentType) {
      const compressibleTypes = [
        'text/',
        'application/json',
        'application/javascript',
        'application/xml',
        'application/rss+xml',
        'application/atom+xml',
        'application/xhtml+xml'
      ];
      
      return compressibleTypes.some(type => contentType.includes(type));
    }
    
    return true;
  }
};

/**
 * Smart compression middleware that chooses best algorithm based on client support
 */
export function compressionMiddleware(options: CompressionOptions = {}) {
  const config = { ...defaultOptions, ...options };
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip compression if filter says no
    if (config.filter && !config.filter(req, res)) {
      return next();
    }
    
    // Get accepted encodings from client
    const acceptEncoding = req.get('Accept-Encoding') || '';
    
    // Determine best compression method
    let compressionMethod: 'br' | 'gzip' | 'deflate' | null = null;
    
    if (acceptEncoding.includes('br')) {
      compressionMethod = 'br'; // Brotli - best compression
    } else if (acceptEncoding.includes('gzip')) {
      compressionMethod = 'gzip'; // Good compression, widely supported
    } else if (acceptEncoding.includes('deflate')) {
      compressionMethod = 'deflate'; // Basic compression
    }
    
    if (!compressionMethod) {
      return next(); // Client doesn't support compression
    }
    
    // Store original methods
    const originalWrite = res.write;
    const originalEnd = res.end;
    const originalJson = res.json;
    
    let buffer = Buffer.alloc(0);
    let compressed = false;
    let compressor: any = null;
    
    function startCompression() {
      if (compressed) return;
      compressed = true;
      
      // Create compressor based on method
      switch (compressionMethod) {
        case 'br':
          compressor = createBrotliCompress({
            params: {
              [require('zlib').constants.BROTLI_PARAM_QUALITY]: config.level
            } as Record<number, number>
          });
          res.setHeader('Content-Encoding', 'br');
          break;
        case 'gzip':
          compressor = createGzip({ level: config.level, chunkSize: config.chunkSize });
          res.setHeader('Content-Encoding', 'gzip');
          break;
        case 'deflate':
          compressor = createDeflate({ level: config.level, chunkSize: config.chunkSize });
          res.setHeader('Content-Encoding', 'deflate');
          break;
      }
      
      // Remove content-length header since compressed size will differ
      res.removeHeader('Content-Length');
      
      // Set vary header to indicate encoding affects response
      const vary = res.getHeader('Vary') as string;
      if (!vary || !vary.includes('Accept-Encoding')) {
        res.setHeader('Vary', vary ? `${vary}, Accept-Encoding` : 'Accept-Encoding');
      }
      
      // Pipe compressor to response
      compressor.pipe(res, { end: false });
      
      // Handle compression errors
      compressor.on('error', (err: Error) => {
        console.error('Compression error:', err);
        res.status(500).end();
      });
      
      // Write buffered data
      if (buffer.length > 0) {
        compressor.write(buffer);
        buffer = Buffer.alloc(0);
      }
    }
    
    function finishResponse(chunk?: any, encoding?: any) {
      if (chunk && !compressed) {
        buffer = Buffer.concat([buffer, Buffer.from(chunk, encoding)]);
      }
      
      // Check threshold one more time
      if (!compressed && buffer.length >= config.threshold!) {
        startCompression();
      }
      
      if (compressed && compressor) {
        if (chunk && compressed) {
          compressor.write(chunk, encoding);
        }
        compressor.end();
      } else {
        // Not compressed, write directly
        if (buffer.length > 0) {
          originalWrite.call(res, buffer);
        }
        if (chunk && !compressed) {
          originalWrite.call(res, chunk, encoding);
        }
        originalEnd.call(res);
      }
    }
    
    // Override write method
    res.write = function(chunk: any, encoding?: any): boolean {
      if (!compressed && chunk) {
        buffer = Buffer.concat([buffer, Buffer.from(chunk, encoding)]);
        
        // Check if we've hit the threshold
        if (buffer.length >= config.threshold!) {
          startCompression();
        }
      }
      
      if (compressed && compressor) {
        return compressor.write(chunk, encoding);
      }
      
      return true; // Return true to indicate success for buffered writes
    };
    
    // Override end method
    res.end = function(chunk?: any, encoding?: any): Response {
      finishResponse(chunk, encoding);
      return this;
    };
    
    // Override json method for API responses
    res.json = function(data: any): Response {
      const jsonString = JSON.stringify(data);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(jsonString);
    };
    
    next();
  };
}

/**
 * Predefined compression profiles
 */
export const CompressionProfiles = {
  // Fast compression for real-time responses
  fast: {
    threshold: 512, // 512 bytes
    level: 1, // Fastest compression
    chunkSize: 8 * 1024 // 8KB chunks
  },
  
  // Balanced compression for general use
  balanced: {
    threshold: 1024, // 1KB
    level: 6, // Balanced
    chunkSize: 16 * 1024 // 16KB chunks
  },
  
  // Maximum compression for static content
  maximum: {
    threshold: 256, // 256 bytes
    level: 9, // Maximum compression
    chunkSize: 32 * 1024 // 32KB chunks
  },
  
  // API-optimized compression
  api: {
    threshold: 200, // Small threshold for JSON
    level: 4, // Light compression for speed
    filter: (req: Request, res: Response) => {
      const contentType = res.getHeader('Content-Type') as string;
      return contentType && contentType.includes('application/json');
    }
  }
};

/**
 * Check if content type is compressible
 */
export function isCompressible(contentType: string): boolean {
  const compressibleTypes = [
    'text/',
    'application/json',
    'application/javascript',
    'application/xml',
    'application/rss+xml',
    'application/atom+xml',
    'application/xhtml+xml',
    'application/x-javascript',
    'application/ecmascript'
  ];
  
  return compressibleTypes.some(type => contentType.includes(type));
}

/**
 * Get compression ratio statistics
 */
export function getCompressionStats() {
  // This would need to be implemented with tracking
  // For now, return placeholder
  return {
    totalRequests: 0,
    compressedRequests: 0,
    totalBytesBefore: 0,
    totalBytesAfter: 0,
    averageCompressionRatio: 0,
    byMethod: {
      brotli: { requests: 0, ratio: 0 },
      gzip: { requests: 0, ratio: 0 },
      deflate: { requests: 0, ratio: 0 }
    }
  };
}

export default compressionMiddleware;
