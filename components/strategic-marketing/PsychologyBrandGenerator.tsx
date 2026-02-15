'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Sparkles, Target, Zap, TrendingUp, Users, Award, Package } from '@/components/icons';

interface PsychologyPrinciple {
  name: string;
  category: string;
  description: string;
  relevanceScore: number;
}

interface BrandResult {
  brandNames: Array<{
    name: string;
    psychologicalTrigger: string;
    rationale: string;
    memorabilityFactor: number;
  }>;
  taglines: Array<{
    text: string;
    psychologicalTarget: string;
    emotionalResonance: string;
  }>;
  metadataPackages: Array<{
    platform: string;
    title: string;
    description: string;
    keywords: string[];
    hashtags: string[];
  }>;
  effectivenessScore: number;
}

const PSYCHOLOGY_CATEGORIES = [
  { id: 'cognitive', name: 'Cognitive Biases', icon: Brain, color: 'from-cyan-500 to-cyan-600' },
  { id: 'social', name: 'Social Psychology', icon: Users, color: 'from-cyan-400 to-cyan-500' },
  { id: 'behavioral', name: 'Behavioral Economics', icon: TrendingUp, color: 'from-green-500 to-emerald-600' },
  { id: 'memory', name: 'Memory & Learning', icon: Sparkles, color: 'from-yellow-500 to-orange-600' },
  { id: 'perception', name: 'Perception & Reality', icon: Target, color: 'from-cyan-500 to-cyan-600' }
];

const PSYCHOLOGY_PRINCIPLES: PsychologyPrinciple[] = [
  // Cognitive Biases
  { name: 'Anchoring Bias', category: 'cognitive', description: 'First information influences all decisions', relevanceScore: 85 },
  { name: 'Confirmation Bias', category: 'cognitive', description: 'Seeking confirming information', relevanceScore: 75 },
  { name: 'Availability Heuristic', category: 'cognitive', description: 'Recent events seem more likely', relevanceScore: 70 },

  // Social Psychology
  { name: 'Social Proof', category: 'social', description: 'Following the crowd', relevanceScore: 90 },
  { name: 'Authority Principle', category: 'social', description: 'Deferring to experts', relevanceScore: 88 },
  { name: 'Reciprocity', category: 'social', description: 'Returning favors', relevanceScore: 82 },

  // Behavioral Economics
  { name: 'Loss Aversion', category: 'behavioral', description: 'Fear of missing out', relevanceScore: 87 },
  { name: 'Scarcity Principle', category: 'behavioral', description: 'Limited availability increases desire', relevanceScore: 92 },
  { name: 'Decoy Effect', category: 'behavioral', description: 'Third option influences choice', relevanceScore: 78 },

  // Memory & Learning
  { name: 'Mere Exposure Effect', category: 'memory', description: 'Familiarity breeds preference', relevanceScore: 73 },
  { name: 'Primacy Effect', category: 'memory', description: 'First items remembered best', relevanceScore: 71 },

  // Perception & Reality
  { name: 'Halo Effect', category: 'perception', description: 'One trait influences all', relevanceScore: 84 },
  { name: 'Contrast Principle', category: 'perception', description: 'Comparisons affect perception', relevanceScore: 80 }
];

