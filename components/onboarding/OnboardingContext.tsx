'use client';

/**
 * Onboarding Context
 *
 * @description Manages onboarding state across all 7 steps:
 *   Step 1: Business Vetting (name, website, ABN, location + health checks)
 *   Step 2: API Credentials (OpenAI, Anthropic, Google, OpenRouter)
 *   Step 3: Platform Connections
 *   Step 4: Persona Setup
 *   Step 5: Review & Complete
 */

import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import type { WebsiteAnalysisResult } from '@/lib/ai/website-analyzer';
import type { HealthCheckResult } from '@/lib/vetting/business-vetting';

// ============================================================================
// TYPES
// ============================================================================

export interface OnboardingData {
  // Step 1: Business Vetting
  businessName: string;
  websiteUrl: string;
  abnNumber: string;
  businessLocation: string;

  // Vetting Results
  vettingResults: HealthCheckResult | null;
  vettingStatus: 'idle' | 'loading' | 'success' | 'error';
  vettingError: string | null;
  vettingApproved: boolean;

  // AI Analysis (legacy - kept for compatibility)
  aiAnalysis: WebsiteAnalysisResult | null;
  analysisStatus: 'idle' | 'loading' | 'success' | 'error';
  analysisError: string | null;

  // Step 2: API Credentials
  apiCredentials: {
    openai?: string;
    anthropic?: string;
    google?: string;
    openrouter?: string;
  };
  apiSetupComplete: boolean;

  // Step 2: Reviewed Business Details (human-approved)
  organizationName: string;
  industry: string;
  teamSize: string;
  description: string;
  brandColors: { primary?: string; secondary?: string; accent?: string };
  socialHandles: Record<string, string>;

  // Step 3: Platforms
  connectedPlatforms: string[];

  // Step 4: Persona
  personaName: string;
  personaTone: string;
  personaTopics: string[];
  skipPersona: boolean;

  // Meta
  currentStep: number;
  completedSteps: number[];
  startedAt: Date;
}

type OnboardingAction =
  // Step 1: Business Vetting
  | { type: 'SET_VETTING_DATA'; payload: { name: string; website?: string; abn?: string; location?: string } }
  | { type: 'SET_VETTING_LOADING' }
  | { type: 'SET_VETTING_RESULT'; payload: HealthCheckResult }
  | { type: 'SET_VETTING_ERROR'; payload: string }
  | { type: 'APPROVE_VETTING' }

  // Legacy: AI Analysis (kept for compatibility)
  | { type: 'SET_BUSINESS_IDENTITY'; payload: { name: string; websiteUrl: string } }
  | { type: 'SET_ANALYSIS_LOADING' }
  | { type: 'SET_ANALYSIS_RESULT'; payload: WebsiteAnalysisResult }
  | { type: 'SET_ANALYSIS_ERROR'; payload: string }
  | { type: 'CLEAR_ANALYSIS' }

  // Step 2: API Credentials
  | { type: 'SET_API_CREDENTIAL'; payload: { provider: 'openai' | 'anthropic' | 'google' | 'openrouter'; key: string } }
  | { type: 'REMOVE_API_CREDENTIAL'; payload: 'openai' | 'anthropic' | 'google' | 'openrouter' }
  | { type: 'COMPLETE_API_SETUP' }
  | { type: 'CLEAR_API_CREDENTIALS' }

  // Step 3+: Reviewed Details
  | { type: 'SET_REVIEWED_DETAILS'; payload: {
      industry: string;
      teamSize: string;
      description: string;
      brandColors: { primary?: string; secondary?: string; accent?: string };
      socialHandles: Record<string, string>;
    }}

  // Legacy — kept for backward compatibility
  | { type: 'SET_ORGANIZATION'; payload: { name: string; industry: string; teamSize: string } }

  // Step 3: Platforms
  | { type: 'ADD_PLATFORM'; payload: string }
  | { type: 'REMOVE_PLATFORM'; payload: string }

  // Step 4: Persona
  | { type: 'SET_PERSONA'; payload: { name: string; tone: string; topics: string[] } }
  | { type: 'SKIP_PERSONA' }

  // Navigation
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'GO_TO_STEP'; payload: number }
  | { type: 'COMPLETE_STEP'; payload: number }
  | { type: 'RESET' };

interface OnboardingContextType {
  data: OnboardingData;
  dispatch: React.Dispatch<OnboardingAction>;

