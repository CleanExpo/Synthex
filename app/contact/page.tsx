'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Mail, Phone, MapPin, Send,
  MessageCircle, Clock, HelpCircle,
  CheckCircle, ArrowRight,
  Twitter, Linkedin, Github, Instagram
} from '@/components/icons';
import MarketingLayout from '@/components/marketing/MarketingLayout';

const contactMethods = [
  {
    icon: Mail,
    title: 'Email',
    value: 'hello@synthex.social',
    description: 'Send us an email anytime',
    link: 'mailto:hello@synthex.social'
  },
  {
    icon: Phone,
    title: 'Phone',
    value: '+1 (555) 123-4567',
    description: 'Mon-Fri from 9am to 6pm PST',
    link: 'tel:+15551234567'
  },
  {
    icon: MapPin,
    title: 'Office',
    value: 'San Francisco, CA',
    description: '123 Market Street, Suite 500',
    link: 'https://maps.google.com'
  }
];

const faqs = [
  {
    question: 'How quickly can I expect a response?',
    answer: 'We typically respond to all inquiries within 24 hours during business days. For urgent matters, please call our support line.'
  },
  {
    question: 'Do you offer custom enterprise solutions?',
    answer: 'Yes! We provide tailored solutions for enterprise clients. Contact our sales team to discuss your specific requirements and get a custom quote.'
  },
  {
    question: 'Can I schedule a demo?',
    answer: 'Absolutely! Select "Demo Request" from the subject dropdown in the form, and our team will reach out to schedule a personalized demo at your convenience.'
  },
  {
    question: 'What information should I include in my message?',
    answer: 'Please provide as much detail as possible about your inquiry. Include your use case, team size, and any specific features you\'re interested in to help us assist you better.'
  }
];