export default function PsychologyBrandGenerator() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    businessType: '',
    targetAudience: {
      demographics: [],
      psychographics: [],
      painPoints: []
    },
    brandGoals: [] as string[],
    tonePreference: '',
    selectedPrinciples: [] as string[],
    competitorContext: ''
  });
  const [results, setResults] = useState<BrandResult | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('cognitive');

  const handlePrincipleToggle = (principleName: string) => {
    setFormData(prev => ({
      ...prev,
      selectedPrinciples: prev.selectedPrinciples.includes(principleName)
        ? prev.selectedPrinciples.filter(p => p !== principleName)
        : [...prev.selectedPrinciples, principleName]
    }));
  };

  const generateBrand = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/brand/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          psychologyPreference: formData.selectedPrinciples
        })
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data.result);
        setStep(4);
      }
    } catch (error) {
      console.error('Failed to generate brand:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-bold text-white mb-4">
            Psychology-Powered Brand Generator
          </h1>
          <p className="text-xl text-gray-300">
            Leverage 50+ psychological principles to create irresistible brands
          </p>
        </motion.div>

        {/* Progress Steps */}
        <div className="flex justify-center mb-12">
          <div className="flex items-center space-x-4">
            {[1, 2, 3, 4].map((s) => (
              <React.Fragment key={s}>
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: step >= s ? 1 : 0.8 }}
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold ${
                    step >= s ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white' : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {s}
                </motion.div>
                {s < 4 && (
                  <div className={`w-24 h-1 ${step > s ? 'bg-cyan-500' : 'bg-gray-700'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Business Info */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className="bg-[#0f172a]/50 backdrop-blur-lg rounded-3xl p-8 border border-cyan-500/20"
            >
              <h2 className="text-3xl font-bold text-white mb-6">Tell us about your business</h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-gray-300 mb-2">Business Type</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-[#0a1628]/50 border border-cyan-500/30 rounded-xl text-white focus:border-cyan-500 focus:outline-none"
                    placeholder="e.g., SaaS, E-commerce, Consulting..."
                    value={formData.businessType}
                    onChange={(e) => setFormData({...formData, businessType: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-gray-300 mb-2">Target Audience</label>
                  <textarea
                    className="w-full px-4 py-3 bg-[#0a1628]/50 border border-cyan-500/30 rounded-xl text-white focus:border-cyan-500 focus:outline-none"
                    rows={3}
                    placeholder="Describe your ideal customers..."
                    onChange={(e) => setFormData({
                      ...formData,
                      targetAudience: {
                        ...formData.targetAudience,
                        demographics: [e.target.value] as any
                      }
                    })}
                  />
                </div>

                <div>
                  <label className="block text-gray-300 mb-2">Brand Goals</label>
                  <div className="grid grid-cols-2 gap-4">
                    {['Increase Trust', 'Drive Sales', 'Build Community', 'Stand Out'].map(goal => (
                      <button
                        key={goal}
                        onClick={() => setFormData({
                          ...formData,
                          brandGoals: (formData.brandGoals as any[]).includes(goal)
                            ? (formData.brandGoals as any[]).filter((g: any) => g !== goal)
                            : [...(formData.brandGoals as any[]), goal]
                        })}
                        className={`px-4 py-3 rounded-xl border transition-all ${
                          (formData.brandGoals as any[]).includes(goal)
                            ? 'bg-cyan-500 border-cyan-500 text-white'
                            : 'bg-[#0a1628]/50 border-cyan-500/30 text-gray-300 hover:border-cyan-500'
                        }`}
                      >
                        {goal}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setStep(2)}
                  disabled={!formData.businessType || formData.brandGoals.length === 0}
                  className="w-full py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-bold rounded-xl hover:from-cyan-400 hover:to-cyan-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue to Psychology Selection
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Psychology Selection */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className="bg-[#0f172a]/50 backdrop-blur-lg rounded-3xl p-8 border border-cyan-500/20"
            >
              <h2 className="text-3xl font-bold text-white mb-6">Select Psychological Principles</h2>

              {/* Category Tabs */}
              <div className="flex flex-wrap gap-3 mb-8">
                {PSYCHOLOGY_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                      selectedCategory === cat.id
                        ? `bg-gradient-to-r ${cat.color} text-white`
                        : 'bg-[#0a1628]/50 text-gray-300 hover:bg-[#0a1628]'
                    }`}
                  >
                    <cat.icon className="w-5 h-5" />
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Principles Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {PSYCHOLOGY_PRINCIPLES
                  .filter(p => p.category === selectedCategory)
                  .map(principle => (
                    <motion.button
                      key={principle.name}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handlePrincipleToggle(principle.name)}
                      className={`p-4 rounded-xl border transition-all text-left ${
                        formData.selectedPrinciples.includes(principle.name)
                          ? 'bg-cyan-500/20 border-cyan-500 text-white'
                          : 'bg-[#0a1628]/50 border-gray-700 text-gray-300 hover:border-cyan-500/50'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold">{principle.name}</h3>
                        <span className="text-xs px-2 py-1 bg-cyan-500/20 rounded-full">
                          {principle.relevanceScore}%
                        </span>
                      </div>
                      <p className="text-sm opacity-80">{principle.description}</p>
                    </motion.button>
                  ))}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-4 bg-gray-700 text-white font-bold rounded-xl hover:bg-gray-600 transition-all"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={formData.selectedPrinciples.length === 0}
                  className="flex-1 py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-bold rounded-xl hover:from-cyan-400 hover:to-cyan-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue to Tone Selection
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Tone & Final Details */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className="bg-[#0f172a]/50 backdrop-blur-lg rounded-3xl p-8 border border-cyan-500/20"
            >
              <h2 className="text-3xl font-bold text-white mb-6">Final Details</h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-gray-300 mb-2">Brand Tone</label>
                  <div className="grid grid-cols-3 gap-4">
                    {['Professional', 'Friendly', 'Bold', 'Luxurious', 'Playful', 'Innovative'].map(tone => (
                      <button
                        key={tone}
                        onClick={() => setFormData({...formData, tonePreference: tone})}
                        className={`px-4 py-3 rounded-xl border transition-all ${
                          formData.tonePreference === tone
                            ? 'bg-cyan-500 border-cyan-500 text-white'
                            : 'bg-[#0a1628]/50 border-cyan-500/30 text-gray-300 hover:border-cyan-500'
                        }`}
                      >
                        {tone}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-gray-300 mb-2">Competitor Context (Optional)</label>
                  <textarea
                    className="w-full px-4 py-3 bg-[#0a1628]/50 border border-cyan-500/30 rounded-xl text-white focus:border-cyan-500 focus:outline-none"
                    rows={3}
                    placeholder="Describe your main competitors..."
                    value={formData.competitorContext}
                    onChange={(e) => setFormData({...formData, competitorContext: e.target.value})}
                  />
                </div>

                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-6">
                  <h3 className="text-xl font-semibold text-white mb-3">Summary</h3>
                  <div className="space-y-2 text-gray-300">
                    <p><span className="font-semibold">Business:</span> {formData.businessType}</p>
                    <p><span className="font-semibold">Goals:</span> {formData.brandGoals.join(', ')}</p>
                    <p><span className="font-semibold">Psychology:</span> {formData.selectedPrinciples.length} principles selected</p>
                    <p><span className="font-semibold">Tone:</span> {formData.tonePreference}</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setStep(2)}
                    className="flex-1 py-4 bg-gray-700 text-white font-bold rounded-xl hover:bg-gray-600 transition-all"
                  >
                    Back
                  </button>
                  <button
                    onClick={generateBrand}
                    disabled={!formData.tonePreference || loading}
                    className="flex-1 py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-bold rounded-xl hover:from-cyan-400 hover:to-cyan-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5" />
                        Generate Brand
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 4: Results */}
          {step === 4 && results && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-8"
            >
              {/* Effectiveness Score */}
              <div className="bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-3xl p-8 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold mb-2">Your Psychology-Powered Brand</h2>
                    <p className="text-xl opacity-90">Effectiveness Score</p>
                  </div>
                  <div className="text-6xl font-bold">
                    {results.effectivenessScore}%
                  </div>
                </div>
              </div>

              {/* Brand Names */}
              <div className="bg-[#0f172a]/50 backdrop-blur-lg rounded-3xl p-8 border border-cyan-500/20">
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <Award className="w-6 h-6 text-cyan-400" />
                  Brand Names
                </h3>
                <div className="grid gap-4">
                  {results.brandNames.map((name, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="bg-[#0a1628]/50 rounded-xl p-6 border border-cyan-500/20"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="text-2xl font-bold text-white">{name.name}</h4>
                        <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded-full text-sm">
                          {name.memorabilityFactor}/10
                        </span>
                      </div>
                      <p className="text-gray-300 mb-2">
                        <span className="font-semibold text-cyan-400">Trigger:</span> {name.psychologicalTrigger}
                      </p>
                      <p className="text-gray-400">{name.rationale}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Taglines */}
              <div className="bg-[#0f172a]/50 backdrop-blur-lg rounded-3xl p-8 border border-cyan-500/20">
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-yellow-400" />
                  Taglines
                </h3>
                <div className="grid gap-4">
                  {results.taglines.map((tagline, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="bg-[#0a1628]/50 rounded-xl p-6 border border-cyan-500/20"
                    >
                      <h4 className="text-xl font-bold text-white mb-3">"{tagline.text}"</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-cyan-400 font-semibold">Target:</span>
                          <p className="text-gray-300">{tagline.psychologicalTarget}</p>
                        </div>
                        <div>
                          <span className="text-cyan-400 font-semibold">Emotion:</span>
                          <p className="text-gray-300">{tagline.emotionalResonance}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Platform Metadata */}
              <div className="bg-[#0f172a]/50 backdrop-blur-lg rounded-3xl p-8 border border-cyan-500/20">
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <Package className="w-6 h-6 text-green-400" />
                  Platform Optimization
                </h3>
                <div className="grid lg:grid-cols-2 gap-6">
                  {results.metadataPackages.map((pkg, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="bg-[#0a1628]/50 rounded-xl p-6 border border-cyan-500/20"
                    >
                      <h4 className="text-lg font-bold text-white mb-3 capitalize">{pkg.platform}</h4>
                      <div className="space-y-3 text-sm">
                        <div>
                          <span className="text-cyan-400 font-semibold">Title:</span>
                          <p className="text-gray-300">{pkg.title}</p>
                        </div>
                        <div>
                          <span className="text-cyan-400 font-semibold">Keywords:</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {pkg.keywords.map((kw, i) => (
                              <span key={i} className="px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded-full text-xs">
                                {kw}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-cyan-400 font-semibold">Hashtags:</span>
                          <p className="text-gray-300">{pkg.hashtags.join(' ')}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setStep(1);
                    setResults(null);
                    setFormData({
                      businessType: '',
                      targetAudience: { demographics: [], psychographics: [], painPoints: [] },
                      brandGoals: [],
                      tonePreference: '',
                      selectedPrinciples: [],
                      competitorContext: ''
                    });
                  }}
                  className="flex-1 py-4 bg-gray-700 text-white font-bold rounded-xl hover:bg-gray-600 transition-all"
                >
                  Generate Another Brand
                </button>
                <button
                  className="flex-1 py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-bold rounded-xl hover:from-cyan-400 hover:to-cyan-500 transition-all"
                >
                  Save & Deploy Brand
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
