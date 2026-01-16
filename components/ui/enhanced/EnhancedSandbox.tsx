'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring, useDragControls } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Box, Sphere, Text, Float, MeshWobbleMaterial } from '@react-three/drei';
import {
  Code, Eye, Smartphone, Monitor, Tablet, Copy, Download, Share2,
  Palette, Type, Image, Video, Link2, Hash, AtSign, MessageSquare,
  Heart, Repeat, Bookmark, Send, MoreHorizontal, CheckCircle,
  Twitter, Linkedin, Instagram, Facebook, Youtube, Sparkles,
  Layers, Settings, Wand2, Brain, Zap, TrendingUp, BarChart3,
  Calendar, Clock, Users, Globe, Cpu, Database, Cloud, Shield,
  RefreshCw, Save, Play, Pause, SkipForward, Volume2, Mic, Camera
} from '@/components/icons';

// 3D Preview Component
function Preview3D({ content, platform }: { content: string; platform: string }) {
  const meshRef = useRef(null);
  
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <Float speed={2} rotationIntensity={1} floatIntensity={2}>
        <Box args={[3, 5, 0.1]} position={[0, 0, 0]}>
          <MeshWobbleMaterial 
            attach="material" 
            color="#8b5cf6" 
            speed={1} 
            factor={0.3}
          />
        </Box>
        <Text
          position={[0, 2, 0.1]}
          fontSize={0.3}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {platform}
        </Text>
        <Text
          position={[0, 0, 0.1]}
          fontSize={0.15}
          color="white"
          anchorX="center"
          anchorY="middle"
          maxWidth={2.5}
        >
          {content.substring(0, 100)}...
        </Text>
      </Float>
      <OrbitControls enableZoom={false} />
    </Canvas>
  );
}