const socialLinks = [
  { icon: Twitter, label: 'Twitter', url: 'https://twitter.com/synthex' },
  { icon: Linkedin, label: 'LinkedIn', url: 'https://linkedin.com/company/synthex' },
  { icon: Github, label: 'GitHub', url: 'https://github.com/synthex' },
  { icon: Instagram, label: 'Instagram', url: 'https://instagram.com/synthex' }
];

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'general',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitStatus('success');
      setFormData({ name: '', email: '', subject: 'general', message: '' });

      // Reset success message after 5 seconds
      setTimeout(() => setSubmitStatus('idle'), 5000);
    }, 1500);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <MarketingLayout currentPage="contact">
      {/* Hero Section */}
      <section className="pt-12 pb-20 px-6">
        <div className="container mx-auto text-center">
          <h1 className="text-6xl font-bold text-white mb-6 heading-serif">
            Get in
            <br />
            <span className="bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">Touch</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-12">
            Have questions about Synthex? Want to discuss a custom solution? Our team is here to help.
            Reach out and let&apos;s start a conversation about how AI can transform your social media strategy.
          </p>
        </div>
      </section>

      {/* Contact Methods */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {contactMethods.map((method, index) => (
              <a
                key={index}
                href={method.link}
                target={method.link.startsWith('http') ? '_blank' : undefined}
                rel={method.link.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="bg-[#0d1f35]/80 border border-cyan-500/10 backdrop-blur-sm rounded-xl p-8 text-center hover:scale-105 hover:border-cyan-500/30 transition-all duration-300"
              >
                <method.icon className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">{method.title}</h3>
                <p className="text-cyan-400 font-medium mb-2">{method.value}</p>
                <p className="text-gray-400 text-sm">{method.description}</p>
              </a>
            ))}
          </div>

          {/* Contact Form */}
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Form */}
            <div className="bg-[#0d1f35]/80 border border-cyan-500/10 backdrop-blur-sm rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <MessageCircle className="w-8 h-8 text-cyan-400" />
                <h2 className="text-3xl font-bold text-white heading-serif">Send us a Message</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-[#0a1628] border border-cyan-500/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                    placeholder="John Doe"
                  />
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-[#0a1628] border border-cyan-500/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                    placeholder="john@example.com"
                  />
                </div>

                {/* Subject */}
                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-300 mb-2">
                    Subject *
                  </label>
                  <select
                    id="subject"
                    name="subject"
                    required
                    value={formData.subject}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-[#0a1628] border border-cyan-500/20 rounded-lg text-white focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                  >
                    <option value="general">General Inquiry</option>
                    <option value="sales">Sales</option>
                    <option value="support">Support</option>
                    <option value="partnership">Partnership</option>
                    <option value="demo">Demo Request</option>
                  </select>
                </div>

                {/* Message */}
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-2">
                    Message *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    value={formData.message}
                    onChange={handleChange}
                    rows={6}
                    className="w-full px-4 py-3 bg-[#0a1628] border border-cyan-500/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all resize-none"
                    placeholder="Tell us about your project, questions, or how we can help..."
                  />
                </div>

                {/* Success Message */}
                {submitStatus === 'success' && (
                  <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <p className="text-green-400 text-sm">
                      Thank you! Your message has been sent successfully. We&apos;ll get back to you soon.
                    </p>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white py-3 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Clock className="mr-2 w-5 h-5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 w-5 h-5" />
                      Send Message
                    </>
                  )}
                </Button>
              </form>
            </div>

            {/* Right Column - Additional Info */}
            <div className="space-y-8">
              {/* Social Links */}
              <div className="bg-[#0d1f35]/80 border border-cyan-500/10 backdrop-blur-sm rounded-2xl p-8">
                <h3 className="text-2xl font-bold text-white mb-6 heading-serif">
                  Connect with <span className="bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">Us</span>
                </h3>
                <p className="text-gray-300 mb-6">
                  Follow us on social media for the latest updates, tips, and insights.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {socialLinks.map((social, index) => (
                    <a
                      key={index}
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-4 bg-[#0a1628] border border-cyan-500/20 rounded-lg hover:border-cyan-500/40 hover:bg-[#0a1628]/80 transition-all group"
                    >
                      <social.icon className="w-6 h-6 text-cyan-400 group-hover:scale-110 transition-transform" />
                      <span className="text-gray-300 group-hover:text-cyan-400 transition-colors">
                        {social.label}
                      </span>
                    </a>
                  ))}
                </div>
              </div>

              {/* Office Hours */}
              <div className="bg-[#0d1f35]/80 border border-cyan-500/10 backdrop-blur-sm rounded-2xl p-8">
                <div className="flex items-center gap-3 mb-6">
                  <Clock className="w-8 h-8 text-amber-400" />
                  <h3 className="text-2xl font-bold text-white heading-serif">Office Hours</h3>
                </div>
                <div className="space-y-3 text-gray-300">
                  <div className="flex justify-between py-2 border-b border-cyan-500/10">
                    <span>Monday - Friday</span>
                    <span className="text-cyan-400 font-medium">9:00 AM - 6:00 PM</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-cyan-500/10">
                    <span>Saturday</span>
                    <span className="text-cyan-400 font-medium">10:00 AM - 4:00 PM</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span>Sunday</span>
                    <span className="text-gray-500">Closed</span>
                  </div>
                </div>
                <p className="text-sm text-gray-400 mt-4">
                  All times are in Pacific Standard Time (PST)
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <HelpCircle className="w-10 h-10 text-cyan-400" />
              <h2 className="text-4xl font-bold text-white heading-serif">
                Frequently Asked <span className="bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">Questions</span>
              </h2>
            </div>
            <p className="text-gray-300 max-w-2xl mx-auto">
              Find quick answers to common questions about reaching out to our team.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-[#0d1f35]/80 border border-cyan-500/10 backdrop-blur-sm rounded-xl p-6 hover:border-cyan-500/30 transition-all"
              >
                <h3 className="text-lg font-semibold text-white mb-3 flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                  {faq.question}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed pl-7">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          <div className="bg-gradient-to-r from-[#0d1f35] to-[#0a1628] border border-cyan-500/20 backdrop-blur-sm rounded-2xl p-12 text-center relative overflow-hidden">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-cyan-400/10 to-cyan-500/5 pointer-events-none" />

            <div className="relative z-10">
              <h2 className="text-4xl font-bold text-white mb-4">
                Ready to Get <span className="bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">Started?</span>
              </h2>
              <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                Join thousands of creators and businesses transforming their social media presence with AI.
              </p>
              <div className="flex justify-center gap-4 flex-wrap">
                <Link href="/signup">
                  <Button className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white px-8 py-3 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all">
                    Start Free Trial
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button variant="outline" className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-400 px-8 py-3 transition-all">
                    View Pricing
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
