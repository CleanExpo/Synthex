'use client';

/**
 * Theme Picker Component
 *
 * @description Select preset themes or customize colors for bio pages.
 */

import { BIO_THEMES } from '@/lib/bio/themes';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check } from '@/components/icons';
import { cn } from '@/lib/utils';

interface ThemePickerProps {
  currentTheme: string;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  buttonStyle: 'rounded' | 'pill' | 'square';
  onThemeSelect: (themeId: string) => void;
  onColorChange: (colors: {
    primaryColor?: string;
    backgroundColor?: string;
    textColor?: string;
  }) => void;
  onButtonStyleChange: (style: 'rounded' | 'pill' | 'square') => void;
}

const BUTTON_STYLES = [
  { id: 'rounded', label: 'Rounded', preview: 'rounded-xl' },
  { id: 'pill', label: 'Pill', preview: 'rounded-full' },
  { id: 'square', label: 'Square', preview: 'rounded-none' },
] as const;

export function ThemePicker({
  currentTheme,
  primaryColor,
  backgroundColor,
  textColor,
  buttonStyle,
  onThemeSelect,
  onColorChange,
  onButtonStyleChange,
}: ThemePickerProps) {
  return (
    <div className="space-y-6">
      {/* Theme Presets */}
      <div className="space-y-3">
        <Label>Theme Presets</Label>
        <div className="grid grid-cols-3 gap-3">
          {BIO_THEMES.map((theme) => (
            <button
              key={theme.id}
              onClick={() => onThemeSelect(theme.id)}
              className={cn(
                'relative flex flex-col items-center p-3 rounded-lg border-2 transition-all',
                currentTheme === theme.id
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : 'border-white/10 hover:border-white/20 bg-gray-900/50'
              )}
            >
              {/* Preview */}
              <div
                className="w-full h-16 rounded-md mb-2"
                style={{ background: theme.preview }}
              >
                <div className="w-full h-full flex items-center justify-center">
                  <div
                    className={cn(
                      'w-12 h-6 flex items-center justify-center text-xs font-medium',
                      theme.buttonStyle === 'rounded' && 'rounded-lg',
                      theme.buttonStyle === 'pill' && 'rounded-full',
                      theme.buttonStyle === 'square' && 'rounded-none'
                    )}
                    style={{
                      backgroundColor: theme.primaryColor,
                      color: theme.backgroundColor.includes('gradient')
                        ? '#ffffff'
                        : theme.backgroundColor,
                    }}
                  >
                    Link
                  </div>
                </div>
              </div>
              {/* Name */}
              <span className="text-sm text-white">{theme.name}</span>
              {/* Check mark */}
              {currentTheme === theme.id && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Colors */}
      <div className="space-y-3">
        <Label>Custom Colors</Label>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-gray-400">Primary</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => onColorChange({ primaryColor: e.target.value })}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
              />
              <Input
                value={primaryColor}
                onChange={(e) => onColorChange({ primaryColor: e.target.value })}
                className="h-8 text-xs"
                placeholder="#06b6d4"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-gray-400">Background</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={backgroundColor.includes('gradient') ? '#0f172a' : backgroundColor}
                onChange={(e) => onColorChange({ backgroundColor: e.target.value })}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
              />
              <Input
                value={backgroundColor}
                onChange={(e) => onColorChange({ backgroundColor: e.target.value })}
                className="h-8 text-xs"
                placeholder="#0f172a"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-gray-400">Text</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={textColor}
                onChange={(e) => onColorChange({ textColor: e.target.value })}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
              />
              <Input
                value={textColor}
                onChange={(e) => onColorChange({ textColor: e.target.value })}
                className="h-8 text-xs"
                placeholder="#ffffff"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Button Style */}
      <div className="space-y-3">
        <Label>Button Style</Label>
        <div className="flex gap-3">
          {BUTTON_STYLES.map((style) => (
            <button
              key={style.id}
              onClick={() => onButtonStyleChange(style.id)}
              className={cn(
                'flex-1 py-2 px-4 border-2 transition-all',
                style.preview,
                buttonStyle === style.id
                  ? 'border-cyan-500 bg-cyan-500/10 text-white'
                  : 'border-white/10 hover:border-white/20 text-gray-400'
              )}
            >
              {style.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ThemePicker;
