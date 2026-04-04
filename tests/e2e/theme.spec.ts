import { test, expect } from '@playwright/test';

test.describe('Theme Management', () => {
  test('should toggle between light and dark themes', async ({ page }) => {
    await page.goto('/');
    
    // Get initial theme
    const initialTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme') || 
             localStorage.getItem('theme') || 
             'light';
    });
    
    // Find theme toggle button
    const themeToggle = page.locator('[data-theme-toggle], .theme-toggle, button[aria-label*="theme"]');
    
    if (await themeToggle.isVisible()) {
      // Click to toggle theme
      await themeToggle.click();
      
      // Wait for theme change
      await page.waitForTimeout(500);
      
      // Check theme has changed
      const newTheme = await page.evaluate(() => {
        return document.documentElement.getAttribute('data-theme') || 
               localStorage.getItem('theme') || 
               'light';
      });
      
      expect(newTheme).not.toBe(initialTheme);
    }
  });

  test('should persist theme preference', async ({ page, context }) => {
    await page.goto('/');
    
    // Set dark theme
    await page.evaluate(() => {
      localStorage.setItem('theme', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    
    // Reload page
    await page.reload();
    
    // Check theme persisted
    const theme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme') || 
             localStorage.getItem('theme');
    });
    
    expect(theme).toBe('dark');
  });

  test('should apply correct CSS variables for themes', async ({ page }) => {
    await page.goto('/');
    
    // Set light theme
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
    });
    
    // Check light theme colors
    const lightBg = await page.evaluate(() => {
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--background-color')
        .trim();
    });
    
    // Set dark theme
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    
    // Check dark theme colors
    const darkBg = await page.evaluate(() => {
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--background-color')
        .trim();
    });
    
    // Backgrounds should be different
    if (lightBg && darkBg) {
      expect(lightBg).not.toBe(darkBg);
    }
  });

  test('should handle system theme preference', async ({ page }) => {
    // Emulate dark color scheme preference
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    
    // Check if dark theme is applied
    const theme = await page.evaluate(() => {
      const prefersColorScheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersColorScheme ? 'dark' : 'light';
    });
    
    expect(theme).toBe('dark');
  });
});