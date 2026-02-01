import { openRouterService } from './openrouter';
import { prisma } from '@/lib/prisma';

interface GenerateContentParams {
  prompt: string;
  platform: string;
  tone: string;
  context?: any;
  userId: string;
}

interface ContentGenerationResult {
  content: string;
  suggestions?: Array<{
    title: string;
    description: string;
    action: string;
  }>;
  metadata?: {
    wordCount: number;
    characterCount: number;
    estimatedReadTime: number;
  };
}

// Platform-specific character limits
const PLATFORM_LIMITS = {
  twitter: 280,
  linkedin: 3000,
  facebook: 63206,
  instagram: 2200,
  tiktok: 2200,
  youtube: 5000, // Description limit
};

// Generate content with AI
export async function generateContent(params: GenerateContentParams): Promise<ContentGenerationResult> {
  const { prompt, platform, tone, context, userId } = params;

  // Build the AI prompt
  const systemPrompt = `You are a professional social media content creator. Generate engaging ${platform} content with a ${tone} tone.`;
  
  const userPrompt = `
    Create social media content based on this brief: ${prompt}
    
    Platform: ${platform}
    Tone: ${tone}
    ${context?.targetAudience ? `Target Audience: ${context.targetAudience}` : ''}
    ${context?.campaignGoal ? `Campaign Goal: ${context.campaignGoal}` : ''}
    
    Requirements:
    - Make it engaging and platform-appropriate
    - Include relevant hashtags if applicable
    - Stay within character limits (${PLATFORM_LIMITS[platform as keyof typeof PLATFORM_LIMITS] || 'no limit'} chars)
    - Optimize for ${context?.campaignGoal || 'engagement'}
    
    Format the response as JSON with:
    {
      "content": "the generated content",
      "hashtags": ["relevant", "hashtags"],
      "suggestions": [
        {
          "title": "suggestion title",
          "description": "suggestion description",
          "action": "action_key"
        }
      ]
    }
  `;

  try {
    // Get user's API key
    const user = await (prisma as any).user.findUnique({
      where: { id: userId },
      select: { openrouterApiKey: true }
    });

    const apiKey = user?.openrouterApiKey || undefined;
    
    // Generate content using OpenRouter
    const response = await openRouterService.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      {
        model: 'anthropic/claude-3-haiku-20240307', // Fast and cost-effective
        temperature: 0.7,
        max_tokens: 1000,
      },
      apiKey
    );

    // Get the content from the response
    const responseContent = response.choices[0]?.message?.content || '';
    
    // Parse the JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseContent);
    } catch (e) {
      // If not JSON, use the raw response
      parsedResponse = { content: responseContent, hashtags: [], suggestions: [] };
    }

    // Format content with hashtags
    let finalContent = parsedResponse.content;
    if (parsedResponse.hashtags && parsedResponse.hashtags.length > 0) {
      finalContent += '\n\n' + parsedResponse.hashtags.map((tag: string) => `#${tag}`).join(' ');
    }

    // Calculate metadata
    const metadata = {
      wordCount: finalContent.split(/\s+/).length,
      characterCount: finalContent.length,
      estimatedReadTime: Math.ceil(finalContent.split(/\s+/).length / 200), // 200 words per minute
    };

    // Log usage
    await (prisma as any).apiUsage.create({
      data: {
        userId,
        endpoint: '/content/generate',
        model: 'anthropic/claude-3-haiku-20240307',
        requestData: { prompt, platform, tone },
        responseData: { content: finalContent },
        status: 'success'
      }
    });

    return {
      content: finalContent,
      suggestions: parsedResponse.suggestions || getDefaultSuggestions(platform),
      metadata
    };
  } catch (error) {
    console.error('Content generation error:', error);
    throw new Error('Failed to generate content. Please check your API key and try again.');
  }
}

// Get default suggestions based on platform
function getDefaultSuggestions(platform: string) {
  const suggestions = [
    {
      title: 'Add Emojis',
      description: 'Make your content more engaging with relevant emojis',
      action: 'add_emojis'
    },
    {
      title: 'Include Call-to-Action',
      description: 'Add a clear CTA to drive engagement',
      action: 'add_cta'
    }
  ];

  if (platform === 'twitter' || platform === 'instagram') {
    suggestions.push({
      title: 'Add Hashtags',
      description: 'Increase discoverability with trending hashtags',
      action: 'add_hashtags'
    });
  }

  if (platform === 'linkedin') {
    suggestions.push({
      title: 'Professional Tone Check',
      description: 'Ensure your content maintains a professional tone',
      action: 'check_tone'
    });
  }

  return suggestions;
}

// Save draft
export async function saveDraft(params: {
  content: string;
  platform?: string;
  metadata?: any;
  userId: string;
  campaignId?: string;
}) {
  const { content, platform, metadata, userId, campaignId } = params;

  // Save as a project with type 'draft'
  const draft = await (prisma as any).project.create({
    data: {
      userId,
      name: `Draft - ${new Date().toLocaleString()}`,
      type: 'draft',
      data: {
        content,
        platform,
        metadata,
        campaignId
      }
    }
  });

  return draft;
}

// Get drafts
export async function getDrafts(userId: string) {
  const drafts = await (prisma as any).project.findMany({
    where: {
      userId,
      type: 'draft'
    },
    orderBy: {
      updatedAt: 'desc'
    },
    take: 20
  });

  return drafts.map((draft: any) => ({
    id: draft.id,
    ...draft.data as any,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt
  }));
}

// Publish content
export async function publishContent(params: {
  content: string;
  platform: string;
  scheduleTime?: string;
  campaignId?: string;
  userId: string;
}) {
  const { content, platform, scheduleTime, campaignId, userId } = params;

  // If no campaign is provided, create a default one
  let finalCampaignId = campaignId;
  
  if (!finalCampaignId) {
    const defaultCampaign = await (prisma as any).campaign.create({
      data: {
        userId,
        name: 'Quick Posts',
        description: 'Default campaign for quick content publishing',
        platform: platform,
        status: 'active'
      }
    });
    finalCampaignId = defaultCampaign.id;
  }

  // Create a post
  const post = await (prisma as any).post.create({
    data: {
      content,
      platform,
      status: scheduleTime ? 'scheduled' : 'published',
      scheduledAt: scheduleTime ? new Date(scheduleTime) : undefined,
      publishedAt: !scheduleTime ? new Date() : undefined,
      campaignId: finalCampaignId,
      metadata: {
        source: 'content-studio'
      }
    }
  });

  return post;
}