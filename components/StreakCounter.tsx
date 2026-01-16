'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Flame, 
  Trophy, 
  Calendar, 
  TrendingUp,
  Award,
  Star,
  Zap,
  Target,
  CheckCircle
} from '@/components/icons';
import { streakAnimation, levelUp, confetti } from '@/lib/celebrations';
import { notify } from '@/lib/notifications';

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalDays: number;
  lastActiveDate: string;
  level: number;
  points: number;
  nextMilestone: number;
  todayCompleted: boolean;
}

// Get or initialize streak data
function getStreakData(): StreakData {
  if (typeof window === 'undefined') {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalDays: 0,
      lastActiveDate: '',
      level: 1,
      points: 0,
      nextMilestone: 7,
      todayCompleted: false
    };
  }
  
  const stored = localStorage.getItem('streakData');
  if (stored) {
    return JSON.parse(stored);
  }
  
  return {
    currentStreak: 0,
    longestStreak: 0,
    totalDays: 0,
    lastActiveDate: '',
    level: 1,
    points: 0,
    nextMilestone: 7,
    todayCompleted: false
  };
}

// Save streak data
function saveStreakData(data: StreakData) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('streakData', JSON.stringify(data));
  }
}

// Check if user was active today
function checkDailyActivity(): boolean {
  if (typeof window === 'undefined') return false;
  
  // In production, this would check actual user activity
  const lastActivity = localStorage.getItem('lastActivity');
  const today = new Date().toDateString();
  return lastActivity === today;
}

// Mark today as active
function markTodayActive() {
  if (typeof window !== 'undefined') {
    localStorage.setItem('lastActivity', new Date().toDateString());
  }
}

// Calculate level from total days
function calculateLevel(totalDays: number): number {
  if (totalDays < 7) return 1;
  if (totalDays < 30) return 2;
  if (totalDays < 90) return 3;
  if (totalDays < 180) return 4;
  if (totalDays < 365) return 5;
  return 6; // Max level
}

// Get milestone rewards
function getMilestoneReward(days: number): string | null {
  const milestones: Record<number, string> = {
    3: '🥉 Bronze Streak',
    7: '🥈 Silver Streak',
    14: '🥇 Gold Streak',
    30: '💎 Diamond Streak',
    60: '🏆 Champion',
    90: '⭐ Superstar',
    180: '🚀 Legend',
    365: '👑 Master'
  };
  
  return milestones[days] || null;
}

