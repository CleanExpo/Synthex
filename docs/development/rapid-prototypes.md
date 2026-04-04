# Auto Marketing Platform - Rapid Prototyping Framework

## Overview
This document provides rapid prototyping specifications and code templates for quick validation and iteration of the Auto Marketing Platform features.

## 1. MVP Prototype (Week 1-2)

### Core Technology Stack
```javascript
// Frontend
- React 18 + TypeScript
- Vite (build tool)
- TailwindCSS + Emotion
- Zustand (state management)
- React Query (data fetching)

// Backend Integration
- REST API + WebSockets
- Mock Service Worker (MSW)
```

### Quick Start Dashboard
```tsx
// Dashboard.tsx - MVP Layout
import React from 'react';

const Dashboard: React.FC = () => {
  return (
    <div className="grid grid-cols-12 gap-4 p-6">
      <aside className="col-span-3 bg-white rounded-lg shadow p-4">
        <nav>
          <ul className="space-y-2">
            <li>Dashboard</li>
            <li>Campaigns</li>
            <li>Analytics</li>
            <li>Settings</li>
          </ul>
        </nav>
      </aside>
      <main className="col-span-9 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <MetricCard title="Active Campaigns" value="12" />
          <MetricCard title="Total Reach" value="45.2K" />
          <MetricCard title="Engagement Rate" value="3.8%" />
        </div>
        <ContentCreator />
        <CampaignList />
      </main>
    </div>
  );
};
```

## 2. Interactive Prototype Components

### Voice Input Component
```tsx
// VoiceInput.tsx
import { useState } from 'react';

export const VoiceInput = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');

  const toggleListening = () => {
    if (!isListening) {
      // Start speech recognition
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.onresult = (event: any) => {
        setTranscript(event.results[0][0].transcript);
      };
      recognition.start();
    }
    setIsListening(!isListening);
  };

  return (
    <div className="p-4 border rounded-lg">
      <button 
        onClick={toggleListening}
        className={`px-6 py-3 rounded-full ${
          isListening ? 'bg-red-500' : 'bg-blue-500'
        } text-white`}
      >
        {isListening ? '🎤 Listening...' : '🎤 Start Recording'}
      </button>
      {transcript && (
        <div className="mt-4 p-3 bg-gray-100 rounded">
          {transcript}
        </div>
      )}
    </div>
  );
};
```

### Platform Preview Cards
```tsx
// PlatformPreview.tsx
interface Platform {
  name: string;
  icon: string;
  content: string;
  charLimit: number;
}

export const PlatformPreview = ({ platform }: { platform: Platform }) => {
  return (
    <div className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
      <div className="flex items-center mb-3">
        <span className="text-2xl mr-2">{platform.icon}</span>
        <h3 className="font-semibold">{platform.name}</h3>
      </div>
      <div className="text-sm text-gray-600 mb-2">
        {platform.content.substring(0, platform.charLimit)}
        {platform.content.length > platform.charLimit && '...'}
      </div>
      <div className="text-xs text-gray-400">
        {platform.content.length}/{platform.charLimit} characters
      </div>
    </div>
  );
};
```

## 3. State Management Pattern

```typescript
// store/campaignStore.ts
import { create } from 'zustand';

interface Campaign {
  id: string;
  content: string;
  platforms: string[];
  status: 'draft' | 'scheduled' | 'published';
}

interface CampaignStore {
  campaigns: Campaign[];
  addCampaign: (campaign: Campaign) => void;
  updateCampaign: (id: string, updates: Partial<Campaign>) => void;
  deleteCampaign: (id: string) => void;
}

export const useCampaignStore = create<CampaignStore>((set) => ({
  campaigns: [],
  addCampaign: (campaign) => 
    set((state) => ({ campaigns: [...state.campaigns, campaign] })),
  updateCampaign: (id, updates) =>
    set((state) => ({
      campaigns: state.campaigns.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),
  deleteCampaign: (id) =>
    set((state) => ({
      campaigns: state.campaigns.filter((c) => c.id !== id),
    })),
}));
```

## 4. API Mock Structure

