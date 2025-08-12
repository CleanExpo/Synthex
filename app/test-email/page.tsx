'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Loader2, Mail, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TestEmailPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [formData, setFormData] = useState({
    to: '',
    subject: 'Test Email from SYNTHEX',
    message: 'This is a test email to verify that the email configuration is working correctly.',
  });
  const [result, setResult] = useState<any>(null);

  const checkConfig = async () => {
    try {
      const response = await fetch('/api/test-email');
      const data = await response.json();
      setConfig(data);
    } catch (error) {
      console.error('Failed to check config:', error);
    }
  };

  const sendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      
      if (response.ok) {
        setResult({ success: true, data });
        toast.success('Test email sent successfully!');
      } else {
        setResult({ success: false, error: data });
        toast.error(data.error || 'Failed to send email');
      }
    } catch (error: any) {
      setResult({ success: false, error: { message: error.message } });
      toast.error('Failed to send test email');
    } finally {
      setIsLoading(false);
    }
  };

  // Check config on mount
  useState(() => {
    checkConfig();
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-cyan-900/20 to-gray-900 p-6">
      <div className="container mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold text-white mb-6">Email Configuration Test</h1>
        
        {/* Configuration Status */}
        {config && (
          <Card className="glass-card p-6 mb-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-cyan-400" />
              Configuration Status
            </h2>
            <div className="space-y-2">
              <p className="text-gray-300">
                <span className="text-gray-400">Provider:</span> {config.configuration.provider}
              </p>
              <p className="text-gray-300">
                <span className="text-gray-400">From Email:</span> {config.configuration.emailFrom}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">SMTP Config:</span>
                {config.configuration.hasSmtpConfig ? (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Gmail Config:</span>
                {config.configuration.hasGmailConfig ? (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">SendGrid Config:</span>
                {config.configuration.hasSendgridConfig ? (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Test Email Form */}
        <Card className="glass-card p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5 text-cyan-400" />
            Send Test Email
          </h2>
          <form onSubmit={sendTestEmail} className="space-y-4">
            <div>
              <label className="block text-gray-300 mb-2">To Email:</label>
              <Input
                type="email"
                value={formData.to}
                onChange={(e) => setFormData({ ...formData, to: e.target.value })}
                placeholder="recipient@example.com"
                required
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div>
              <label className="block text-gray-300 mb-2">Subject:</label>
              <Input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                required
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div>
              <label className="block text-gray-300 mb-2">Message:</label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={4}
                required
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-white"
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full gradient-primary text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Test Email
                </>
              )}
            </Button>
          </form>
        </Card>

        {/* Result Display */}
        {result && (
          <Card className={`p-6 ${result.success ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              {result.success ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  Email Sent Successfully
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-red-400" />
                  Email Failed
                </>
              )}
            </h3>
            <pre className="text-xs text-gray-300 overflow-x-auto">
              {JSON.stringify(result.success ? result.data : result.error, null, 2)}
            </pre>
          </Card>
        )}

        {/* Configuration Help */}
        <Card className="glass-card p-6 mt-6">
          <h2 className="text-xl font-semibold text-white mb-4">Configuration Help</h2>
          <div className="space-y-4 text-gray-300">
            <div>
              <h3 className="text-cyan-400 font-semibold mb-2">Gmail Configuration:</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Enable 2-factor authentication on your Gmail account</li>
                <li>Generate an App Password: Account Settings → Security → App passwords</li>
                <li>Add to .env:
                  <code className="block mt-1 p-2 bg-black/30 rounded text-xs">
                    EMAIL_PROVIDER=gmail<br/>
                    GMAIL_USER=your-email@gmail.com<br/>
                    GMAIL_APP_PASSWORD=your-16-char-password<br/>
                    EMAIL_FROM=support@synthex.social
                  </code>
                </li>
              </ol>
            </div>
            <div>
              <h3 className="text-cyan-400 font-semibold mb-2">SMTP Configuration:</h3>
              <code className="block p-2 bg-black/30 rounded text-xs">
                EMAIL_PROVIDER=smtp<br/>
                SMTP_HOST=smtp.gmail.com<br/>
                SMTP_PORT=587<br/>
                SMTP_USER=your-email@gmail.com<br/>
                SMTP_PASS=your-password<br/>
                EMAIL_FROM=support@synthex.social
              </code>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}