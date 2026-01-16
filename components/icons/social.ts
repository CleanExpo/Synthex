/**
 * Social Media Icons
 * Using react-icons for platform-specific brand icons
 *
 * @version 2.0.0
 * @updated 2026-01-16
 */

import React from 'react';
import {
  FaTwitter,
  FaFacebook,
  FaInstagram,
  FaLinkedin,
  FaYoutube,
  FaTiktok,
  FaPinterest,
  FaReddit,
  FaThreads,
  FaXTwitter,
  FaGithub,
} from 'react-icons/fa6';

// Re-export with consistent naming
export const Twitter = FaXTwitter; // Updated to X branding
export const TwitterLegacy = FaTwitter; // Old bird logo
export const Facebook = FaFacebook;
export const Instagram = FaInstagram;
export const Linkedin = FaLinkedin;
export const Youtube = FaYoutube;
export const TikTok = FaTiktok;
export const Pinterest = FaPinterest;
export const Reddit = FaReddit;
export const Threads = FaThreads;
export const Github = FaGithub;

// Platform colors for reference
export const SocialColors = {
  twitter: '#1DA1F2',
  x: '#000000',
  facebook: '#1877F2',
  instagram: '#E4405F',
  linkedin: '#0A66C2',
  youtube: '#FF0000',
  tiktok: '#000000',
  pinterest: '#BD081C',
  reddit: '#FF4500',
  threads: '#000000',
} as const;

// Platform icon map for dynamic rendering
export const SocialIcons = {
  twitter: Twitter,
  x: Twitter,
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
  tiktok: TikTok,
  pinterest: Pinterest,
  reddit: Reddit,
  threads: Threads,
} as const;

// Type for social platform names
export type SocialPlatform = keyof typeof SocialIcons;

// Helper to get icon by platform name
export function getSocialIcon(platform: SocialPlatform) {
  return SocialIcons[platform.toLowerCase() as SocialPlatform] || Twitter;
}

// Helper to get platform color
export function getSocialColor(platform: SocialPlatform) {
  return SocialColors[platform.toLowerCase() as keyof typeof SocialColors] || '#6B7280';
}
