'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { notify } from '@/lib/notifications';

interface Shortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts() {
  const router = useRouter();
  
  const shortcuts: Shortcut[] = [
    // Navigation
    {
      key: 'k',
      ctrl: true,
      action: () => openCommandPalette(),
      description: 'Open command palette'
    },
    {
      key: 'n',
      ctrl: true,
      action: () => router.push('/dashboard/content'),
      description: 'New content'
    },
    {
      key: 'd',
      ctrl: true,
      action: () => router.push('/dashboard'),
      description: 'Go to dashboard'
    },
    {
      key: 'a',
      ctrl: true,
      shift: true,
      action: () => router.push('/dashboard/analytics'),
      description: 'View analytics'
    },
    
    // Actions
    {
      key: 's',
      ctrl: true,
      action: () => saveCurrentWork(),
      description: 'Save'
    },
    {
      key: 'z',
      ctrl: true,
      action: () => undo(),
      description: 'Undo'
    },
    {
      key: 'z',
      ctrl: true,
      shift: true,
      action: () => redo(),
      description: 'Redo'
    },
    {
      key: 'Escape',
      action: () => closeModals(),
      description: 'Close modal/menu'
    },
    {
      key: '?',
      shift: true,
      action: () => showShortcutsHelp(),
      description: 'Show shortcuts'
    },
  ];
  
  const openCommandPalette = useCallback(() => {
    // Trigger command palette opening
    const event = new CustomEvent('openCommandPalette');
    window.dispatchEvent(event);
  }, []);
  
  const saveCurrentWork = useCallback(() => {
    // Trigger save event
    const event = new CustomEvent('saveWork');
    window.dispatchEvent(event);
    notify.contentSaved();
  }, []);
  
  const undo = useCallback(() => {
    // Trigger undo event
    const event = new CustomEvent('undo');
    window.dispatchEvent(event);
  }, []);
  
  const redo = useCallback(() => {
    // Trigger redo event
    const event = new CustomEvent('redo');
    window.dispatchEvent(event);
  }, []);
  
  const closeModals = useCallback(() => {
    // Close any open modals
    const event = new CustomEvent('closeAllModals');
    window.dispatchEvent(event);
  }, []);
  
  const showShortcutsHelp = useCallback(() => {
    // Show shortcuts modal
    const event = new CustomEvent('showShortcuts');
    window.dispatchEvent(event);
  }, []);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        // Still allow Escape and Ctrl+S
        if (e.key !== 'Escape' && !(e.ctrlKey && e.key === 's')) {
          return;
        }
      }
      
      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !e.ctrlKey && !e.metaKey;
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        
        if (
          e.key === shortcut.key &&
          ctrlMatch &&
          altMatch &&
          shiftMatch
        ) {
          e.preventDefault();
          shortcut.action();
          break;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
  
  return { shortcuts };
}

// Shortcuts help modal component
export function ShortcutsHelp() {
  const { shortcuts } = useKeyboardShortcuts();
  
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Keyboard Shortcuts</h3>
      <div className="space-y-2">
        {shortcuts.map((shortcut, index) => (
          <div key={index} className="flex justify-between items-center py-2">
            <span className="text-sm text-gray-400">{shortcut.description}</span>
            <kbd className="px-2 py-1 text-xs bg-gray-800 rounded">
              {shortcut.ctrl && '⌘/Ctrl + '}
              {shortcut.alt && 'Alt + '}
              {shortcut.shift && 'Shift + '}
              {shortcut.key}
            </kbd>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-4">
        Pro tip: Press <kbd className="px-1 py-0.5 text-xs bg-gray-800 rounded">?</kbd> anytime to see shortcuts
      </p>
    </div>
  );
}