```typescript
// mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  rest.get('/api/campaigns', (req, res, ctx) => {
    return res(
      ctx.json([
        {
          id: '1',
          title: 'Summer Sale',
          platforms: ['twitter', 'facebook', 'instagram'],
          status: 'published',
          engagement: { likes: 1234, shares: 567, comments: 89 }
        }
      ])
    );
  }),

  rest.post('/api/content/generate', async (req, res, ctx) => {
    const { prompt } = await req.json();
    
    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return res(
      ctx.json({
        platforms: {
          twitter: `🚀 ${prompt} - Check it out! #marketing`,
          facebook: `Exciting news! ${prompt}. Learn more...`,
          instagram: `✨ ${prompt} ✨\n\n#marketing #socialmedia`,
          linkedin: `Professional insight: ${prompt}. Here's why it matters...`
        }
      })
    );
  })
];
```

## 5. Performance Monitoring

```typescript
// utils/performance.ts
export class PerformanceMonitor {
  private cpuUsage: number = 0;
  private memoryUsage: number = 0;

  startMonitoring() {
    setInterval(() => {
      // Simulate CPU monitoring
      this.cpuUsage = Math.random() * 100;
      
      if (this.cpuUsage > 70) {
        console.warn(`High CPU usage: ${this.cpuUsage.toFixed(2)}%`);
        this.throttleOperations();
      }
    }, 1000);
  }

  throttleOperations() {
    // Implement throttling logic
    console.log('Throttling operations to reduce CPU usage');
  }

  getMetrics() {
    return {
      cpu: this.cpuUsage,
      memory: this.memoryUsage,
      timestamp: Date.now()
    };
  }
}
```

## 6. Testing Prototypes

```typescript
// __tests__/Campaign.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { CampaignCreator } from '../components/CampaignCreator';

describe('CampaignCreator', () => {
  test('creates campaign from text input', async () => {
    render(<CampaignCreator />);
    
    const input = screen.getByPlaceholderText('Enter your content idea...');
    fireEvent.change(input, { target: { value: 'New product launch' } });
    
    const createButton = screen.getByText('Generate Campaign');
    fireEvent.click(createButton);
    
    // Wait for AI processing
    const previews = await screen.findAllByTestId('platform-preview');
    expect(previews).toHaveLength(8);
  });

  test('respects character limits per platform', () => {
    const content = 'a'.repeat(300);
    render(<PlatformPreview platform="twitter" content={content} />);
    
    const preview = screen.getByTestId('twitter-preview');
    expect(preview.textContent).toHaveLength(280);
  });
});
```

## 7. Deployment Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy Prototype

on:
  push:
    branches: [main, develop]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node
        uses: actions/setup-node@v2
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        run: npm test
        
      - name: Build prototype
        run: npm run build
        
      - name: Deploy to staging
        if: github.ref == 'refs/heads/develop'
        run: npm run deploy:staging
        
      - name: Deploy to production
        if: github.ref == 'refs/heads/main'
        run: npm run deploy:production
```

## 8. Iteration Framework

### Feature Flags
```typescript
// config/features.ts
export const features = {
  voiceInput: process.env.REACT_APP_FEATURE_VOICE === 'true',
  aiAgents: process.env.REACT_APP_FEATURE_AI_AGENTS === 'true',
  videoGeneration: process.env.REACT_APP_FEATURE_VIDEO === 'true',
  
  isEnabled(feature: string): boolean {
    return this[feature] || false;
  }
};

// Usage
if (features.isEnabled('voiceInput')) {
  return <VoiceInput />;
}
```

### A/B Testing Setup
```typescript
// utils/abTesting.ts
export class ABTest {
  static getVariant(testName: string, userId: string): 'A' | 'B' {
    const hash = this.hashCode(testName + userId);
    return hash % 2 === 0 ? 'A' : 'B';
  }

  private static hashCode(str: string): number {
    return str.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
  }
}
```

## Quick Start Guide

1. **Clone and Install**
```bash
git clone [repo]
cd auto-marketing-platform
npm install
```

2. **Start Development**
```bash
npm run dev
# Opens at http://localhost:5173
```

3. **Run Tests**
```bash
npm test
npm run test:e2e
```

4. **Build for Production**
```bash
npm run build
npm run preview
```

## Prototype Validation Checklist

- [ ] Core navigation working
- [ ] Content input functional
- [ ] Platform previews rendering
- [ ] State management operational
- [ ] API mocks responding
- [ ] Performance monitoring active
- [ ] Tests passing
- [ ] Responsive on mobile
- [ ] CPU usage < 70%
- [ ] Loading states implemented

## Next Steps

1. User testing with clickable prototype
2. Gather feedback on core workflows
3. Iterate on UI based on testing
4. Expand component library
5. Integrate real API endpoints
6. Add authentication flow
7. Implement caching strategy
8. Deploy to staging environment

This rapid prototyping framework enables quick validation and iteration while maintaining code quality and performance standards.