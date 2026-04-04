-- Strategic Marketing Psychology Tables

-- Psychology Principles Knowledge Base
CREATE TABLE psychology_principles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  category VARCHAR(100) NOT NULL,
  description TEXT,
  branding_application JSONB DEFAULT '{}',
  trigger_words TEXT[] DEFAULT '{}',
  audience_relevance JSONB DEFAULT '{}',
  effectiveness_score DECIMAL(3,2) DEFAULT 0.00,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Brand Generation Results
CREATE TABLE brand_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  business_type VARCHAR(255) NOT NULL,
  target_audience JSONB NOT NULL,
  brand_goals TEXT[] DEFAULT '{}',
  tone_preference VARCHAR(100),
  psychology_strategy JSONB NOT NULL,
  brand_names JSONB NOT NULL,
  taglines JSONB NOT NULL,
  metadata_packages JSONB DEFAULT '{}',
  implementation_guide JSONB DEFAULT '{}',
  effectiveness_score DECIMAL(3,2) DEFAULT 0.00,
  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- A/B Testing Metrics
CREATE TABLE psychology_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID REFERENCES brand_generations(id) ON DELETE CASCADE,
  principle_used VARCHAR(255) NOT NULL,
  variant_type VARCHAR(50) NOT NULL, -- 'name', 'tagline', 'metadata'
  variant_content TEXT NOT NULL,
  engagement_score DECIMAL(3,2) DEFAULT 0.00,
  conversion_rate DECIMAL(5,2) DEFAULT 0.00,
  recall_score DECIMAL(3,2) DEFAULT 0.00,
  click_through_rate DECIMAL(5,2) DEFAULT 0.00,
  client_satisfaction INTEGER CHECK (client_satisfaction >= 1 AND client_satisfaction <= 5),
  test_duration_hours INTEGER DEFAULT 24,
  sample_size INTEGER DEFAULT 0,
  tested_at TIMESTAMP DEFAULT NOW()
);

-- User Preferences for Psychology
CREATE TABLE user_psychology_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  preferred_principles TEXT[] DEFAULT '{}',
  avoided_principles TEXT[] DEFAULT '{}',
  industry_focus VARCHAR(255),
  target_demographic JSONB DEFAULT '{}',
  success_metrics JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Competitive Analysis Results
CREATE TABLE competitive_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID REFERENCES brand_generations(id) ON DELETE CASCADE,
  competitor_name VARCHAR(255) NOT NULL,
  competitor_tagline TEXT,
  identified_principles TEXT[] DEFAULT '{}',
  differentiation_strategy TEXT,
  market_position VARCHAR(100),
  analyzed_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_psychology_principles_category ON psychology_principles(category);
CREATE INDEX idx_psychology_principles_effectiveness ON psychology_principles(effectiveness_score DESC);
CREATE INDEX idx_brand_generations_user ON brand_generations(user_id);
CREATE INDEX idx_brand_generations_status ON brand_generations(status);
CREATE INDEX idx_psychology_metrics_generation ON psychology_metrics(generation_id);
CREATE INDEX idx_psychology_metrics_principle ON psychology_metrics(principle_used);
CREATE INDEX idx_user_psychology_preferences_user ON user_psychology_preferences(user_id);

-- Insert initial psychology principles data
INSERT INTO psychology_principles (name, category, description, branding_application, trigger_words, audience_relevance, effectiveness_score) VALUES
-- Cognitive Biases
('Anchoring Bias', 'Cognitive Biases', 'First information influences all subsequent judgments', 
'{"naming": "Use premium-sounding prefixes", "tagline": "Start with highest benefit", "metadata": "Lead with strongest value proposition"}',
ARRAY['Premium', 'Elite', 'First', 'Original', 'Leading'],
'{"B2B": 9, "Luxury": 10, "Budget": 3, "Youth": 6}', 0.85),

('Confirmation Bias', 'Cognitive Biases', 'People seek information confirming existing beliefs',
'{"naming": "Align with audience preconceptions", "tagline": "Reinforce existing values", "metadata": "Use familiar terminology"}',
ARRAY['Proven', 'Trusted', 'Traditional', 'Authentic', 'Verified'],
'{"B2B": 7, "Luxury": 6, "Budget": 8, "Youth": 5}', 0.75),

