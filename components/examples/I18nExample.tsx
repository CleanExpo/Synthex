/**
 * Example component demonstrating i18n usage
 */

'use client';

import React from 'react';
import { useTranslation } from '@/lib/i18n';
import { LanguageSwitch } from '@/lib/i18n/components/LanguageSwitch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/useToast';

export function I18nExample() {
  const { t, formatDate, formatNumber, formatCurrency, locale } = useTranslation();

  const handleSave = () => {
    toast({
      title: t('notifications.success.saved'),
      description: t('common.success'),
    });
  };

  const today = new Date();
  const sampleNumber = 1234567.89;
  const samplePrice = 99.99;

  return (
    <div className="space-y-6 p-6">
      {/* Header with Language Switcher */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('dashboard.title')}</h1>
          <p className="text-muted-foreground">
            {t('dashboard.welcome', { name: 'John' })}
          </p>
        </div>
        <LanguageSwitch />
      </div>

      {/* Basic Translation Examples */}
      <Card>
        <CardHeader>
          <CardTitle>{t('common.actions')}</CardTitle>
          <CardDescription>
            Basic translation examples
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave}>
              {t('common.save')}
            </Button>
            <Button variant="outline">
              {t('common.cancel')}
            </Button>
            <Button variant="destructive">
              {t('common.delete')}
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <Badge variant="secondary">{t('common.status')}</Badge>
              <p className="text-sm mt-1">{t('common.success')}</p>
            </div>
            <div>
              <Badge variant="outline">{t('common.loading')}</Badge>
              <p className="text-sm mt-1">{t('common.processing')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Authentication Section */}
      <Card>
        <CardHeader>
          <CardTitle>{t('auth.signIn')}</CardTitle>
          <CardDescription>
            Authentication translations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('auth.email')}</label>
              <input 
                type="email" 
                placeholder={t('auth.email')}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('auth.password')}</label>
              <input 
                type="password" 
                placeholder={t('auth.password')}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Button>{t('auth.signIn')}</Button>
            <Button variant="link" size="sm">
              {t('auth.forgotPassword')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Formatting Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Formatting Examples</CardTitle>
          <CardDescription>
            Date, number, and currency formatting based on locale
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold">Date Formatting</h4>
              <p className="text-sm text-muted-foreground">
                Current locale: <Badge variant="outline">{locale}</Badge>
              </p>
              <p>{formatDate(today)}</p>
              <p>{formatDate(today, { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold">Number Formatting</h4>
              <p>{formatNumber(sampleNumber)}</p>
              <p>{formatNumber(sampleNumber, { 
                style: 'percent',
                minimumFractionDigits: 2 
              })}</p>
              <p>{formatNumber(sampleNumber, { 
                notation: 'compact',
                compactDisplay: 'short' 
              })}</p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold">Currency Formatting</h4>
              <p>{formatCurrency(samplePrice)}</p>
              <p>{formatCurrency(samplePrice, 'EUR')}</p>
              <p>{formatCurrency(samplePrice, 'JPY')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaign Example */}
      <Card>
        <CardHeader>
          <CardTitle>{t('campaigns.title')}</CardTitle>
          <CardDescription>
            Campaign management translations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <Button size="sm">
              {t('campaigns.createCampaign')}
            </Button>
            <Button size="sm" variant="outline">
              {t('campaigns.editCampaign')}
            </Button>
            <Button size="sm" variant="destructive">
              {t('campaigns.deleteCampaign')}
            </Button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Badge variant="default">{t('campaigns.statuses.active')}</Badge>
            </div>
            <div>
              <Badge variant="secondary">{t('campaigns.statuses.scheduled')}</Badge>
            </div>
            <div>
              <Badge variant="outline">{t('campaigns.statuses.draft')}</Badge>
            </div>
            <div>
              <Badge variant="destructive">{t('campaigns.statuses.paused')}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Validation Messages</CardTitle>
          <CardDescription>
            Form validation translations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-sm text-red-600">
              {t('validation.required')}
            </div>
            <div className="text-sm text-red-600">
              {t('validation.email')}
            </div>
            <div className="text-sm text-red-600">
              {t('validation.minLength', { count: 8 })}
            </div>
            <div className="text-sm text-red-600">
              {t('validation.fileSize', { size: '10MB' })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default I18nExample;