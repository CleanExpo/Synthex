'use client';

import { useState, useCallback, useEffect } from 'react';
import { notify } from '@/lib/notifications';

interface UndoRedoOptions<T> {
  maxHistorySize?: number;
  onUndo?: (state: T) => void;
  onRedo?: (state: T) => void;
}

export function useUndoRedo<T>(
  initialState: T,
  options: UndoRedoOptions<T> = {}
) {
  const { 
    maxHistorySize = 50,
    onUndo,
    onRedo
  } = options;
  
  const [history, setHistory] = useState<T[]>([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Get current state
  const state = history[currentIndex];
  
  // Check if can undo/redo
  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;
  
  // Add new state to history
  const setState = useCallback((newState: T | ((prev: T) => T)) => {
    setHistory(prev => {
      const resolvedState = typeof newState === 'function' 
        ? (newState as (prev: T) => T)(prev[currentIndex])
        : newState;
      
      // Remove any states after current index (branching)
      const newHistory = prev.slice(0, currentIndex + 1);
      newHistory.push(resolvedState);
      
      // Limit history size
      if (newHistory.length > maxHistorySize) {
        newHistory.shift();
        return newHistory;
      }
      
      return newHistory;
    });
    
    setCurrentIndex(prev => prev + 1);
  }, [currentIndex, maxHistorySize]);
  
  // Undo action
  const undo = useCallback(() => {
    if (!canUndo) {
      notify.error('Nothing to undo');
      return;
    }
    
    setCurrentIndex(prev => {
      const newIndex = prev - 1;
      if (onUndo) {
        onUndo(history[newIndex]);
      }
      return newIndex;
    });
    
    notify.custom('↶ Undone');
  }, [canUndo, history, onUndo]);
  
  // Redo action
  const redo = useCallback(() => {
    if (!canRedo) {
      notify.error('Nothing to redo');
      return;
    }
    
    setCurrentIndex(prev => {
      const newIndex = prev + 1;
      if (onRedo) {
        onRedo(history[newIndex]);
      }
      return newIndex;
    });
    
    notify.custom('↷ Redone');
  }, [canRedo, history, onRedo]);
  
  // Clear history
  const clearHistory = useCallback(() => {
    setHistory([state]);
    setCurrentIndex(0);
  }, [state]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    
    // Listen for custom undo/redo events
    const handleUndo = () => undo();
    const handleRedo = () => redo();
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('undo', handleUndo);
    window.addEventListener('redo', handleRedo);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('undo', handleUndo);
      window.removeEventListener('redo', handleRedo);
    };
  }, [undo, redo]);
  
  return {
    state,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
    historySize: history.length,
    currentIndex
  };
}

// Undo/Redo UI Component
interface UndoRedoControlsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  className?: string;
}

export function UndoRedoControls({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  className = ''
}: UndoRedoControlsProps) {
  return (
    <div className={`flex gap-1 ${className}`}>
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className={`
          p-2 rounded-lg transition-all
          ${canUndo 
            ? 'text-gray-400 hover:text-white hover:bg-white/10' 
            : 'text-gray-600 cursor-not-allowed'
          }
        `}
        title="Undo (Cmd+Z)"
        aria-label="Undo"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      </button>
      
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className={`
          p-2 rounded-lg transition-all
          ${canRedo 
            ? 'text-gray-400 hover:text-white hover:bg-white/10' 
            : 'text-gray-600 cursor-not-allowed'
          }
        `}
        title="Redo (Cmd+Shift+Z)"
        aria-label="Redo"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
        </svg>
      </button>
    </div>
  );
}