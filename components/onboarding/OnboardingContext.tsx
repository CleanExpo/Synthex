'use client';

/**
 * Onboarding Context
 *
 * @description Manages onboarding state across all steps
 */

import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface OnboardingData {
  // Step 1: Organization
  organizationName: string;
  industry: string;
  teamSize: string;

  // Step 2: Platforms
  connectedPlatforms: string[];

  // Step 3: Persona
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
  | { type: 'SET_ORGANIZATION'; payload: { name: string; industry: string; teamSize: string } }
  | { type: 'ADD_PLATFORM'; payload: string }
  | { type: 'REMOVE_PLATFORM'; payload: string }
  | { type: 'SET_PERSONA'; payload: { name: string; tone: string; topics: string[] } }
  | { type: 'SKIP_PERSONA' }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'GO_TO_STEP'; payload: number }
  | { type: 'COMPLETE_STEP'; payload: number }
  | { type: 'RESET' };

interface OnboardingContextType {
  data: OnboardingData;
  dispatch: React.Dispatch<OnboardingAction>;
  setOrganization: (name: string, industry: string, teamSize: string) => void;
  addPlatform: (platform: string) => void;
  removePlatform: (platform: string) => void;
  setPersona: (name: string, tone: string, topics: string[]) => void;
  skipPersona: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  completeStep: (step: number) => void;
  reset: () => void;
  canProceed: (step: number) => boolean;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: OnboardingData = {
  organizationName: '',
  industry: '',
  teamSize: '',
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
    case 'SET_ORGANIZATION':
      return {
        ...state,
        organizationName: action.payload.name,
        industry: action.payload.industry,
        teamSize: action.payload.teamSize,
      };

    case 'ADD_PLATFORM':
      if (state.connectedPlatforms.includes(action.payload)) {
        return state;
      }
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
      return {
        ...state,
        skipPersona: true,
      };

    case 'NEXT_STEP':
      return {
        ...state,
        currentStep: Math.min(state.currentStep + 1, 4),
      };

    case 'PREV_STEP':
      return {
        ...state,
        currentStep: Math.max(state.currentStep - 1, 1),
      };

    case 'GO_TO_STEP':
      return {
        ...state,
        currentStep: action.payload,
      };

    case 'COMPLETE_STEP':
      if (state.completedSteps.includes(action.payload)) {
        return state;
      }
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

  const setOrganization = useCallback((name: string, industry: string, teamSize: string) => {
    dispatch({ type: 'SET_ORGANIZATION', payload: { name, industry, teamSize } });
  }, []);

  const addPlatform = useCallback((platform: string) => {
    dispatch({ type: 'ADD_PLATFORM', payload: platform });
  }, []);

  const removePlatform = useCallback((platform: string) => {
    dispatch({ type: 'REMOVE_PLATFORM', payload: platform });
  }, []);

  const setPersona = useCallback((name: string, tone: string, topics: string[]) => {
    dispatch({ type: 'SET_PERSONA', payload: { name, tone, topics } });
  }, []);

  const skipPersona = useCallback(() => {
    dispatch({ type: 'SKIP_PERSONA' });
  }, []);

  const nextStep = useCallback(() => {
    dispatch({ type: 'NEXT_STEP' });
  }, []);

  const prevStep = useCallback(() => {
    dispatch({ type: 'PREV_STEP' });
  }, []);

  const goToStep = useCallback((step: number) => {
    dispatch({ type: 'GO_TO_STEP', payload: step });
  }, []);

  const completeStep = useCallback((step: number) => {
    dispatch({ type: 'COMPLETE_STEP', payload: step });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const canProceed = useCallback((step: number): boolean => {
    switch (step) {
      case 1:
        return Boolean(data.organizationName && data.industry && data.teamSize);
      case 2:
        return data.connectedPlatforms.length > 0;
      case 3:
        return data.skipPersona || Boolean(data.personaName && data.personaTone);
      default:
        return true;
    }
  }, [data]);

  const value: OnboardingContextType = {
    data,
    dispatch,
    setOrganization,
    addPlatform,
    removePlatform,
    setPersona,
    skipPersona,
    nextStep,
    prevStep,
    goToStep,
    completeStep,
    reset,
    canProceed,
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