export function StreakCounter({ compact = false }: { compact?: boolean }) {
  const [streakData, setStreakData] = useState<StreakData>(getStreakData());
  const [showCelebration, setShowCelebration] = useState(false);
  
  // Update streak on mount and daily
  useEffect(() => {
    const today = new Date().toDateString();
    const data = getStreakData();
    
    // Check if it's a new day
    if (data.lastActiveDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      // Check if streak continues
      if (data.lastActiveDate === yesterday.toDateString()) {
        // Streak continues
        data.currentStreak++;
        data.totalDays++;
      } else if (data.lastActiveDate === '') {
        // First time user
        data.currentStreak = 1;
        data.totalDays = 1;
      } else {
        // Streak broken
        if (data.currentStreak > 0) {
          notify.error(`Streak broken! You had ${data.currentStreak} days`);
        }
        data.currentStreak = 1;
        data.totalDays++;
      }
      
      // Update longest streak
      if (data.currentStreak > data.longestStreak) {
        data.longestStreak = data.currentStreak;
      }
      
      // Update level
      const newLevel = calculateLevel(data.totalDays);
      if (newLevel > data.level) {
        data.level = newLevel;
        levelUp(newLevel);
      }
      
      // Check for milestone
      const milestone = getMilestoneReward(data.currentStreak);
      if (milestone) {
        notify.milestone(milestone);
        confetti();
        setShowCelebration(true);
      }
      
      // Add points
      data.points += data.currentStreak * 10;
      
      // Update next milestone
      const milestones = [3, 7, 14, 30, 60, 90, 180, 365];
      data.nextMilestone = milestones.find(m => m > data.currentStreak) || 365;
      
      data.lastActiveDate = today;
      data.todayCompleted = false;
      
      saveStreakData(data);
      setStreakData(data);
      
      // Animate if streak is significant
      if (data.currentStreak > 1) {
        streakAnimation(data.currentStreak);
      }
    }
  }, []);
  
  // Complete today's activity
  const completeTodayActivity = () => {
    if (!streakData.todayCompleted) {
      markTodayActive();
      const newData = { ...streakData, todayCompleted: true };
      saveStreakData(newData);
      setStreakData(newData);
      notify.success('Daily activity completed! 🎉');
    }
  };
  
  // Calculate progress to next milestone
  const progressToMilestone = (streakData.currentStreak / streakData.nextMilestone) * 100;
  
  if (compact) {
    return (
      <button className="flex items-center gap-2 px-3 py-2 glass-card rounded-lg hover:bg-white/5 transition-colors">
        <Flame className={`h-5 w-5 ${streakData.currentStreak > 0 ? 'text-orange-400' : 'text-gray-400'}`} />
        <span className="font-bold text-white">{streakData.currentStreak}</span>
        <span className="text-xs text-gray-400">day streak</span>
      </button>
    );
  }
  
  return (
    <Card className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${
            streakData.currentStreak > 0 
              ? 'from-orange-500/20 to-red-500/20' 
              : 'from-gray-500/20 to-gray-600/20'
          }`}>
            <Flame className={`h-6 w-6 ${
              streakData.currentStreak > 0 ? 'text-orange-400' : 'text-gray-400'
            }`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Daily Streak</h3>
            <p className="text-sm text-gray-400">Keep your momentum going!</p>
          </div>
        </div>
        
        <div className="text-right">
          <p className="text-3xl font-bold gradient-text">{streakData.currentStreak}</p>
          <p className="text-xs text-gray-400">days</p>
        </div>
      </div>
      
      {/* Progress to next milestone */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Next milestone</span>
          <span className="text-white font-medium">
            {streakData.nextMilestone} days
          </span>
        </div>
        <Progress value={progressToMilestone} className="h-2" />
        <p className="text-xs text-gray-500">
          {streakData.nextMilestone - streakData.currentStreak} days to go
        </p>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-3 bg-white/5 rounded-lg">
          <Trophy className="h-5 w-5 text-yellow-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-white">{streakData.longestStreak}</p>
          <p className="text-xs text-gray-400">Best Streak</p>
        </div>
        
        <div className="text-center p-3 bg-white/5 rounded-lg">
          <Star className="h-5 w-5 text-purple-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-white">Lv.{streakData.level}</p>
          <p className="text-xs text-gray-400">Level</p>
        </div>
        
        <div className="text-center p-3 bg-white/5 rounded-lg">
          <Zap className="h-5 w-5 text-blue-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-white">{streakData.points}</p>
          <p className="text-xs text-gray-400">Points</p>
        </div>
      </div>
      
      {/* Daily Challenge */}
      {!streakData.todayCompleted && (
        <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-400" />
              <span className="font-medium text-white">Today's Challenge</span>
            </div>
            <span className="text-xs text-purple-400">+10 points</span>
          </div>
          <p className="text-sm text-gray-300 mb-3">
            Create and publish at least one piece of content
          </p>
          <Button 
            size="sm" 
            className="w-full gradient-primary"
            onClick={completeTodayActivity}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Complete Challenge
          </Button>
        </div>
      )}
      
      {/* Achievements Preview */}
      <div className="flex items-center justify-between pt-2 border-t border-white/10">
        <span className="text-sm text-gray-400">Recent Achievement</span>
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-yellow-400" />
          <span className="text-sm text-white">Content Creator</span>
        </div>
      </div>
    </Card>
  );
}

// Floating Streak Widget
export function FloatingStreak() {
  const [streakData] = useState<StreakData>(getStreakData());
  
  if (streakData.currentStreak === 0) return null;
  
  return (
    <div className="fixed top-20 right-6 z-40">
      <div className="flex items-center gap-2 px-3 py-2 glass-card rounded-full shadow-lg">
        <Flame className="h-4 w-4 text-orange-400 animate-pulse" />
        <span className="text-sm font-bold text-white">{streakData.currentStreak}</span>
        <span className="text-xs text-gray-400">streak</span>
      </div>
    </div>
  );
}