// Draggable Card Component
function DraggableCard({ children, id, onDragEnd }: { children: React.ReactNode; id: string; onDragEnd?: (id: string, info: any) => void }) {
  const dragControls = useDragControls();
  const [isDragging, setIsDragging] = useState(false);

  return (
    <motion.div
      drag
      dragControls={dragControls}
      dragElastic={0.2}
      dragConstraints={{ left: -200, right: 200, top: -200, bottom: 200 }}
      whileDrag={{ scale: 1.1, zIndex: 100 }}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={(e, info) => {
        setIsDragging(false);
        onDragEnd && onDragEnd(id, info);
      }}
      className={`relative ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{
        boxShadow: isDragging 
          ? '0 20px 40px rgba(139, 92, 246, 0.4)' 
          : '0 4px 6px rgba(0, 0, 0, 0.1)',
      }}
    >
      {children}
    </motion.div>
  );
}

// Animated Tool Button
function ToolButton({ icon: Icon, label, isActive, onClick, color = 'purple' }: { icon: any; label: string; isActive: boolean; onClick: () => void; color?: string }) {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onClick}
      className={`relative p-3 rounded-xl transition-all ${
        isActive 
          ? `bg-gradient-to-br from-${color}-500 to-${color}-600 text-white` 
          : 'bg-gray-800/50 text-gray-400 hover:text-white'
      }`}
    >
      <Icon className="w-5 h-5" />
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.8 }}
            className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded whitespace-nowrap z-50"
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// Platform Selector with 3D Icons
function PlatformSelector({ selected, onSelect }: { selected: string; onSelect: (platform: string) => void }) {
  const platforms = [
    { id: 'twitter', icon: Twitter, color: '#1DA1F2' },
    { id: 'instagram', icon: Instagram, color: '#E4405F' },
    { id: 'linkedin', icon: Linkedin, color: '#0077B5' },
    { id: 'facebook', icon: Facebook, color: '#1877F2' },
    { id: 'youtube', icon: Youtube, color: '#FF0000' },
  ];

  return (
    <div className="flex gap-4">
      {platforms.map((platform) => (
        <motion.button
          key={platform.id}
          whileHover={{ scale: 1.2, rotateZ: 5 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => onSelect(platform.id)}
          className={`relative p-4 rounded-2xl transition-all ${
            selected === platform.id 
              ? 'bg-gray-800 shadow-xl' 
              : 'bg-gray-900/50'
          }`}
          style={{
            boxShadow: selected === platform.id 
              ? `0 10px 30px ${platform.color}40` 
              : 'none',
          }}
        >
          <platform.icon 
            className="w-6 h-6"
            style={{ color: selected === platform.id ? platform.color : '#9CA3AF' }}
          />
          {selected === platform.id && (
            <motion.div
              layoutId="platform-indicator"
              className="absolute inset-0 rounded-2xl border-2"
              style={{ borderColor: platform.color }}
            />
          )}
        </motion.button>
      ))}
    </div>
  );
}

// AI Content Generator Panel
function AIGeneratorPanel({ onGenerate }: { onGenerate: (data: any) => void }) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [tone, setTone] = useState('professional');
  const [length, setLength] = useState('medium');

  const handleGenerate = async () => {
    setIsGenerating(true);
    // Simulate AI generation
    setTimeout(() => {
      onGenerate({
        content: `Generated content based on: ${prompt}`,
        tone,
        length,
      });
      setIsGenerating(false);
    }, 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/20"
    >
      <div className="flex items-center gap-2 mb-4">
        <Brain className="w-6 h-6 text-purple-400" />
        <h3 className="text-xl font-bold text-white">AI Content Generator</h3>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe what you want to create..."
        className="w-full p-4 bg-gray-900/50 border border-purple-500/20 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none resize-none"
        rows={4}
      />

      <div className="grid grid-cols-2 gap-4 mt-4">
        <div>
          <label className="text-sm text-gray-400 mb-2 block">Tone</label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="w-full p-2 bg-gray-900/50 border border-purple-500/20 rounded-lg text-white focus:border-purple-500 focus:outline-none"
          >
            <option value="professional">Professional</option>
            <option value="casual">Casual</option>
            <option value="humorous">Humorous</option>
            <option value="inspirational">Inspirational</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-400 mb-2 block">Length</label>
          <select
            value={length}
            onChange={(e) => setLength(e.target.value)}
            className="w-full p-2 bg-gray-900/50 border border-purple-500/20 rounded-lg text-white focus:border-purple-500 focus:outline-none"
          >
            <option value="short">Short</option>
            <option value="medium">Medium</option>
            <option value="long">Long</option>
          </select>
        </div>
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleGenerate}
        disabled={!prompt || isGenerating}
        className="w-full mt-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isGenerating ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="inline-block"
          >
            <RefreshCw className="w-5 h-5 inline" />
          </motion.div>
        ) : (
          <>
            <Sparkles className="w-5 h-5 inline mr-2" />
            Generate with AI
          </>
        )}
      </motion.button>
    </motion.div>
  );
}

// Analytics Dashboard Component
function AnalyticsDashboard() {
  const metrics = [
    { label: 'Engagement', value: 87, change: +12, color: 'purple' },
    { label: 'Reach', value: 65, change: +8, color: 'pink' },
    { label: 'Conversions', value: 92, change: +15, color: 'blue' },
    { label: 'ROI', value: 78, change: +5, color: 'green' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/20"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-purple-400" />
          Real-time Analytics
        </h3>
        <motion.button
          whileHover={{ scale: 1.1 }}
          className="text-gray-400 hover:text-white"
        >
          <RefreshCw className="w-5 h-5" />
        </motion.button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.05 }}
            className="bg-gray-800/50 rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">{metric.label}</span>
              <motion.span
                className={`text-sm ${metric.change > 0 ? 'text-green-400' : 'text-red-400'}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
              >
                {metric.change > 0 ? '+' : ''}{metric.change}%
              </motion.span>
            </div>
            <div className="text-2xl font-bold text-white mb-2">{metric.value}%</div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${metric.value}%` }}
                transition={{ duration: 1, delay: index * 0.1 }}
                className={`h-2 rounded-full bg-gradient-to-r from-${metric.color}-500 to-${metric.color}-400`}
              />
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        className="mt-6 p-4 bg-purple-500/10 rounded-xl border border-purple-500/20"
        whileHover={{ scale: 1.02 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-purple-400 text-sm">AI Recommendation</p>
            <p className="text-white mt-1">Post at 2:30 PM for 45% higher engagement</p>
          </div>
          <Zap className="w-8 h-8 text-purple-400" />
        </div>
      </motion.div>
    </motion.div>
  );
}

// Enhanced Sandbox Component
export default function EnhancedSandbox() {
  const [activeView, setActiveView] = useState('edit');
  const [selectedPlatform, setSelectedPlatform] = useState('twitter');
  const [content, setContent] = useState('');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [devicePreview, setDevicePreview] = useState('desktop');

  const toggleTool = (tool: string) => {
    setSelectedTools(prev => 
      prev.includes(tool) 
        ? prev.filter(t => t !== tool)
        : [...prev, tool]
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/30 to-gray-900 p-6">
      {/* Animated Background */}
      <div className="fixed inset-0 z-0">
        <motion.div
          className="absolute inset-0"
          animate={{
            background: [
              'radial-gradient(circle at 0% 0%, rgba(139, 92, 246, 0.1) 0%, transparent 50%)',
              'radial-gradient(circle at 100% 100%, rgba(236, 72, 153, 0.1) 0%, transparent 50%)',
              'radial-gradient(circle at 0% 100%, rgba(139, 92, 246, 0.1) 0%, transparent 50%)',
              'radial-gradient(circle at 100% 0%, rgba(236, 72, 153, 0.1) 0%, transparent 50%)',
            ]
          }}
          transition={{ duration: 10, repeat: Infinity }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Content Sandbox</h1>
              <p className="text-gray-400">Create, preview, and optimize your social media content</p>
            </div>
            <div className="flex gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-gray-800/50 text-white rounded-xl hover:bg-gray-700/50 transition-colors flex items-center gap-2"
              >
                <Save className="w-5 h-5" />
                Save Draft
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold flex items-center gap-2"
              >
                <Send className="w-5 h-5" />
                Publish
              </motion.button>
            </div>
          </div>
        </motion.header>

        {/* Platform Selector */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <PlatformSelector selected={selectedPlatform} onSelect={setSelectedPlatform} />
        </motion.div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - AI Generator */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <AIGeneratorPanel onGenerate={(data) => setContent(data.content)} />
            
            {/* Tools Panel */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-6 bg-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/20"
            >
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Layers className="w-6 h-6 text-purple-400" />
                Content Tools
              </h3>
              <div className="grid grid-cols-4 gap-3">
                <ToolButton icon={Type} label="Text" isActive={selectedTools.includes('text')} onClick={() => toggleTool('text')} />
                <ToolButton icon={Image} label="Image" isActive={selectedTools.includes('image')} onClick={() => toggleTool('image')} />
                <ToolButton icon={Video} label="Video" isActive={selectedTools.includes('video')} onClick={() => toggleTool('video')} />
                <ToolButton icon={Link2} label="Link" isActive={selectedTools.includes('link')} onClick={() => toggleTool('link')} />
                <ToolButton icon={Hash} label="Hashtag" isActive={selectedTools.includes('hashtag')} onClick={() => toggleTool('hashtag')} />
                <ToolButton icon={AtSign} label="Mention" isActive={selectedTools.includes('mention')} onClick={() => toggleTool('mention')} />
                <ToolButton icon={Calendar} label="Schedule" isActive={selectedTools.includes('schedule')} onClick={() => toggleTool('schedule')} />
                <ToolButton icon={Globe} label="Location" isActive={selectedTools.includes('location')} onClick={() => toggleTool('location')} />
              </div>
            </motion.div>
          </motion.div>

          {/* Center Panel - Editor */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-1"
          >
            <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-purple-500/20 overflow-hidden">
              {/* Editor Header */}
              <div className="flex items-center justify-between p-4 border-b border-purple-500/20">
                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveView('edit')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      activeView === 'edit' 
                        ? 'bg-purple-500 text-white' 
                        : 'bg-gray-800/50 text-gray-400'
                    }`}
                  >
                    <Code className="w-5 h-5" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveView('preview')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      activeView === 'preview' 
                        ? 'bg-purple-500 text-white' 
                        : 'bg-gray-800/50 text-gray-400'
                    }`}
                  >
                    <Eye className="w-5 h-5" />
                  </motion.button>
                </div>
                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    onClick={() => setDevicePreview('mobile')}
                    className={`p-2 rounded-lg ${devicePreview === 'mobile' ? 'bg-purple-500 text-white' : 'text-gray-400'}`}
                  >
                    <Smartphone className="w-5 h-5" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    onClick={() => setDevicePreview('tablet')}
                    className={`p-2 rounded-lg ${devicePreview === 'tablet' ? 'bg-purple-500 text-white' : 'text-gray-400'}`}
                  >
                    <Tablet className="w-5 h-5" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    onClick={() => setDevicePreview('desktop')}
                    className={`p-2 rounded-lg ${devicePreview === 'desktop' ? 'bg-purple-500 text-white' : 'text-gray-400'}`}
                  >
                    <Monitor className="w-5 h-5" />
                  </motion.button>
                </div>
              </div>

              {/* Editor Content */}
              <AnimatePresence mode="wait">
                {activeView === 'edit' ? (
                  <motion.div
                    key="edit"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="p-6"
                  >
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Start typing your content..."
                      className="w-full h-96 p-4 bg-gray-800/50 border border-purple-500/20 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none resize-none"
                    />
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-gray-400 text-sm">
                        {content.length} / {selectedPlatform === 'twitter' ? 280 : 2200} characters
                      </span>
                      <div className="flex gap-2">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          className="p-2 text-gray-400 hover:text-white"
                        >
                          <Mic className="w-5 h-5" />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          className="p-2 text-gray-400 hover:text-white"
                        >
                          <Camera className="w-5 h-5" />
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="p-6 h-[500px]"
                  >
                    <Preview3D content={content || 'Your content preview will appear here'} platform={selectedPlatform} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Right Panel - Analytics */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <AnalyticsDashboard />
            
            {/* Psychology Score */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-6 bg-gradient-to-br from-purple-900/20 to-pink-900/20 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/20"
            >
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Brain className="w-6 h-6 text-purple-400" />
                Psychology Score
              </h3>
              <div className="space-y-3">
                {['Urgency', 'Social Proof', 'Authority', 'Scarcity'].map((principle, index) => (
                  <div key={principle}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">{principle}</span>
                      <span className="text-white">{75 + index * 5}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${75 + index * 5}%` }}
                        transition={{ duration: 1, delay: index * 0.1 }}
                        className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Floating Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="fixed bottom-8 right-8 flex flex-col gap-4"
        >
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="w-14 h-14 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white shadow-lg"
          >
            <Wand2 className="w-6 h-6" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="w-14 h-14 bg-gray-800 rounded-full flex items-center justify-center text-white shadow-lg"
          >
            <Settings className="w-6 h-6" />
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}