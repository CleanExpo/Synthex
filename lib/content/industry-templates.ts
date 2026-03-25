/**
 * Industry Templates
 *
 * Provides industry-mode content scaffolding for the SYN-408 Voice Onboarding
 * + Industry Modes feature. Exports constants, label/tone lookups, and DB helpers.
 */

import { prisma } from '@/lib/prisma';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const INDUSTRIES = [
  'trades',
  'cafe',
  'salon',
  'gym',
  'clinic',
  'retail',
] as const;

export type Industry = (typeof INDUSTRIES)[number];

export const INDUSTRY_LABELS: Record<Industry, string> = {
  trades: 'Trades (Plumber / Electrician)',
  cafe: 'Café / Restaurant',
  salon: 'Hair & Beauty Salon',
  gym: 'Gym / Fitness Studio',
  clinic: 'Medical / Dental Clinic',
  retail: 'Retail Shop',
};

export const INDUSTRY_TONES: Record<Industry, string> = {
  trades: 'reliable and straightforward',
  cafe: 'warm and inviting',
  salon: 'friendly and stylish',
  gym: 'energetic and motivating',
  clinic: 'professional and reassuring',
  retail: 'upbeat and helpful',
};

// ─────────────────────────────────────────────────────────────────────────────
// Seed data
// ─────────────────────────────────────────────────────────────────────────────

interface TemplateSeed {
  industry: string;
  scenarioName: string;
  promptTemplate: string;
  exampleOutput: string;
}

