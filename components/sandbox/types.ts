/**
 * Sandbox Types
 */

import type { ComponentType, SVGProps } from 'react';

// Generic icon type compatible with Heroicons, react-icons, and custom icons
type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

export interface PlatformConfig {
  icon: IconComponent;
  name: string;
  maxChars: number;
  features: string[];
  mockupBg: string;
  textColor: string;
}

export interface DevicePreset {
  width: number;
  height: number;
  label: string;
  icon: IconComponent;
}

export type Platform = 'twitter' | 'linkedin' | 'instagram' | 'facebook' | 'tiktok';
export type Device = 'mobile' | 'tablet' | 'desktop';
export type MediaType = 'none' | 'image' | 'video' | 'gif';
export type PreviewMode = 'visual' | 'code';