  // Step 1: Business Vetting
  setVettingData: (name: string, website?: string, abn?: string, location?: string) => void;
  triggerVetting: () => Promise<void>;
  approveVetting: () => void;

  // Legacy: Step 1 (kept for compatibility)
  setBusinessIdentity: (name: string, websiteUrl: string) => void;

  // Legacy: AI Analysis
  triggerAnalysis: () => Promise<void>;

  // Step 2: API Credentials
  setAPICredential: (provider: 'openai' | 'anthropic' | 'google' | 'openrouter', key: string) => void;
  removeAPICredential: (provider: 'openai' | 'anthropic' | 'google' | 'openrouter') => void;
  completeAPISetup: () => void;

  // Step 3+: Reviewed Details
  setReviewedDetails: (details: {
    industry: string;
    teamSize: string;
    description: string;
    brandColors: { primary?: string; secondary?: string; accent?: string };
    socialHandles: Record<string, string>;
  }) => void;

  // Legacy
  setOrganization: (name: string, industry: string, teamSize: string) => void;

  // Step 3
  addPlatform: (platform: string) => void;
  removePlatform: (platform: string) => void;

  // Step 4
  setPersona: (name: string, tone: string, topics: string[]) => void;
  skipPersona: () => void;

  // Navigation
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  completeStep: (step: number) => void;
  reset: () => void;

  // Validation
  canProceed: (step: number) => boolean;
  markOnboardingComplete: () => void;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: OnboardingData = {
  // Step 1: Business Vetting
  businessName: '',
  websiteUrl: '',
  abnNumber: '',
  businessLocation: '',
  vettingResults: null,
  vettingStatus: 'idle',
  vettingError: null,
  vettingApproved: false,

  // Legacy
  aiAnalysis: null,
  analysisStatus: 'idle',
  analysisError: null,

  // Step 2: API Credentials
  apiCredentials: {},
  apiSetupComplete: false,

  // Legacy (Step 2-5)
  organizationName: '',
  industry: '',
  teamSize: '',
  description: '',
  brandColors: {},
  socialHandles: {},
  connectedPlatforms: [],
  personaName: '',
  personaTone: '',
  personaTopics: [],
  skipPersona: false,
  currentStep: 1,
  completedSteps: [],
  startedAt: new Date(),
};

// ============================================================================
// REDUCER
// ============================================================================

function onboardingReducer(state: OnboardingData, action: OnboardingAction): OnboardingData {
  switch (action.type) {
    // Step 1: Business Vetting
    case 'SET_VETTING_DATA':
      return {
        ...state,
        businessName: action.payload.name,
        websiteUrl: action.payload.website || '',
        abnNumber: action.payload.abn || '',
        businessLocation: action.payload.location || '',
        organizationName: action.payload.name,
      };

    case 'SET_VETTING_LOADING':
      return {
        ...state,
        vettingStatus: 'loading',
        vettingError: null,
      };

    case 'SET_VETTING_RESULT':
      return {
        ...state,
        vettingResults: action.payload,
        vettingStatus: 'success',
        vettingError: null,
      };

    case 'SET_VETTING_ERROR':
      return {
        ...state,
        vettingStatus: 'error',
        vettingError: action.payload,
      };

    case 'APPROVE_VETTING':
      return {
        ...state,
        vettingApproved: true,
      };

    // Legacy: SET_BUSINESS_IDENTITY (kept for backward compatibility)
    case 'SET_BUSINESS_IDENTITY':
      return {
        ...state,
        businessName: action.payload.name,
        websiteUrl: action.payload.websiteUrl,
        organizationName: action.payload.name,
      };

    case 'SET_ANALYSIS_LOADING':
      return {
        ...state,
        analysisStatus: 'loading',
        analysisError: null,
      };

    case 'SET_ANALYSIS_RESULT': {
      const result = action.payload;
      return {
        ...state,
        aiAnalysis: result,
        analysisStatus: 'success',
        analysisError: null,
        // Pre-populate reviewed details from AI
        industry: result.industry,
        teamSize: result.teamSize,
        description: result.description,
        brandColors: result.brandColors,
        socialHandles: result.socialHandles,
        // Pre-populate persona from AI
        personaName: result.suggestedPersonaName || state.businessName,
        personaTone: result.suggestedTone || '',
        personaTopics: result.keyTopics || [],
      };
    }

    case 'SET_ANALYSIS_ERROR':
      return {
        ...state,
        analysisStatus: 'error',
        analysisError: action.payload,
      };

    case 'CLEAR_ANALYSIS':
      return {
        ...state,
        aiAnalysis: null,
        analysisStatus: 'idle',
        analysisError: null,
      };

    // Step 2: API Credentials
    case 'SET_API_CREDENTIAL':
      return {
        ...state,
        apiCredentials: {
          ...state.apiCredentials,
          [action.payload.provider]: action.payload.key,
        },
      };

    case 'REMOVE_API_CREDENTIAL':
      return {
        ...state,
        apiCredentials: {
          ...state.apiCredentials,
          [action.payload]: undefined,
        },
      };

    case 'COMPLETE_API_SETUP':
      return {
        ...state,
        apiSetupComplete: true,
      };

    case 'CLEAR_API_CREDENTIALS':
      return {
        ...state,
        apiCredentials: {},
        apiSetupComplete: false,
      };

    case 'SET_REVIEWED_DETAILS':
      return {
        ...state,
        industry: action.payload.industry,
        teamSize: action.payload.teamSize,
        description: action.payload.description,
        brandColors: action.payload.brandColors,
        socialHandles: action.payload.socialHandles,
      };

    case 'SET_ORGANIZATION':
      return {
        ...state,
        organizationName: action.payload.name,
        industry: action.payload.industry,
        teamSize: action.payload.teamSize,
      };

    case 'ADD_PLATFORM':
      if (state.connectedPlatforms.includes(action.payload)) return state;
      return {
        ...state,
        connectedPlatforms: [...state.connectedPlatforms, action.payload],
      };

    case 'REMOVE_PLATFORM':
      return {
        ...state,
        connectedPlatforms: state.connectedPlatforms.filter((p) => p !== action.payload),
      };

    case 'SET_PERSONA':
      return {
        ...state,
        personaName: action.payload.name,
        personaTone: action.payload.tone,
        personaTopics: action.payload.topics,
        skipPersona: false,
      };

    case 'SKIP_PERSONA':
      return { ...state, skipPersona: true };

    case 'NEXT_STEP':
      return { ...state, currentStep: Math.min(state.currentStep + 1, 5) };

    case 'PREV_STEP':
      return { ...state, currentStep: Math.max(state.currentStep - 1, 1) };

    case 'GO_TO_STEP':
      return { ...state, currentStep: action.payload };

    case 'COMPLETE_STEP':
      if (state.completedSteps.includes(action.payload)) return state;
      return {
        ...state,
        completedSteps: [...state.completedSteps, action.payload],
      };

    case 'RESET':
      return { ...initialState, startedAt: new Date() };

    default:
      return state;
  }
}

// ============================================================================
// CONTEXT
// ============================================================================

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(onboardingReducer, initialState);

