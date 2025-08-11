import toast from 'react-hot-toast';

/**
 * Centralized notification system with consistent messaging
 */

// Success messages with emojis for delight
export const notify = {
  // Content actions
  contentGenerated: () => toast.success('🎉 Content generated successfully!'),
  contentSaved: () => toast.success('✅ Content saved'),
  contentPublished: () => toast.success('🚀 Content published! It\'s live now'),
  contentScheduled: (time: string) => toast.success(`📅 Scheduled for ${time}`),
  contentDeleted: () => toast.success('🗑️ Content deleted'),
  contentCopied: () => toast.success('📋 Copied to clipboard'),
  
  // User actions
  loginSuccess: (name?: string) => toast.success(`👋 Welcome back${name ? `, ${name}` : ''}!`),
  logoutSuccess: () => toast.success('👋 See you soon!'),
  profileUpdated: () => toast.success('✅ Profile updated successfully'),
  settingsSaved: () => toast.success('⚙️ Settings saved'),
  passwordChanged: () => toast.success('🔒 Password updated successfully'),
  
  // Data actions
  dataLoaded: () => toast.success('✅ Data loaded'),
  dataExported: () => toast.success('📊 Data exported successfully'),
  dataImported: (count: number) => toast.success(`📥 ${count} items imported`),
  
  // Collaboration
  teamMemberAdded: (name: string) => toast.success(`➕ ${name} added to team`),
  commentPosted: () => toast.success('💬 Comment posted'),
  mentioned: (by: string) => toast.success(`🔔 ${by} mentioned you`),
  
  // Achievements
  milestone: (achievement: string) => toast.success(`🏆 Achievement unlocked: ${achievement}!`, {
    duration: 5000,
    icon: '🎊'
  }),
  
  // Errors with helpful messages
  error: (message: string, suggestion?: string) => 
    toast.error(
      <div>
        <strong>{message}</strong>
        {suggestion && <p className="text-sm mt-1">{suggestion}</p>}
      </div>
    ),
  
  // Network errors
  networkError: () => toast.error('📡 Network error. Check your connection'),
  serverError: () => toast.error('🔧 Server error. We\'re working on it'),
  
  // Validation errors
  validationError: (field: string) => toast.error(`❌ Please check ${field}`),
  requiredField: (field: string) => toast.error(`${field} is required`),
  
  // Loading states
  loading: (message: string) => toast.loading(message),
  
  // Promise-based toasts
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    }
  ) => toast.promise(promise, messages),
  
  // Custom toast
  custom: (message: React.ReactNode) => toast.custom(message),
  
  // Dismiss all toasts
  dismiss: () => toast.dismiss(),
};

// Loading messages for variety
export const loadingMessages = {
  content: [
    "🧠 Analyzing viral patterns...",
    "✨ Crafting the perfect hook...",
    "🎯 Optimizing for engagement...",
    "🚀 Making your content irresistible...",
    "💡 Learning from top performers...",
    "🎨 Adding that special touch...",
    "⚡ Supercharging your message...",
    "🔥 Creating viral magic..."
  ],
  
  analytics: [
    "📊 Crunching the numbers...",
    "📈 Analyzing trends...",
    "🔍 Finding insights...",
    "💹 Calculating metrics...",
    "🎯 Identifying patterns..."
  ],
  
  save: [
    "💾 Saving your work...",
    "☁️ Syncing to cloud...",
    "🔒 Securing your data...",
    "📝 Updating records..."
  ],
  
  getRandomMessage: (type: keyof typeof loadingMessages): string => {
    const messages = loadingMessages[type];
    return messages[Math.floor(Math.random() * messages.length)];
  }
};