const SEED_TEMPLATES: TemplateSeed[] = [
  // ── Trades ──────────────────────────────────────────────────────────────────
  {
    industry: 'trades',
    scenarioName: 'After-job reveal',
    promptTemplate:
      'Write an engaging Facebook post for {{businessName}}, a trades business in {{location}}. Tone: {{tone}}. Topic: After-job reveal — show the before/after of a completed job. Include a call to action to book a free quote. Keep it under 150 words.',
    exampleOutput:
      "🔧 Another job done and dusted! Check out this stunning bathroom renovation we just wrapped up in {{location}}. From leaky taps to a full refit — the difference is incredible. Ready to transform your home? Call {{businessName}} today for a FREE quote. We're local, we're reliable, and we get the job done right. 📞 Book now!",
  },
  {
    industry: 'trades',
    scenarioName: 'Emergency call-out availability',
    promptTemplate:
      'Write a short, punchy Facebook post for {{businessName}} in {{location}}. Tone: {{tone}}. Topic: We offer 24/7 emergency trades call-outs. Reassure homeowners that help is always a call away. Include a phone number placeholder and a call to action. Under 100 words.',
    exampleOutput:
      "🚨 Burst pipe at midnight? Sparks flying at 2am? {{businessName}} is ON CALL 24/7 in {{location}} and surrounds. No job too urgent — we're there when you need us most. Call [PHONE] now for fast emergency response. Don't panic — just call!",
  },
  {
    industry: 'trades',
    scenarioName: 'Seasonal maintenance reminder',
    promptTemplate:
      'Write a helpful Facebook post for {{businessName}} in {{location}}. Tone: {{tone}}. Topic: Remind homeowners to book a pre-winter or pre-summer maintenance check. Explain why it matters. Include a call to action. Under 130 words.',
    exampleOutput:
      "❄️ Winter is coming, {{location}}! Is your home ready? {{businessName}} recommends a pre-winter maintenance check to avoid costly emergency call-outs. We'll inspect your plumbing, wiring, and heating systems so you stay warm and worry-free all season. Book your check-up before the rush — spots fill fast! Call us or send a DM to secure your appointment.",
  },
  {
    industry: 'trades',
    scenarioName: 'Glowing customer testimonial',
    promptTemplate:
      'Write a social media post for {{businessName}} in {{location}} sharing a customer testimonial. Tone: {{tone}}. Use a fictional but realistic quote from a happy customer. Include a call to action encouraging others to leave a review or book. Under 120 words.',
    exampleOutput:
      "\"{{businessName}} arrived same day and fixed our hot water system in under an hour. Couldn't be happier!\" — Sarah, {{location}}. ⭐⭐⭐⭐⭐ This is why we do what we do. If you've had a great experience with us, drop a Google review — it means the world! And if you're still waiting on a tradie, give us a call today.",
  },

  // ── Café ─────────────────────────────────────────────────────────────────────
  {
    industry: 'cafe',
    scenarioName: 'Daily special announcement',
    promptTemplate:
      "Write an appetising Facebook or Instagram post for {{businessName}}, a café in {{location}}. Tone: {{tone}}. Topic: Today's food or drink special. Make it mouth-watering and include a call to action to visit today. Use 1-2 relevant emojis. Under 100 words.",
    exampleOutput:
      "☀️ Today's special at {{businessName}}: Ricotta hotcakes with fresh strawberries and lemon curd — absolutely divine! Perfect for a slow {{location}} morning. Only available until sold out, so pop in early. See you soon! 🍓",
  },
  {
    industry: 'cafe',
    scenarioName: 'Behind-the-scenes kitchen story',
    promptTemplate:
      'Write a warm, engaging Instagram caption for {{businessName}} in {{location}}. Tone: {{tone}}. Topic: A behind-the-scenes look at the kitchen — baking, prepping, or the morning routine. Make it personal and human. Under 120 words.',
    exampleOutput:
      "5:30am in the {{businessName}} kitchen 🌅 The sourdough is proving, the espresso machine is warming up, and the team is already creating magic for your morning. Every loaf, every brew, every plate is made with love right here in {{location}}. We can\'t wait to see you walk through that door. What\'s your usual order? 👇",
  },
  {
    industry: 'cafe',
    scenarioName: 'Weekend brunch promotion',
    promptTemplate:
      'Write a fun, inviting Facebook post for {{businessName}} in {{location}}. Tone: {{tone}}. Topic: Weekend brunch promotion — highlight the atmosphere, the menu, and the value. Include a call to action to book a table or just walk in. Under 130 words.',
    exampleOutput:
      "It\'s BRUNCH O\'CLOCK, {{location}}! 🥂 {{businessName}} is serving up your favourite weekend brunch spread — smashed avo, eggs benny, fluffy pancakes, and bottomless filter coffee (yes, really). Grab your crew, find a sunny table, and let us take care of the rest. No booking needed for groups under 6. See you Saturday and Sunday from 8am!",
  },
  {
    industry: 'cafe',
    scenarioName: 'Loyalty programme introduction',
    promptTemplate:
      "Write an upbeat Instagram post for {{businessName}} in {{location}}. Tone: {{tone}}. Topic: Introduce the café's loyalty card or app programme. Explain the benefit simply and end with a clear call to action. Under 110 words.",
    exampleOutput:
      "☕ Did you know? Every 10 coffees at {{businessName}} earns you a FREE one! 🎉 Ask our friendly team for a loyalty card next time you\'re in, or download the app to track your rewards digitally. Because your daily coffee habit should pay you back. Start earning today — {{location}}\'s best café is waiting for you!",
  },

  // ── Salon ────────────────────────────────────────────────────────────────────
  {
    industry: 'salon',
    scenarioName: 'Transformation reveal',
    promptTemplate:
      'Write a glamorous Instagram caption for {{businessName}}, a hair and beauty salon in {{location}}. Tone: {{tone}}. Topic: A client transformation reveal — highlight the skill of the stylist and the confidence boost for the client. Include a booking call to action. Under 120 words.',
    exampleOutput:
      "✨ From drab to fab! Our incredible team at {{businessName}} worked their magic today — a full colour refresh and a gorgeous blowout for our amazing client. She literally couldn't stop smiling walking out the door. Ready for YOUR transformation? Book your appointment in {{location}} via the link in bio. Spots filling fast! 💇‍♀️",
  },
  {
    industry: 'salon',
    scenarioName: 'Seasonal treatment promotion',
    promptTemplate:
      'Write a stylish Facebook post for {{businessName}} in {{location}}. Tone: {{tone}}. Topic: Promote a seasonal treatment (e.g. summer hair hydration, winter scalp treatment, spring colour refresh). Include pricing or a special offer and a booking call to action. Under 130 words.',
    exampleOutput:
      "🌸 Spring is here and your hair deserves a fresh start! {{businessName}} is offering a Spring Refresh Package — cut, colour, and deep conditioning treatment — for just $[PRICE] this month only. Limited spots available in {{location}}, so don't miss out. Call us or book online to lock in your appointment. You deserve it! 🌟",
  },
  {
    industry: 'salon',
    scenarioName: 'Product spotlight',
    promptTemplate:
      'Write an informative and engaging Instagram post for {{businessName}} in {{location}}. Tone: {{tone}}. Topic: Spotlight a product the salon sells or recommends — explain its benefits and how to use it. Include a call to action to purchase in-salon or ask about it. Under 120 words.',
    exampleOutput:
      "Obsessed with this! 💕 {{businessName}} is now stocking [BRAND NAME] Hydrating Argan Mask — and honestly, it's a game-changer for dry, damaged hair. Apply weekly for 10 minutes and watch the transformation. Available in-salon at {{location}} or ask our team during your next visit for a personalised recommendation. Your best hair starts here! ✨",
  },
  {
    industry: 'salon',
    scenarioName: 'New staff introduction',
    promptTemplate:
      "Write a warm, welcoming Facebook post for {{businessName}} in {{location}}. Tone: {{tone}}. Topic: Introduce a new team member to the salon's client community. Share their specialty and personality. Encourage clients to book with them. Under 120 words.",
    exampleOutput:
      "👋 Say hello to the newest member of the {{businessName}} family! [NAME] has just joined our {{location}} team, bringing [X] years of experience in balayage, creative cuts, and extensions. She's already booking fast — reach out to secure your appointment with her and experience her incredible work firsthand. Welcome to the family, [NAME]! 🎉",
  },

  // ── Gym ──────────────────────────────────────────────────────────────────────
  {
    industry: 'gym',
    scenarioName: 'Member transformation story',
    promptTemplate:
      "Write an inspiring Instagram post for {{businessName}}, a gym or fitness studio in {{location}}. Tone: {{tone}}. Topic: A member's fitness transformation — celebrate their progress and hard work. Include a motivational message and a call to action for new members to start their journey. Under 130 words.",
    exampleOutput:
      "💪 Six months ago [MEMBER NAME] walked into {{businessName}} for the first time. Today? An absolute UNIT. The dedication, the early mornings, the consistency — it all adds up. We are SO proud of this legend. If you're ready to start YOUR transformation in {{location}}, DM us or drop into the gym for a free trial session. Your future self will thank you. 🔥",
  },
  {
    industry: 'gym',
    scenarioName: 'New class launch',
    promptTemplate:
      "Write an energetic Facebook post for {{businessName}} in {{location}}. Tone: {{tone}}. Topic: Announce a brand new class or training programme launching soon. Build excitement and explain what's different about it. Include how to sign up. Under 120 words.",
    exampleOutput:
      '🚨 NEW CLASS ALERT! {{businessName}} is launching HIIT FURY — our most intense 45-minute class yet. Expect full-body circuits, heart-pumping music, and zero excuses. Kicking off [DATE] in {{location}} — spots are LIMITED so register now via the app or at reception. First class is FREE for new members. Are you ready? 💥',
  },
  {
    industry: 'gym',
    scenarioName: 'Challenge or competition promo',
    promptTemplate:
      'Write a competitive, fun Instagram post for {{businessName}} in {{location}}. Tone: {{tone}}. Topic: A gym challenge or leaderboard competition starting soon. Build excitement and explain the prize or recognition. Include a sign-up call to action. Under 120 words.',
    exampleOutput:
      "🏆 THE {{businessName}} 30-DAY CHALLENGE IS BACK! Who has what it takes? Track your workouts, crush your PBs, and climb the leaderboard. Top 3 members win [PRIZE/RECOGNITION]. Starting [DATE] — register at reception or via the app. {{location}}'s fittest community is waiting. Tag a mate you're challenging! 👇🔥",
  },
  {
    industry: 'gym',
    scenarioName: 'Nutrition tip of the week',
    promptTemplate:
      'Write a helpful, educational Instagram caption for {{businessName}} in {{location}}. Tone: {{tone}}. Topic: A simple, actionable nutrition tip that complements a fitness routine. Make it practical and not too technical. End with a question to boost comments. Under 110 words.',
    exampleOutput:
      "🥗 Nutrition tip of the week from the {{businessName}} team: Stop skipping post-workout protein! Aim for 20–30g within 30 minutes of finishing your session to support muscle recovery and growth. A shake, some Greek yoghurt, or eggs all do the trick. Simple swaps, big results. What's your go-to post-workout meal? Drop it below 👇",
  },

  // ── Clinic ───────────────────────────────────────────────────────────────────
  {
    industry: 'clinic',
    scenarioName: 'Preventive health reminder',
    promptTemplate:
      'Write a professional, caring Facebook post for {{businessName}}, a medical or dental clinic in {{location}}. Tone: {{tone}}. Topic: Remind patients about the importance of regular check-ups or preventive screenings. Keep it informative and reassuring. Include a booking call to action. Under 130 words.',
    exampleOutput:
      'When did you last have a check-up? 🩺 At {{businessName}} in {{location}}, we believe prevention is always better than cure. Regular health checks can detect early warning signs before they become serious issues — saving you time, money, and worry in the long run. Our friendly team is here to make every visit comfortable and stress-free. Book your appointment online or call us today. Your health is our priority.',
  },
  {
    industry: 'clinic',
    scenarioName: 'New service announcement',
    promptTemplate:
      'Write a clear, informative Facebook post for {{businessName}} in {{location}}. Tone: {{tone}}. Topic: Announce a new service or treatment now available at the clinic. Explain what it is, who it helps, and how to book. Under 130 words.',
    exampleOutput:
      "Exciting news from {{businessName}}! 🎉 We're thrilled to announce that [NEW SERVICE] is now available at our {{location}} clinic. [Brief description of the service and who it benefits.] Whether you're looking to [outcome], our experienced team is ready to help. To find out if this service is right for you, call our reception or book a consultation online. We'd love to help.",
  },
  {
    industry: 'clinic',
    scenarioName: 'Seasonal health tip',
    promptTemplate:
      'Write an educational, accessible Facebook post for {{businessName}} in {{location}}. Tone: {{tone}}. Topic: A seasonal health tip relevant to the current time of year (e.g. flu prevention in winter, sun protection in summer, allergy management in spring). Keep it practical. Under 120 words.',
    exampleOutput:
      "🌞 Summer health tip from {{businessName}}: Slip, slop, slap! With {{location}}'s UV index regularly hitting EXTREME in summer, daily SPF 50+ sunscreen is non-negotiable — even on cloudy days. Reapply every two hours outdoors. And don't forget to book a skin check if you've noticed any new or changing spots. Early detection saves lives. Call us to make an appointment.",
  },
  {
    industry: 'clinic',
    scenarioName: 'Patient milestone celebration',
    promptTemplate:
      'Write a warm, celebratory Facebook post for {{businessName}} in {{location}}. Tone: {{tone}}. Topic: The clinic is celebrating a milestone — years in practice, number of patients, a team achievement. Make it human and community-focused. Include a thank-you to patients. Under 120 words.',
    exampleOutput:
      "🎂 We're celebrating [X] years of caring for the {{location}} community! Since opening our doors, {{businessName}} has had the privilege of supporting thousands of patients through every stage of life. None of this would be possible without your trust. From all of us on the team — thank you. To celebrate, we're offering [SPECIAL OFFER] this month. Book online or call reception to redeem.",
  },

  // ── Retail ───────────────────────────────────────────────────────────────────
  {
    industry: 'retail',
    scenarioName: 'New product arrival',
    promptTemplate:
      'Write an exciting Instagram post for {{businessName}}, a retail shop in {{location}}. Tone: {{tone}}. Topic: A new product or range has just arrived in store. Build excitement and describe the product briefly. Include a call to action to visit in-store or shop online. Under 110 words.',
    exampleOutput:
      "🛍️ JUST LANDED! The [PRODUCT NAME] range has arrived at {{businessName}} in {{location}} — and we are OBSESSED. [Brief description: colour options, features, why it's special.] Head in-store to see it in person, or grab yours online before they sell out. Tag a friend who needs this in their life! 👇",
  },
  {
    industry: 'retail',
    scenarioName: 'Flash sale or weekend promo',
    promptTemplate:
      'Write an urgent, exciting Facebook post for {{businessName}} in {{location}}. Tone: {{tone}}. Topic: A flash sale or weekend promotion with a clear discount or offer. Create urgency with a time limit. Include the offer details and a call to action. Under 110 words.',
    exampleOutput:
      "⚡ FLASH SALE — THIS WEEKEND ONLY! {{businessName}} in {{location}} is offering [X]% off [CATEGORY/PRODUCTS] — Saturday and Sunday only. No code needed, just come in or shop online. Perfect time to grab that thing you've been eyeing! Offer ends Sunday at close of business. Don't miss out. 🛒",
  },
  {
    industry: 'retail',
    scenarioName: 'Gift guide or seasonal buying advice',
    promptTemplate:
      "Write a helpful, friendly Facebook post for {{businessName}} in {{location}}. Tone: {{tone}}. Topic: A gift guide or seasonal buying advice to help customers choose products for an upcoming occasion (e.g. Christmas, Mother's Day, birthday gifts). Highlight 2-3 product ideas. Under 130 words.",
    exampleOutput:
      "🎁 Not sure what to get Mum this year? {{businessName}} has you covered with our Mother's Day gift guide! Here are our top picks: 1️⃣ [PRODUCT A] — perfect for the mum who loves [X]. 2️⃣ [PRODUCT B] — a luxe treat she'd never buy herself. 3️⃣ [PRODUCT C] — practical and beautiful. Shop in-store at {{location}} or online with free delivery over $[AMOUNT]. Mother's Day is [DATE] — don't leave it too late!",
  },
  {
    industry: 'retail',
    scenarioName: 'Community shoutout or local partnership',
    promptTemplate:
      'Write a warm, community-focused Instagram post for {{businessName}} in {{location}}. Tone: {{tone}}. Topic: A shoutout to a local partner, supplier, or community initiative the shop supports. Make it feel authentic and genuine. Include a call to action to support local. Under 120 words.',
    exampleOutput:
      "❤️ We're proud to partner with [LOCAL BUSINESS/INITIATIVE] right here in {{location}}! {{businessName}} is committed to supporting local wherever possible — from our suppliers to the causes we back. When you shop with us, you're helping keep our community thriving. Pop in and check out the [PRODUCT/DISPLAY] celebrating this partnership. Shop local, live local. 🌿",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// DB helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all templates for a given industry from the database.
 */
export async function getTemplatesForIndustry(industry: string) {
  return prisma.industryTemplate.findMany({ where: { industry } });
}

/**
 * Seed the industry_templates table if it is empty.
 * Returns the number of rows inserted.
 */
export async function seedIndustryTemplates(): Promise<number> {
  const existing = await prisma.industryTemplate.count();
  if (existing > 0) {
    return 0;
  }

  const result = await prisma.industryTemplate.createMany({
    data: SEED_TEMPLATES.map(t => ({
      industry: t.industry,
      scenarioName: t.scenarioName,
      promptTemplate: t.promptTemplate,
      exampleOutput: t.exampleOutput,
    })),
    skipDuplicates: true,
  });

  return result.count;
}