  // Step 1: Business Vetting
  const setVettingData = useCallback((name: string, website?: string, abn?: string, location?: string) => {
    dispatch({ type: 'SET_VETTING_DATA', payload: { name, website, abn, location } });
  }, []);

  const triggerVetting = useCallback(async () => {
    if (!data.businessName) return;

    dispatch({ type: 'SET_VETTING_LOADING' });

    try {
      const response = await fetch('/api/onboarding/vetting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: data.businessName,
          website: data.websiteUrl || undefined,
          abnNumber: data.abnNumber || undefined,
          businessLocation: data.businessLocation || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        dispatch({
          type: 'SET_VETTING_ERROR',
          payload: errorData.error || 'Vetting failed',
        });
        return;
      }

      const result = await response.json();
      dispatch({ type: 'SET_VETTING_RESULT', payload: result });
    } catch (error) {
      dispatch({
        type: 'SET_VETTING_ERROR',
        payload: 'Failed to perform vetting',
      });
    }
  }, [data.businessName, data.websiteUrl, data.abnNumber, data.businessLocation]);

  const approveVetting = useCallback(() => {
    dispatch({ type: 'APPROVE_VETTING' });
  }, []);

  // Legacy: Step 1 Business Identity
  const setBusinessIdentity = useCallback((name: string, websiteUrl: string) => {
    dispatch({ type: 'SET_BUSINESS_IDENTITY', payload: { name, websiteUrl } });
  }, []);

