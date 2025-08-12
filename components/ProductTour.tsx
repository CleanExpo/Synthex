'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { notify } from '@/lib/notifications';
import { confetti } from '@/lib/celebrations';

interface TourStep {
  id: string;
  title: string;
  content: string;
  target: string; // CSS selector for the element to highlight
  position: 'top' | 'bottom' | 'left' | 'right';
  action?: () => void;
}

const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to SYNTHEX! 🎉',
    content: 'Let\'s take a quick tour to help you get started with creating viral content.',
    target: 'body',
    position: 'bottom'
  },
  {
    id: 'dashboard',
    title: 'Your Command Center',
    content: 'This is your dashboard where you can see all your metrics and recent activity at a glance.',
    target: '[data-tour="dashboard"]',
    position: 'bottom'
  },
  {
    id: 'content-generator',
    title: 'AI Content Generator',
    content: 'Click here to generate viral-optimized content using our AI. It learns from top performers!',
    target: '[href="/dashboard/content"]',
    position: 'right'
  },
  {
    id: 'command-palette',
    title: 'Quick Commands',
    content: 'Press Cmd+K (or Ctrl+K) anytime to quickly navigate or perform actions.',
    target: 'body',
    position: 'bottom',
    action: () => {
      const event = new CustomEvent('openCommandPalette');
      window.dispatchEvent(event);
    }
  },
  {
    id: 'analytics',
    title: 'Track Your Success',
    content: 'Monitor your content performance with detailed analytics and insights.',
    target: '[href="/dashboard/analytics"]',
    position: 'right'
  },
  {
    id: 'schedule',
    title: 'Smart Scheduling',
    content: 'Schedule your content at optimal times for maximum engagement.',
    target: '[href="/dashboard/schedule"]',
    position: 'right'
  },
  {
    id: 'complete',
    title: 'You\'re All Set! 🚀',
    content: 'Start creating amazing content that goes viral. We\'re here to help you succeed!',
    target: 'body',
    position: 'bottom',
    action: () => {
      confetti();
      notify.milestone('Tour Completed!');
    }
  }
];

export function ProductTour() {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightPosition, setHighlightPosition] = useState({ top: 0, left: 0, width: 0, height: 0 });
  
  const step = tourSteps[currentStep];
  
  // Check if should show tour
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const hasSeenTour = localStorage.getItem('hasSeenTour');
    const isNewUser = !localStorage.getItem('onboardingComplete');
    
    if (!hasSeenTour && !isNewUser) {
      setTimeout(() => {
        setIsActive(true);
      }, 1000);
    }
  }, []);
  
  // Update highlight position
  useEffect(() => {
    if (!isActive || !step.target || step.target === 'body') {
      setHighlightPosition({ top: 0, left: 0, width: 0, height: 0 });
      return;
    }
    
    const element = document.querySelector(step.target);
    if (element) {
      const rect = element.getBoundingClientRect();
      setHighlightPosition({
        top: rect.top - 8,
        left: rect.left - 8,
        width: rect.width + 16,
        height: rect.height + 16
      });
      
      // Scroll element into view
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isActive, step, currentStep]);
  
  // Handle step navigation
  const nextStep = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
      if (tourSteps[currentStep + 1].action) {
        tourSteps[currentStep + 1].action?.();
      }
    } else {
      completeTour();
    }
  };
  
  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };
  
  const skipTour = () => {
    setIsActive(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hasSeenTour', 'true');
    }
    notify.custom('Tour skipped. Press ? anytime for help!');
  };
  
  const completeTour = () => {
    setIsActive(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hasSeenTour', 'true');
    }
    if (step.action) step.action();
  };
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActive) return;
      
      switch (e.key) {
        case 'ArrowRight':
          nextStep();
          break;
        case 'ArrowLeft':
          prevStep();
          break;
        case 'Escape':
          skipTour();
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, currentStep]);
  
  if (!isActive) return null;
  
  // Calculate tooltip position
  const getTooltipPosition = () => {
    if (step.target === 'body') {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      };
    }
    
    const { top, left, width, height } = highlightPosition;
    
    switch (step.position) {
      case 'top':
        return {
          bottom: window.innerHeight - top + 16,
          left: left + width / 2,
          transform: 'translateX(-50%)'
        };
      case 'bottom':
        return {
          top: top + height + 16,
          left: left + width / 2,
          transform: 'translateX(-50%)'
        };
      case 'left':
        return {
          top: top + height / 2,
          right: window.innerWidth - left + 16,
          transform: 'translateY(-50%)'
        };
      case 'right':
        return {
          top: top + height / 2,
          left: left + width + 16,
          transform: 'translateY(-50%)'
        };
    }
  };
  
  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-[9998]">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        
        {/* Highlight */}
        {step.target !== 'body' && highlightPosition.width > 0 && (
          <div
            className="absolute border-2 border-purple-500 rounded-lg transition-all duration-300"
            style={{
              top: highlightPosition.top,
              left: highlightPosition.left,
              width: highlightPosition.width,
              height: highlightPosition.height,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)'
            }}
          />
        )}
      </div>
      
      {/* Tooltip */}
      <div
        className="fixed z-[9999] glass-card p-6 rounded-xl max-w-md animate-in fade-in slide-in-from-bottom-4"
        style={getTooltipPosition()}
      >
        {/* Close button */}
        <button
          onClick={skipTour}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
        
        {/* Content */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">
              {step.title}
            </h3>
          </div>
          
          <p className="text-gray-300">
            {step.content}
          </p>
          
          {/* Progress */}
          <div className="flex gap-1">
            {tourSteps.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  index <= currentStep ? 'bg-purple-500' : 'bg-gray-700'
                }`}
              />
            ))}
          </div>
          
          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={skipTour}
              className="text-gray-400"
            >
              Skip tour
            </Button>
            
            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevStep}
                  className="bg-white/5 border-white/10"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              )}
              
              <Button
                size="sm"
                onClick={nextStep}
                className="gradient-primary text-white"
              >
                {currentStep === tourSteps.length - 1 ? (
                  'Get Started'
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Tour trigger button
export function TourTrigger() {
  const startTour = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('hasSeenTour');
      window.location.reload();
    }
  };
  
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={startTour}
      className="text-gray-400 hover:text-white"
    >
      <Sparkles className="w-4 h-4 mr-2" />
      Take Tour
    </Button>
  );
}