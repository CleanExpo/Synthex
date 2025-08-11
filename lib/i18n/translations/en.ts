/**
 * English translations
 */

export const en = {
  common: {
    // Actions
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    update: 'Update',
    submit: 'Submit',
    search: 'Search',
    filter: 'Filter',
    sort: 'Sort',
    export: 'Export',
    import: 'Import',
    upload: 'Upload',
    download: 'Download',
    refresh: 'Refresh',
    close: 'Close',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    confirm: 'Confirm',
    
    // Status
    loading: 'Loading...',
    processing: 'Processing...',
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    info: 'Information',
    
    // Time
    today: 'Today',
    yesterday: 'Yesterday',
    tomorrow: 'Tomorrow',
    week: 'Week',
    month: 'Month',
    year: 'Year',
    
    // General
    yes: 'Yes',
    no: 'No',
    all: 'All',
    none: 'None',
    select: 'Select',
    selected: 'Selected',
    items: 'items',
    results: 'Results',
    noResults: 'No results found',
    noData: 'No data available',
  },
  
  auth: {
    signIn: 'Sign In',
    signUp: 'Sign Up',
    signOut: 'Sign Out',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    forgotPassword: 'Forgot Password?',
    resetPassword: 'Reset Password',
    rememberMe: 'Remember me',
    orContinueWith: 'Or continue with',
    alreadyHaveAccount: 'Already have an account?',
    dontHaveAccount: "Don't have an account?",
    termsAndConditions: 'Terms and Conditions',
    privacyPolicy: 'Privacy Policy',
    
    errors: {
      invalidCredentials: 'Invalid email or password',
      userNotFound: 'User not found',
      emailAlreadyExists: 'Email already exists',
      weakPassword: 'Password is too weak',
      passwordMismatch: 'Passwords do not match',
      invalidEmail: 'Invalid email address',
    },
    
    success: {
      signInSuccess: 'Successfully signed in',
      signUpSuccess: 'Account created successfully',
      signOutSuccess: 'Successfully signed out',
      passwordResetSent: 'Password reset email sent',
      passwordChanged: 'Password changed successfully',
    },
  },
  
  dashboard: {
    title: 'Dashboard',
    welcome: 'Welcome back, {{name}}!',
    overview: 'Overview',
    analytics: 'Analytics',
    performance: 'Performance',
    reports: 'Reports',
    
    metrics: {
      totalCampaigns: 'Total Campaigns',
      activeProjects: 'Active Projects',
      engagement: 'Engagement Rate',
      conversion: 'Conversion Rate',
      reach: 'Total Reach',
      impressions: 'Impressions',
    },
    
    charts: {
      performanceOverTime: 'Performance Over Time',
      topPerformingContent: 'Top Performing Content',
      audienceGrowth: 'Audience Growth',
      engagementByPlatform: 'Engagement by Platform',
    },
  },
  
  campaigns: {
    title: 'Campaigns',
    createCampaign: 'Create Campaign',
    editCampaign: 'Edit Campaign',
    deleteCampaign: 'Delete Campaign',
    campaignName: 'Campaign Name',
    campaignType: 'Campaign Type',
    startDate: 'Start Date',
    endDate: 'End Date',
    budget: 'Budget',
    status: 'Status',
    
    types: {
      social: 'Social Media',
      email: 'Email Marketing',
      content: 'Content Marketing',
      paid: 'Paid Advertising',
      influencer: 'Influencer Marketing',
      seo: 'SEO',
    },
    
    statuses: {
      draft: 'Draft',
      scheduled: 'Scheduled',
      active: 'Active',
      paused: 'Paused',
      completed: 'Completed',
      archived: 'Archived',
    },
    
    messages: {
      created: 'Campaign created successfully',
      updated: 'Campaign updated successfully',
      deleted: 'Campaign deleted successfully',
      scheduled: 'Campaign scheduled successfully',
      activated: 'Campaign activated',
      paused: 'Campaign paused',
    },
  },
  
  content: {
    title: 'Content',
    createPost: 'Create Post',
    editPost: 'Edit Post',
    schedule: 'Schedule',
    publish: 'Publish',
    preview: 'Preview',
    
    editor: {
      title: 'Title',
      content: 'Content',
      description: 'Description',
      tags: 'Tags',
      category: 'Category',
      featuredImage: 'Featured Image',
      seoTitle: 'SEO Title',
      seoDescription: 'SEO Description',
      keywords: 'Keywords',
    },
    
    ai: {
      generateContent: 'Generate with AI',
      improveContent: 'Improve Content',
      suggestHashtags: 'Suggest Hashtags',
      optimizeForSEO: 'Optimize for SEO',
      generateCaption: 'Generate Caption',
      rewrite: 'Rewrite',
      expand: 'Expand',
      summarize: 'Summarize',
    },
  },
  
  analytics: {
    title: 'Analytics',
    overview: 'Overview',
    realtime: 'Real-time',
    audience: 'Audience',
    acquisition: 'Acquisition',
    behavior: 'Behavior',
    conversions: 'Conversions',
    
    metrics: {
      users: 'Users',
      sessions: 'Sessions',
      pageviews: 'Pageviews',
      bounceRate: 'Bounce Rate',
      avgSessionDuration: 'Avg. Session Duration',
      conversionRate: 'Conversion Rate',
      revenue: 'Revenue',
      transactions: 'Transactions',
    },
    
    periods: {
      last7Days: 'Last 7 days',
      last30Days: 'Last 30 days',
      last90Days: 'Last 90 days',
      lastYear: 'Last year',
      custom: 'Custom range',
    },
  },
  
  team: {
    title: 'Team',
    members: 'Team Members',
    inviteMembers: 'Invite Members',
    roles: 'Roles',
    permissions: 'Permissions',
    
    roles: {
      owner: 'Owner',
      admin: 'Admin',
      editor: 'Editor',
      viewer: 'Viewer',
      contributor: 'Contributor',
    },
    
    actions: {
      invite: 'Invite',
      remove: 'Remove',
      changeRole: 'Change Role',
      resendInvite: 'Resend Invite',
      cancelInvite: 'Cancel Invite',
    },
    
    messages: {
      invited: 'Invitation sent successfully',
      removed: 'Member removed successfully',
      roleChanged: 'Role changed successfully',
      inviteResent: 'Invitation resent',
      inviteCanceled: 'Invitation canceled',
    },
  },
  
  settings: {
    title: 'Settings',
    general: 'General',
    profile: 'Profile',
    account: 'Account',
    notifications: 'Notifications',
    security: 'Security',
    billing: 'Billing',
    integrations: 'Integrations',
    api: 'API',
    
    profile: {
      name: 'Name',
      email: 'Email',
      phone: 'Phone',
      bio: 'Bio',
      avatar: 'Avatar',
      timezone: 'Timezone',
      language: 'Language',
      dateFormat: 'Date Format',
    },
    
    notifications: {
      email: 'Email Notifications',
      push: 'Push Notifications',
      desktop: 'Desktop Notifications',
      marketing: 'Marketing Emails',
      updates: 'Product Updates',
      tips: 'Tips & Tutorials',
    },
    
    security: {
      changePassword: 'Change Password',
      twoFactor: 'Two-Factor Authentication',
      sessions: 'Active Sessions',
      apiKeys: 'API Keys',
      activityLog: 'Activity Log',
    },
  },
  
  errors: {
    generic: 'Something went wrong. Please try again.',
    network: 'Network error. Please check your connection.',
    notFound: 'Page not found',
    unauthorized: 'You are not authorized to perform this action',
    forbidden: 'Access forbidden',
    serverError: 'Server error. Please try again later.',
    validation: 'Please check your input and try again.',
    
    404: {
      title: 'Page Not Found',
      message: "The page you're looking for doesn't exist.",
      action: 'Go to Dashboard',
    },
    
    500: {
      title: 'Server Error',
      message: 'Something went wrong on our end.',
      action: 'Try Again',
    },
  },
  
  validation: {
    required: 'This field is required',
    email: 'Please enter a valid email',
    minLength: 'Must be at least {{count}} characters',
    maxLength: 'Must be no more than {{count}} characters',
    minValue: 'Must be at least {{value}}',
    maxValue: 'Must be no more than {{value}}',
    pattern: 'Invalid format',
    url: 'Please enter a valid URL',
    phone: 'Please enter a valid phone number',
    number: 'Please enter a valid number',
    integer: 'Please enter a whole number',
    decimal: 'Please enter a valid decimal number',
    date: 'Please enter a valid date',
    time: 'Please enter a valid time',
    datetime: 'Please enter a valid date and time',
    fileSize: 'File size must be less than {{size}}',
    fileType: 'File type not supported',
  },
  
  notifications: {
    success: {
      saved: 'Saved successfully',
      updated: 'Updated successfully',
      deleted: 'Deleted successfully',
      uploaded: 'Uploaded successfully',
      sent: 'Sent successfully',
      copied: 'Copied to clipboard',
    },
    
    error: {
      save: 'Failed to save',
      update: 'Failed to update',
      delete: 'Failed to delete',
      upload: 'Failed to upload',
      send: 'Failed to send',
      copy: 'Failed to copy',
    },
    
    info: {
      processing: 'Processing your request...',
      uploading: 'Uploading file...',
      downloading: 'Downloading file...',
      loading: 'Loading data...',
    },
    
    warning: {
      unsavedChanges: 'You have unsaved changes',
      confirmDelete: 'Are you sure you want to delete this?',
      confirmLogout: 'Are you sure you want to sign out?',
    },
  },
  
  footer: {
    copyright: '© {{year}} SYNTHEX. All rights reserved.',
    terms: 'Terms',
    privacy: 'Privacy',
    support: 'Support',
    docs: 'Documentation',
    blog: 'Blog',
    about: 'About',
    contact: 'Contact',
  },
};

export default en;