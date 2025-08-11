'use client';

import { useEffect, useRef, useCallback } from 'react';
import { notify } from '@/lib/notifications';

interface AutoSaveOptions {
  data: any;
  onSave: (data: any) => Promise<void>;
  interval?: number; // milliseconds
  enabled?: boolean;
  storageKey?: string; // for localStorage backup
}

export function useAutoSave({
  data,
  onSave,
  interval = 30000, // 30 seconds default
  enabled = true,
  storageKey
}: AutoSaveOptions) {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const lastSavedRef = useRef<string>();
  const isSavingRef = useRef(false);
  
  // Save to localStorage for recovery
  const saveToLocalStorage = useCallback((data: any) => {
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify({
          data,
          timestamp: new Date().toISOString()
        }));
      } catch (error) {
        console.error('Failed to save to localStorage:', error);
      }
    }
  }, [storageKey]);
  
  // Perform the save operation
  const performSave = useCallback(async () => {
    if (isSavingRef.current) return;
    
    const currentData = JSON.stringify(data);
    
    // Don't save if nothing changed
    if (currentData === lastSavedRef.current) return;
    
    isSavingRef.current = true;
    
    try {
      // Save to localStorage first (instant)
      saveToLocalStorage(data);
      
      // Then save to server
      await onSave(data);
      
      lastSavedRef.current = currentData;
      
      // Show subtle save indicator (not intrusive)
      const saveIndicator = document.getElementById('auto-save-indicator');
      if (saveIndicator) {
        saveIndicator.textContent = 'Saved';
        saveIndicator.classList.add('opacity-100');
        setTimeout(() => {
          saveIndicator.classList.remove('opacity-100');
        }, 2000);
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
      notify.error('Auto-save failed', 'Your work is saved locally');
    } finally {
      isSavingRef.current = false;
    }
  }, [data, onSave, saveToLocalStorage]);
  
  // Set up auto-save interval
  useEffect(() => {
    if (!enabled) return;
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set new timeout
    timeoutRef.current = setTimeout(performSave, interval);
    
    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, enabled, interval, performSave]);
  
  // Save on page unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const currentData = JSON.stringify(data);
      
      // If there are unsaved changes
      if (currentData !== lastSavedRef.current) {
        saveToLocalStorage(data);
        
        // Show browser warning
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [data, saveToLocalStorage]);
  
  // Manual save function
  const save = useCallback(async () => {
    await performSave();
    notify.contentSaved();
  }, [performSave]);
  
  // Restore from localStorage
  const restore = useCallback(() => {
    if (!storageKey) return null;
    
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const { data, timestamp } = JSON.parse(stored);
        return { data, timestamp };
      }
    } catch (error) {
      console.error('Failed to restore from localStorage:', error);
    }
    return null;
  }, [storageKey]);
  
  return {
    save,
    restore,
    isSaving: isSavingRef.current
  };
}

// Auto-save indicator component
export function AutoSaveIndicator() {
  return (
    <div 
      id="auto-save-indicator"
      className="fixed bottom-4 right-4 text-sm text-gray-500 opacity-0 transition-opacity duration-300 pointer-events-none"
    >
      Saved
    </div>
  );
}