  // Legacy: AI Analysis — calls the analyze-website API
  const triggerAnalysis = useCallback(async () => {
    if (!data.websiteUrl || !data.businessName) return;

    dispatch({ type: 'SET_ANALYSIS_LOADING' });

    try {
      const response = await fetch('/api/onboarding/analyze-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: data.websiteUrl,
          businessName: data.businessName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        dispatch({
          type: 'SET_ANALYSIS_ERROR',
          payload: errorData.error || 'Analysis failed',
        });
        return;
      }

      const result = await response.json();
      dispatch({ type: 'SET_ANALYSIS_RESULT', payload: result });
    } catch (error) {
      dispatch({
        type: 'SET_ANALYSIS_ERROR',
        payload: 'Failed to analyze website. You can enter details manually.',
      });
    }
  }, [data.websiteUrl, data.businessName]);

  // Step 2: API Credentials
  const setAPICredential = useCallback((provider: 'openai' | 'anthropic' | 'google' | 'openrouter', key: string) => {
    dispatch({ type: 'SET_API_CREDENTIAL', payload: { provider, key } });
  }, []);

  const removeAPICredential = useCallback((provider: 'openai' | 'anthropic' | 'google' | 'openrouter') => {
    dispatch({ type: 'REMOVE_API_CREDENTIAL', payload: provider });
  }, []);

  const completeAPISetup = useCallback(() => {
    dispatch({ type: 'COMPLETE_API_SETUP' });
  }, []);

  // Step 3+: Reviewed Details
  const setReviewedDetails = useCallback((details: {
    industry: string;
    teamSize: string;
    description: string;
    brandColors: { primary?: string; secondary?: string; accent?: string };
    socialHandles: Record<string, string>;
  }) => {
    dispatch({ type: 'SET_REVIEWED_DETAILS', payload: details });
  }, []);

  // Legacy
  const setOrganization = useCallback((name: string, industry: string, teamSize: string) => {
    dispatch({ type: 'SET_ORGANIZATION', payload: { name, industry, teamSize } });
  }, []);

  // Step 3: Platforms
  const addPlatform = useCallback((platform: string) => {
    dispatch({ type: 'ADD_PLATFORM', payload: platform });
  }, []);

  const removePlatform = useCallback((platform: string) => {
    dispatch({ type: 'REMOVE_PLATFORM', payload: platform });
  }, []);

  // Step 4: Persona
  const setPersona = useCallback((name: string, tone: string, topics: string[]) => {
    dispatch({ type: 'SET_PERSONA', payload: { name, tone, topics } });
  }, []);

  const skipPersonaAction = useCallback(() => {
    dispatch({ type: 'SKIP_PERSONA' });
  }, []);

  // Navigation
  const nextStep = useCallback(() => dispatch({ type: 'NEXT_STEP' }), []);
  const prevStep = useCallback(() => dispatch({ type: 'PREV_STEP' }), []);
  const goToStep = useCallback((step: number) => dispatch({ type: 'GO_TO_STEP', payload: step }), []);
  const completeStep = useCallback((step: number) => dispatch({ type: 'COMPLETE_STEP', payload: step }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  const markOnboardingComplete = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('onboardingComplete', 'true');
      localStorage.setItem('onboardingCompletedAt', new Date().toISOString());
    }
  }, []);

  const canProceed = useCallback((step: number): boolean => {
    switch (step) {
      case 1:
        // Step 1: Vetting - need business name and vetting must be approved
        return Boolean(data.businessName.trim()) && data.vettingApproved;
      case 2:
        // Step 2: API Credentials - need at least one API credential
        return Object.values(data.apiCredentials).some(v => v);
      case 3:
        // Step 3: Platforms - optional
        return true;
      case 4:
        // Step 4: Persona - optional or skip allowed
        return data.skipPersona || Boolean(data.personaName && data.personaTone);
      default:
        return true;
    }
  }, [data]);

  const value: OnboardingContextType = {
    data,
    dispatch,
    setVettingData,
    triggerVetting,
    approveVetting,
    setBusinessIdentity,
    triggerAnalysis,
    setAPICredential,
    removeAPICredential,
    completeAPISetup,
    setReviewedDetails,
    setOrganization,
    addPlatform,
    removePlatform,
    setPersona,
    skipPersona: skipPersonaAction,
    nextStep,
    prevStep,
    goToStep,
    completeStep,
    reset,
    canProceed,
    markOnboardingComplete,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useOnboarding(): OnboardingContextType {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}

export default OnboardingContext;
