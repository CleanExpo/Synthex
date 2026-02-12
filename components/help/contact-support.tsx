'use client';

/**
 * Contact Support Card
 * Support contact options
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, MessageCircle, Phone } from '@/components/icons';

export function ContactSupport() {
  const handleEmail = () => {
    window.location.href = 'mailto:support@synthex.social';
  };

  const handleChat = () => {
    if (typeof window !== 'undefined' && (window as any).Intercom) {
      (window as any).Intercom('show');
    } else {
      window.location.href = 'mailto:support@synthex.social?subject=Live Chat Request';
    }
  };

  const handleCall = () => {
    window.open('https://calendly.com/synthex/support', '_blank');
  };

  return (
    <Card variant="glass" className="mt-8">
      <CardHeader>
        <CardTitle>Still need help?</CardTitle>
        <CardDescription>Our support team is here to assist you</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          <Button variant="outline" className="justify-start" onClick={handleEmail}>
            <Mail className="w-4 h-4 mr-2" />
            support@synthex.social
          </Button>
          <Button variant="outline" className="justify-start" onClick={handleChat}>
            <MessageCircle className="w-4 h-4 mr-2" />
            Start Live Chat
          </Button>
          <Button variant="outline" className="justify-start" onClick={handleCall}>
            <Phone className="w-4 h-4 mr-2" />
            Schedule a Call
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
