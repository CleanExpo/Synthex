'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, ChevronRight, Building, User, Sparkles, Target, Users, Zap } from '@/components/icons';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [userData, setUserData] = useState({
    userType: '',
    companyName: '',
    industry: '',
    teamSize: '',
    goals: [] as string[],
    platforms: [] as string[],
    contentTypes: [] as string[]
  });

  // Restore progress on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedProgress = localStorage.getItem('onboardingProgress');
      if (savedProgress) {
        try {
          const { step: savedStep, userData: savedData } = JSON.parse(savedProgress);
          setStep(savedStep);
          setUserData(savedData);
          toast.success('Welcome back! We restored your progress.');
        } catch (error) {
          console.error('Failed to restore progress:', error);
        }
      }
    }
  }, []);

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  const validateStep = () => {
    switch(step) {
      case 1:
        if (!userData.userType) {
          toast.error('Please select your account type');
          return false;
        }
        break;
      case 2:
        if (!userData.companyName || userData.companyName.trim().length < 2) {
          toast.error('Please enter your name or company name');
          return false;
        }
        break;
      case 3:
        if (userData.goals.length === 0) {
          toast.error('Please select at least one goal');
          return false;
        }
        break;
      case 4:
        if (userData.platforms.length === 0) {
          toast.error('Please select at least one platform');
          return false;
        }
        break;
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    
    if (step < totalSteps) {
      setStep(step + 1);
      // Save progress to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('onboardingProgress', JSON.stringify({ step: step + 1, userData }));
      }
    } else {
      // Save onboarding data and redirect to dashboard
      if (typeof window !== 'undefined') {
        localStorage.setItem('onboardingComplete', 'true');
        localStorage.setItem('userData', JSON.stringify(userData));
        localStorage.removeItem('onboardingProgress');
      }
      toast.success('Welcome to SYNTHEX! Let\'s create amazing content together! 🚀');
      router.push('/dashboard');
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      if (typeof window !== 'undefined') {
        localStorage.setItem('onboardingProgress', JSON.stringify({ step: step - 1, userData }));
      }
    }
  };

  const handleSkip = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('onboardingComplete', 'true');
    }
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0A0A] via-[#111111] to-[#1A1A1A] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-400">Step {step} of {totalSteps}</span>
            <Button variant="ghost" onClick={handleSkip} className="text-gray-400 hover:text-white">
              Skip for now
            </Button>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Welcome to SYNTHEX
            </CardTitle>
            <CardDescription className="text-gray-400">
              Let's personalize your experience to get you started
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: User Type */}
            {step === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">What best describes you?</h3>
                <RadioGroup value={userData.userType} onValueChange={(value) => setUserData({...userData, userType: value})}>
                  <div className="flex items-center space-x-3 p-4 rounded-lg border border-gray-800 hover:border-purple-500 transition cursor-pointer">
                    <RadioGroupItem value="individual" id="individual" />
                    <Label htmlFor="individual" className="flex items-center gap-3 cursor-pointer">
                      <User className="h-5 w-5 text-purple-400" />
                      <div>
                        <p className="font-medium">Individual Creator</p>
                        <p className="text-sm text-gray-400">Personal brand, influencer, or freelancer</p>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 p-4 rounded-lg border border-gray-800 hover:border-purple-500 transition cursor-pointer">
                    <RadioGroupItem value="business" id="business" />
                    <Label htmlFor="business" className="flex items-center gap-3 cursor-pointer">
                      <Building className="h-5 w-5 text-purple-400" />
                      <div>
                        <p className="font-medium">Business/Team</p>
                        <p className="text-sm text-gray-400">Company, agency, or organization</p>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            {/* Step 2: Company Details */}
            {step === 2 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Tell us about your {userData.userType === 'business' ? 'company' : 'work'}</h3>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="companyName">{userData.userType === 'business' ? 'Company Name' : 'Your Name/Brand'}</Label>
                    <Input 
                      id="companyName"
                      value={userData.companyName}
                      onChange={(e) => setUserData({...userData, companyName: e.target.value})}
                      placeholder="Enter name"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="industry">Industry</Label>
                    <Input 
                      id="industry"
                      value={userData.industry}
                      onChange={(e) => setUserData({...userData, industry: e.target.value})}
                      placeholder="e.g., Technology, Fashion, Healthcare"
                      className="mt-1"
                    />
                  </div>
                  {userData.userType === 'business' && (
                    <div>
                      <Label>Team Size</Label>
                      <RadioGroup value={userData.teamSize} onValueChange={(value) => setUserData({...userData, teamSize: value})}>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="1-10" id="small" />
                            <Label htmlFor="small">1-10</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="11-50" id="medium" />
                            <Label htmlFor="medium">11-50</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="51-200" id="large" />
                            <Label htmlFor="large">51-200</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="200+" id="enterprise" />
                            <Label htmlFor="enterprise">200+</Label>
                          </div>
                        </div>
                      </RadioGroup>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Goals */}
            {step === 3 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">What are your main goals with SYNTHEX?</h3>
                <div className="space-y-2">
                  {[
                    { id: 'engagement', label: 'Increase engagement', icon: Users },
                    { id: 'growth', label: 'Grow followers', icon: Target },
                    { id: 'brand', label: 'Build brand awareness', icon: Sparkles },
                    { id: 'efficiency', label: 'Save time on content creation', icon: Zap }
                  ].map((goal) => (
                    <label 
                      key={goal.id}
                      className="flex items-center space-x-3 p-3 rounded-lg border border-gray-800 hover:border-purple-500 transition cursor-pointer"
                    >
                      <input 
                        type="checkbox"
                        checked={userData.goals.includes(goal.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setUserData({...userData, goals: [...userData.goals, goal.id]});
                          } else {
                            setUserData({...userData, goals: userData.goals.filter(g => g !== goal.id)});
                          }
                        }}
                        className="rounded border-gray-700"
                      />
                      <goal.icon className="h-5 w-5 text-purple-400" />
                      <span>{goal.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Platforms */}
            {step === 4 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Which platforms do you use?</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    'Instagram', 'Twitter/X', 'LinkedIn', 'Facebook',
                    'TikTok', 'YouTube', 'Pinterest', 'Threads'
                  ].map((platform) => (
                    <label 
                      key={platform}
                      className="flex items-center space-x-2 p-3 rounded-lg border border-gray-800 hover:border-purple-500 transition cursor-pointer"
                    >
                      <input 
                        type="checkbox"
                        checked={userData.platforms.includes(platform)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setUserData({...userData, platforms: [...userData.platforms, platform]});
                          } else {
                            setUserData({...userData, platforms: userData.platforms.filter(p => p !== platform)});
                          }
                        }}
                        className="rounded border-gray-700"
                      />
                      <span>{platform}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-between pt-4">
              <Button 
                variant="outline" 
                onClick={() => setStep(step - 1)}
                disabled={step === 1}
                className="border-gray-700"
              >
                Back
              </Button>
              <Button 
                onClick={handleNext}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                {step === totalSteps ? (
                  <>
                    Complete Setup
                    <CheckCircle className="ml-2 h-4 w-4" />
                  </>
                ) : (
                  <>
                    Continue
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}