('Availability Heuristic', 'Cognitive Biases', 'Recent or memorable events seem more likely',
'{"naming": "Reference current trends", "tagline": "Connect to recent events", "metadata": "Use trending keywords"}',
ARRAY['Latest', 'Trending', 'Now', 'Current', 'Today'],
'{"B2B": 6, "Luxury": 5, "Budget": 7, "Youth": 9}', 0.70),

-- Social Psychology
('Social Proof', 'Social Psychology', 'People follow the actions of others',
'{"naming": "Imply community or popularity", "tagline": "Reference user success", "metadata": "Include testimonial keywords"}',
ARRAY['Community', 'Popular', 'Trending', 'Choice', 'Preferred'],
'{"B2B": 8, "Luxury": 7, "Budget": 9, "Youth": 10}', 0.90),

('Authority Principle', 'Social Psychology', 'People defer to experts and authority figures',
'{"naming": "Use professional terminology", "tagline": "Establish expertise", "metadata": "Include credentials and awards"}',
ARRAY['Expert', 'Professional', 'Certified', 'Official', 'Master'],
'{"B2B": 10, "Luxury": 9, "Budget": 6, "Youth": 4}', 0.88),

('Reciprocity Principle', 'Social Psychology', 'People feel obligated to return favors',
'{"naming": "Suggest giving or sharing", "tagline": "Offer value first", "metadata": "Lead with free value"}',
ARRAY['Free', 'Gift', 'Bonus', 'Complimentary', 'Inclusive'],
'{"B2B": 7, "Luxury": 6, "Budget": 10, "Youth": 8}', 0.82),

-- Behavioral Economics
('Loss Aversion', 'Behavioral Economics', 'People fear losses more than they value gains',
'{"naming": "Imply protection or security", "tagline": "Frame as avoiding loss", "metadata": "Emphasize what they might miss"}',
ARRAY['Secure', 'Protect', 'Save', 'Preserve', 'Guard'],
'{"B2B": 9, "Luxury": 5, "Budget": 10, "Youth": 6}', 0.87),

('Scarcity Principle', 'Behavioral Economics', 'Limited availability increases desirability',
'{"naming": "Suggest exclusivity", "tagline": "Emphasize limited access", "metadata": "Use urgency indicators"}',
ARRAY['Exclusive', 'Limited', 'Rare', 'Select', 'Private'],
'{"B2B": 7, "Luxury": 10, "Budget": 8, "Youth": 9}', 0.92),

('Decoy Effect', 'Behavioral Economics', 'Third option makes one of two options more attractive',
'{"naming": "Position as premium option", "tagline": "Compare favorably", "metadata": "Show relative value"}',
ARRAY['Premium', 'Plus', 'Pro', 'Advanced', 'Ultimate'],
'{"B2B": 8, "Luxury": 9, "Budget": 7, "Youth": 6}', 0.78),

-- Memory & Learning
('Mere Exposure Effect', 'Memory Learning', 'Familiarity breeds preference',
'{"naming": "Use familiar patterns", "tagline": "Repeat key messages", "metadata": "Consistent terminology"}',
ARRAY['Familiar', 'Classic', 'Known', 'Recognized', 'Established'],
'{"B2B": 6, "Luxury": 7, "Budget": 9, "Youth": 8}', 0.73),

('Primacy Effect', 'Memory Learning', 'First items in a list are better remembered',
'{"naming": "Alphabetically advantageous", "tagline": "Lead with key benefit", "metadata": "Front-load important info"}',
ARRAY['First', 'Primary', 'Leading', 'Initial', 'Alpha'],
'{"B2B": 7, "Luxury": 6, "Budget": 7, "Youth": 6}', 0.71),

-- Perception & Reality
('Halo Effect', 'Perception Reality', 'One positive trait influences overall perception',
'{"naming": "Associate with positive qualities", "tagline": "Highlight best feature", "metadata": "Lead with strongest attribute"}',
ARRAY['Excellence', 'Quality', 'Superior', 'Best', 'Outstanding'],
'{"B2B": 8, "Luxury": 10, "Budget": 6, "Youth": 7}', 0.84),

('Contrast Principle', 'Perception Reality', 'Perception affected by comparisons',
'{"naming": "Position against competitors", "tagline": "Show clear differentiation", "metadata": "Comparative language"}',
ARRAY['Better', 'More', 'Unlike', 'Beyond', 'Superior'],
'{"B2B": 9, "Luxury": 8, "Budget": 8, "Youth": 7}', 0.80);

-- Add more principles as needed...