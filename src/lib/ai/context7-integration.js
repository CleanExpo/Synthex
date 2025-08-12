/**
 * Context7 MCP Integration for SYNTHEX
 * Provides real-time library documentation and code examples
 * for AI-powered content generation
 */

class Context7Integration {
  constructor() {
    this.libraries = {
      'openrouter': '/openrouter/docs',
      'react': '/facebook/react',
      'nextjs': '/vercel/next.js',
      'tailwind': '/tailwindlabs/tailwindcss',
      'supabase': '/supabase/supabase',
      'prisma': '/prisma/prisma',
      'framer-motion': '/framer/motion',
      'radix-ui': '/radix-ui/primitives'
    };
    
    this.cache = new Map();
    this.cacheTimeout = 3600000; // 1 hour
  }

  /**
   * Resolve library name to Context7-compatible ID
   * @param {string} libraryName - Name of the library to resolve
   * @returns {Promise<string>} Context7 library ID
   */
  async resolveLibraryId(libraryName) {
    // Check if we have a direct mapping
    if (this.libraries[libraryName.toLowerCase()]) {
      return this.libraries[libraryName.toLowerCase()];
    }
    
    // Use MCP to resolve library ID
    try {
      const result = await mcp__context7__resolve_library_id({
        libraryName: libraryName
      });
      
      // Cache the resolved ID
      this.libraries[libraryName.toLowerCase()] = result.libraryId;
      return result.libraryId;
    } catch (error) {
      console.error(`Failed to resolve library ID for ${libraryName}:`, error);
      throw error;
    }
  }

  /**
   * Get library documentation with caching
   * @param {string} library - Library name or ID
   * @param {string} topic - Specific topic to focus on
   * @param {number} tokens - Maximum tokens to retrieve
   * @returns {Promise<object>} Documentation content
   */
  async getLibraryDocs(library, topic = null, tokens = 10000) {
    const cacheKey = `${library}-${topic}-${tokens}`;
    
    // Check cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }
    
    // Resolve library ID if needed
    let libraryId = library;
    if (!library.startsWith('/')) {
      libraryId = await this.resolveLibraryId(library);
    }
    
    // Fetch documentation
    try {
      const docs = await mcp__context7__get_library_docs({
        context7CompatibleLibraryID: libraryId,
        topic: topic,
        tokens: tokens
      });
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: docs,
        timestamp: Date.now()
      });
      
      return docs;
    } catch (error) {
      console.error(`Failed to get docs for ${library}:`, error);
      throw error;
    }
  }

  /**
   * Get AI-specific documentation for content generation
   * @returns {Promise<object>} AI library documentation
   */
  async getAIDocumentation() {
    const aiLibraries = ['openrouter', 'langchain', 'openai'];
    const documentation = {};
    
    for (const lib of aiLibraries) {
      try {
        documentation[lib] = await this.getLibraryDocs(lib, 'api-reference', 5000);
      } catch (error) {
        console.warn(`Could not fetch docs for ${lib}:`, error);
      }
    }
    
    return documentation;
  }

  /**
   * Get framework documentation for UI components
   * @returns {Promise<object>} Framework documentation
   */
  async getFrameworkDocumentation() {
    const frameworks = {
      'react': 'hooks',
      'nextjs': 'app-router',
      'tailwind': 'utilities',
      'framer-motion': 'animations'
    };
    
    const documentation = {};
    
    for (const [framework, topic] of Object.entries(frameworks)) {
      try {
        documentation[framework] = await this.getLibraryDocs(
          framework, 
          topic, 
          3000
        );
      } catch (error) {
        console.warn(`Could not fetch docs for ${framework}:`, error);
      }
    }
    
    return documentation;
  }

  /**
   * Get code examples for specific use cases
   * @param {string} useCase - The use case to get examples for
   * @returns {Promise<object>} Code examples
   */
  async getCodeExamples(useCase) {
    const useCaseMapping = {
      'authentication': ['supabase', 'nextjs'],
      'database': ['prisma', 'supabase'],
      'styling': ['tailwind', 'radix-ui'],
      'animation': ['framer-motion', 'react'],
      'ai-integration': ['openrouter', 'nextjs']
    };
    
    const libraries = useCaseMapping[useCase] || ['react', 'nextjs'];
    const examples = {};
    
    for (const lib of libraries) {
      try {
        examples[lib] = await this.getLibraryDocs(
          lib, 
          `${useCase}-examples`, 
          2000
        );
      } catch (error) {
        console.warn(`Could not fetch examples for ${lib}:`, error);
      }
    }
    
    return examples;
  }

  /**
   * Clear documentation cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {object} Cache statistics
   */
  getCacheStats() {
    return {
      entries: this.cache.size,
      libraries: Object.keys(this.libraries).length,
      timeout: this.cacheTimeout
    };
  }
}

// Create singleton instance
const context7 = new Context7Integration();

// Export for use in SYNTHEX
if (typeof module !== 'undefined' && module.exports) {
  module.exports = context7;
}

// Browser global
if (typeof window !== 'undefined') {
  window.Context7Integration = context7;
}