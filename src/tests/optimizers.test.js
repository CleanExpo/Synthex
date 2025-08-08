/**
 * Platform Optimizers Test Suite
 * Comprehensive tests for optimizer functionality
 */

import { optimizerAPI } from '../api/optimizerAPI.js';
import { isFeatureEnabled } from '../config/features.js';
import { componentLoader } from '../components/LazyComponents.js';
import { ErrorBoundary } from '../components/SafeComponent.js';

// Mock fetch for testing
global.fetch = jest.fn();

describe('Platform Optimizers', () => {
  beforeEach(() => {
    fetch.mockClear();
    optimizerAPI.cache.clear();
  });
  
  describe('Instagram Optimizer', () => {
    test('should load without errors when enabled', async () => {
      // Mock feature flag
      jest.spyOn(require('../config/features.js'), 'isFeatureEnabled')
        .mockReturnValue(true);
      
      // Attempt to load component
      const component = await componentLoader.load('InstagramOptimizer', 
        () => import('../components/optimizers/InstagramOptimizer.js')
      );
      
      expect(component).toBeTruthy();
    });
    
    test('should return null when disabled', async () => {
      // Mock feature flag
      jest.spyOn(require('../config/features.js'), 'isFeatureEnabled')
        .mockReturnValue(false);
      
      const component = await componentLoader.load('InstagramOptimizer', 
        () => import('../components/optimizers/InstagramOptimizer.js')
      );
      
      expect(component).toBeNull();
    });
    
    test('should analyze content correctly', async () => {
      const content = 'Check out our new product launch! #newproduct';
      const result = await optimizerAPI.analyzeContent('instagram', content);
      
      expect(result).toHaveProperty('platform', 'instagram');
      expect(result).toHaveProperty('score');
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result).toHaveProperty('suggestions');
      expect(Array.isArray(result.suggestions)).toBe(true);
    });
    
    test('should suggest hashtags when missing', async () => {
      const content = 'Beautiful sunset today';
      const result = await optimizerAPI.analyzeContent('instagram', content);
      
      expect(result.hashtags).toBeTruthy();
      expect(result.hashtags.length).toBeGreaterThan(0);
      expect(result.suggestions.some(s => s.includes('hashtag'))).toBe(true);
    });
    
    test('should validate caption length', async () => {
      const longContent = 'Lorem ipsum '.repeat(50); // 100 words
      const result = await optimizerAPI.analyzeContent('instagram', longContent);
      
      expect(result.suggestions.some(s => s.includes('caption'))).toBe(true);
    });
  });
  
  describe('Error Boundaries', () => {
    test('should catch and handle component errors', () => {
      const errorBoundary = new ErrorBoundary();
      const faultyComponent = () => {
        throw new Error('Component crashed');
      };
      
      const SafeComponent = errorBoundary.wrap(faultyComponent);
      const instance = new SafeComponent({});
      
      expect(() => instance.render()).not.toThrow();
    });
    
    test('should fallback to legacy component on error', () => {
      const errorBoundary = new ErrorBoundary();
      const faultyComponent = () => {
        throw new Error('New component failed');
      };
      const legacyComponent = () => '<div>Legacy content</div>';
      
      const SafeComponent = errorBoundary.wrap(faultyComponent, legacyComponent);
      const instance = new SafeComponent({});
      const result = instance.render();
      
      expect(result).toBe('<div>Legacy content</div>');
    });
    
    test('should retry failed components', async () => {
      let attempts = 0;
      const errorBoundary = new ErrorBoundary({ maxRetries: 2, retryDelay: 10 });
      
      const faultyComponent = () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Temporary failure');
        }
        return '<div>Success</div>';
      };
      
      const SafeComponent = errorBoundary.wrap(faultyComponent);
      const instance = new SafeComponent({});
      
      instance.render(); // First attempt fails
      
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(attempts).toBeGreaterThan(1);
    });
  });
  
  describe('API Fallback', () => {
    test('should fallback to legacy analysis on API error', async () => {
      // Mock API failure
      fetch.mockRejectedValueOnce(new Error('API unavailable'));
      
      const content = 'Test content';
      const result = await optimizerAPI.analyzeContent('instagram', content);
      
      expect(result).toBeTruthy();
      expect(result.optimized).toBe(true);
      expect(result.suggestions).toBeTruthy();
    });
    
    test('should use cache for repeated requests', async () => {
      const content = 'Cached content test';
      
      // First call
      const result1 = await optimizerAPI.analyzeContent('instagram', content);
      
      // Second call (should use cache)
      const result2 = await optimizerAPI.analyzeContent('instagram', content);
      
      expect(result1).toEqual(result2);
      expect(fetch).toHaveBeenCalledTimes(1); // Only one API call
    });
    
    test('should skip cache when requested', async () => {
      const content = 'Cache skip test';
      
      // First call
      await optimizerAPI.analyzeContent('instagram', content);
      
      // Second call with skipCache
      await optimizerAPI.analyzeContent('instagram', content, { skipCache: true });
      
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('Platform-Specific Rules', () => {
    test('Twitter - should enforce character limit', async () => {
      const longTweet = 'a'.repeat(300);
      const result = await optimizerAPI.analyzeContent('twitter', longTweet);
      
      expect(result.suggestions.some(s => s.includes('character limit'))).toBe(true);
    });
    
    test('LinkedIn - should suggest longer content', async () => {
      const shortPost = 'Short LinkedIn post';
      const result = await optimizerAPI.analyzeContent('linkedin', shortPost);
      
      expect(result.suggestions.some(s => s.includes('150+ words'))).toBe(true);
    });
    
    test('TikTok - should recommend media types', async () => {
      const content = 'TikTok video caption';
      const result = await optimizerAPI.analyzeContent('tiktok', content);
      
      expect(result.mediaRecommendations).toBeTruthy();
      expect(result.mediaRecommendations.length).toBeGreaterThan(0);
    });
  });
  
  describe('Batch Processing', () => {
    test('should analyze multiple items in batch', async () => {
      const items = [
        { id: 1, platform: 'instagram', content: 'First post' },
        { id: 2, platform: 'twitter', content: 'Second post' },
        { id: 3, platform: 'linkedin', content: 'Third post' }
      ];
      
      const results = await optimizerAPI.batchAnalyze(items);
      
      expect(results.length).toBe(3);
      expect(results[0].id).toBe(1);
      expect(results[1].id).toBe(2);
      expect(results[2].id).toBe(3);
    });
    
    test('should handle errors in batch processing', async () => {
      const items = [
        { id: 1, platform: 'instagram', content: 'Valid post' },
        { id: 2, platform: 'invalid', content: 'Invalid platform' }
      ];
      
      const results = await optimizerAPI.batchAnalyze(items);
      
      expect(results.length).toBe(2);
      expect(results[0].error).toBeFalsy();
      expect(results[1].error).toBeTruthy();
    });
  });
});

describe('Integration Tests', () => {
  test('New components work with existing auth', async () => {
    // Mock authenticated user
    const mockUser = { id: 'user123', role: 'admin' };
    global.localStorage.setItem('user', JSON.stringify(mockUser));
    
    // Try to access optimizer with auth
    const response = await fetch('/api/v2/optimize/instagram', {
      headers: {
        'Authorization': `Bearer ${mockUser.token}`
      }
    });
    
    // Should not throw auth errors
    expect(response).toBeTruthy();
  });
  
  test('Feature flags control component visibility', () => {
    // Disable all optimizers
    jest.spyOn(require('../config/features.js'), 'isFeatureEnabled')
      .mockReturnValue(false);
    
    const { optimizerRoutes } = require('../routes/optimizers.js');
    const enabledRoutes = optimizerRoutes.filter(route => route.enabled());
    
    expect(enabledRoutes.length).toBe(0);
  });
});

describe('Performance Tests', () => {
  test('Page load time under 3 seconds', async () => {
    const startTime = Date.now();
    
    // Simulate page load
    await componentLoader.load('InstagramOptimizer', 
      () => new Promise(resolve => setTimeout(() => resolve({}), 100))
    );
    
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000);
  });
  
  test('Component lazy loading works', async () => {
    const loadSpy = jest.fn();
    
    // Setup lazy loading
    componentLoader.preload('TestComponent', loadSpy);
    
    // Component should not be loaded immediately
    expect(loadSpy).not.toHaveBeenCalled();
    
    // Load component
    await componentLoader.load('TestComponent', loadSpy);
    
    expect(loadSpy).toHaveBeenCalled();
  });
  
  test('Cache improves performance', async () => {
    const content = 'Performance test content';
    
    // First call (no cache)
    const start1 = Date.now();
    await optimizerAPI.analyzeContent('instagram', content);
    const time1 = Date.now() - start1;
    
    // Second call (with cache)
    const start2 = Date.now();
    await optimizerAPI.analyzeContent('instagram', content);
    const time2 = Date.now() - start2;
    
    // Cached call should be faster
    expect(time2).toBeLessThan(time1);
  });
});