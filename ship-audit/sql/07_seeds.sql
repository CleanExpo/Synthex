-- =================================================================
-- 07_seeds.sql - Seed Data and Test Fixtures
-- Generated: 2025-08-13
-- Purpose: Provide test data for development and E2E testing
-- =================================================================

BEGIN;

-- =================================================================
-- PART 1: Test Organizations
-- =================================================================

INSERT INTO organizations (id, name, slug, description, plan, "billingStatus", "createdAt", "updatedAt")
VALUES 
    ('org-demo-001', 'Demo Organization', 'demo-org', 'Demo organization for testing', 'free', 'active', NOW(), NOW()),
    ('org-test-001', 'Test Enterprise', 'test-enterprise', 'Enterprise testing account', 'enterprise', 'active', NOW(), NOW()),
    ('org-test-002', 'Startup Inc', 'startup-inc', 'Startup testing account', 'starter', 'active', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- =================================================================
-- PART 2: Test Users
-- =================================================================

-- Password: 'demo123' (bcrypt hash)
INSERT INTO users (
    id, email, password, name, "authProvider", "emailVerified", 
    "organizationId", preferences, "createdAt", "updatedAt"
)
VALUES 
    (
        'user-demo-001',
        'demo@synthex.social',
        '$2a$10$K7L1OJ0TfPIoGPEqgBXmzuH8gZmT3sT8MvF3Ht9iYpTKMmRjO8zKy',
        'Demo User',
        'local',
        true,
        'org-demo-001',
        '{"theme": "light", "notifications": true, "role": "user"}'::jsonb,
        NOW(),
        NOW()
    ),
    (
        'user-admin-001',
        'admin@synthex.social',
        '$2a$10$K7L1OJ0TfPIoGPEqgBXmzuH8gZmT3sT8MvF3Ht9iYpTKMmRjO8zKy',
        'Admin User',
        'local',
        true,
        'org-demo-001',
        '{"theme": "dark", "notifications": true, "role": "admin", "orgRole": "admin"}'::jsonb,
        NOW(),
        NOW()
    ),
    (
        'user-test-001',
        'test@synthex.social',
        '$2a$10$K7L1OJ0TfPIoGPEqgBXmzuH8gZmT3sT8MvF3Ht9iYpTKMmRjO8zKy',
        'Test User',
        'local',
        true,
        'org-test-001',
        '{"theme": "light", "notifications": false, "role": "user"}'::jsonb,
        NOW(),
        NOW()
    )
ON CONFLICT (id) DO NOTHING;

-- =================================================================
-- PART 3: Psychology Principles Seed Data
-- =================================================================

INSERT INTO psychology_principles (
    id, name, category, description, "brandingApplication", 
    "triggerWords", "audienceRelevance", "effectivenessScore", "usageCount"
)
VALUES 
    (
        gen_random_uuid(),
        'Social Proof',
        'Cognitive Biases',
        'People tend to follow the behavior of others',
        '{"examples": ["9 out of 10 customers recommend", "Join 1M+ users"], "usage": "testimonials"}'::jsonb,
        ARRAY['popular', 'trending', 'bestseller', 'recommended', 'trusted'],
        '{"demographics": ["all"], "industries": ["e-commerce", "saas"]}'::jsonb,
        0.85,
        150
    ),
    (
        gen_random_uuid(),
        'Scarcity Principle',
        'Urgency Drivers',
        'Limited availability increases desirability',
        '{"examples": ["Only 3 left in stock", "Limited time offer"], "usage": "promotions"}'::jsonb,
        ARRAY['limited', 'exclusive', 'rare', 'last chance', 'ending soon'],
        '{"demographics": ["millennials", "gen-z"], "industries": ["retail", "events"]}'::jsonb,
        0.78,
        120
    ),
    (
        gen_random_uuid(),
        'Reciprocity',
        'Social Psychology',
        'People feel obligated to return favors',
        '{"examples": ["Free trial", "Free ebook download"], "usage": "lead-generation"}'::jsonb,
        ARRAY['free', 'gift', 'bonus', 'complimentary', 'no charge'],
        '{"demographics": ["professionals"], "industries": ["b2b", "education"]}'::jsonb,
        0.72,
        95
    ),
    (
        gen_random_uuid(),
        'Authority Bias',
        'Cognitive Biases',
        'People trust expert opinions and credentials',
        '{"examples": ["Recommended by doctors", "Industry leader"], "usage": "credibility"}'::jsonb,
        ARRAY['expert', 'certified', 'approved', 'endorsed', 'award-winning'],
        '{"demographics": ["older adults"], "industries": ["healthcare", "finance"]}'::jsonb,
        0.80,
        110
    ),
    (
        gen_random_uuid(),
        'Loss Aversion',
        'Behavioral Economics',
        'Fear of missing out is stronger than desire to gain',
        '{"examples": ["Don''t miss out", "Your cart expires in 10 minutes"], "usage": "conversion"}'::jsonb,
        ARRAY['miss out', 'lose', 'expire', 'ending', 'last opportunity'],
        '{"demographics": ["all"], "industries": ["all"]}'::jsonb,
        0.82,
        140
    )
ON CONFLICT (name) DO NOTHING;

-- =================================================================
-- PART 4: Test Campaigns
-- =================================================================

INSERT INTO campaigns (
    id, name, description, platform, status, "userId", 
    content, settings, "createdAt", "updatedAt"
)
VALUES 
    (
        'campaign-demo-001',
        'Summer Sale Campaign',
        'Promotional campaign for summer products',
        'instagram',
        'active',
        'user-demo-001',
        '{"theme": "summer", "hashtags": ["#summersale", "#deals"], "tone": "exciting"}'::jsonb,
        '{"autoSchedule": true, "timezone": "America/New_York"}'::jsonb,
        NOW() - INTERVAL '7 days',
        NOW()
    ),
    (
        'campaign-demo-002',
        'Product Launch',
        'New product announcement campaign',
        'twitter',
        'draft',
        'user-demo-001',
        '{"theme": "innovation", "hashtags": ["#newproduct", "#innovation"], "tone": "professional"}'::jsonb,
        '{"autoSchedule": false, "requireApproval": true}'::jsonb,
        NOW() - INTERVAL '3 days',
        NOW()
    ),
    (
        'campaign-test-001',
        'Content Marketing',
        'Educational content series',
        'linkedin',
        'active',
        'user-test-001',
        '{"theme": "education", "hashtags": ["#learning", "#tips"], "tone": "informative"}'::jsonb,
        '{"autoSchedule": true, "postFrequency": "daily"}'::jsonb,
        NOW() - INTERVAL '14 days',
        NOW()
    )
ON CONFLICT (id) DO NOTHING;

-- =================================================================
-- PART 5: Test Posts
-- =================================================================

INSERT INTO posts (
    id, content, platform, status, "campaignId",
    "scheduledAt", "publishedAt", metadata, "createdAt", "updatedAt"
)
VALUES 
    (
        'post-demo-001',
        '🌞 Summer Sale is HERE! Get 30% off all items this week only! #summersale #deals',
        'instagram',
        'published',
        'campaign-demo-001',
        NOW() - INTERVAL '2 days',
        NOW() - INTERVAL '2 days' + INTERVAL '5 minutes',
        '{"images": ["summer-sale.jpg"], "location": "New York"}'::jsonb,
        NOW() - INTERVAL '3 days',
        NOW() - INTERVAL '2 days'
    ),
    (
        'post-demo-002',
        'Don''t miss out on our biggest sale of the season! Limited stock available 🛍️',
        'instagram',
        'scheduled',
        'campaign-demo-001',
        NOW() + INTERVAL '1 day',
        NULL,
        '{"images": ["sale-banner.jpg"], "callToAction": "Shop Now"}'::jsonb,
        NOW() - INTERVAL '1 day',
        NOW()
    ),
    (
        'post-demo-003',
        'Excited to announce our latest innovation! Stay tuned for the big reveal 🚀',
        'twitter',
        'draft',
        'campaign-demo-002',
        NULL,
        NULL,
        '{"thread": true, "media": ["teaser.mp4"]}'::jsonb,
        NOW() - INTERVAL '2 days',
        NOW()
    ),
    (
        'post-test-001',
        '5 Tips for Effective Remote Work:\n1. Set boundaries\n2. Create a routine\n3. Take breaks\n4. Stay connected\n5. Prioritize wellness',
        'linkedin',
        'published',
        'campaign-test-001',
        NOW() - INTERVAL '5 days',
        NOW() - INTERVAL '5 days' + INTERVAL '10 minutes',
        '{"article": true, "readTime": "3 min"}'::jsonb,
        NOW() - INTERVAL '6 days',
        NOW() - INTERVAL '5 days'
    )
ON CONFLICT (id) DO NOTHING;

-- =================================================================
-- PART 6: Test Platform Connections
-- =================================================================

INSERT INTO platform_connections (
    id, "userId", platform, "accessToken", "refreshToken",
    "profileId", "profileName", "isActive", "lastSync", metadata
)
VALUES 
    (
        'conn-demo-001',
        'user-demo-001',
        'instagram',
        'demo_access_token_instagram',
        'demo_refresh_token_instagram',
        'demo_instagram_id',
        '@demo_brand',
        true,
        NOW() - INTERVAL '1 hour',
        '{"followers": 10000, "verified": false}'::jsonb
    ),
    (
        'conn-demo-002',
        'user-demo-001',
        'twitter',
        'demo_access_token_twitter',
        'demo_refresh_token_twitter',
        'demo_twitter_id',
        '@demo_brand',
        true,
        NOW() - INTERVAL '2 hours',
        '{"followers": 5000, "verified": false}'::jsonb
    ),
    (
        'conn-test-001',
        'user-test-001',
        'linkedin',
        'test_access_token_linkedin',
        'test_refresh_token_linkedin',
        'test_linkedin_id',
        'Test Company',
        true,
        NOW() - INTERVAL '30 minutes',
        '{"followers": 2500, "companyPage": true}'::jsonb
    )
ON CONFLICT (id) DO NOTHING;

-- =================================================================
-- PART 7: Test Notifications
-- =================================================================

INSERT INTO notifications (
    id, type, title, message, read, "userId", data, "createdAt"
)
VALUES 
    (
        'notif-demo-001',
        'success',
        'Post Published',
        'Your Instagram post was successfully published',
        false,
        'user-demo-001',
        '{"postId": "post-demo-001", "platform": "instagram"}'::jsonb,
        NOW() - INTERVAL '2 days'
    ),
    (
        'notif-demo-002',
        'info',
        'Campaign Update',
        'Your Summer Sale Campaign is performing well',
        false,
        'user-demo-001',
        '{"campaignId": "campaign-demo-001", "metrics": {"reach": 5000}}'::jsonb,
        NOW() - INTERVAL '1 day'
    ),
    (
        'notif-test-001',
        'warning',
        'API Limit Warning',
        'You have used 80% of your monthly API quota',
        true,
        'user-test-001',
        '{"usage": 80, "limit": 100}'::jsonb,
        NOW() - INTERVAL '3 days'
    )
ON CONFLICT (id) DO NOTHING;

-- =================================================================
-- PART 8: Test API Usage
-- =================================================================

INSERT INTO api_usage (
    id, endpoint, model, tokens, cost, status, "userId",
    "requestData", "responseData", "createdAt"
)
VALUES 
    (
        'api-demo-001',
        '/api/ai/generate',
        'gpt-4',
        1500,
        0.045,
        'success',
        'user-demo-001',
        '{"prompt": "Generate Instagram caption", "temperature": 0.7}'::jsonb,
        '{"caption": "Summer vibes and good times!", "hashtags": ["#summer"]}'::jsonb,
        NOW() - INTERVAL '2 days'
    ),
    (
        'api-demo-002',
        '/api/ai/analyze',
        'gpt-3.5-turbo',
        500,
        0.001,
        'success',
        'user-demo-001',
        '{"text": "Analyze sentiment", "language": "en"}'::jsonb,
        '{"sentiment": "positive", "score": 0.85}'::jsonb,
        NOW() - INTERVAL '1 day'
    ),
    (
        'api-test-001',
        '/api/ai/generate',
        'gpt-4',
        2000,
        0.06,
        'error',
        'user-test-001',
        '{"prompt": "Generate content", "maxTokens": 2000}'::jsonb,
        NULL,
        NOW() - INTERVAL '4 hours'
    )
ON CONFLICT (id) DO NOTHING;

-- =================================================================
-- PART 9: Test Brand Generations
-- =================================================================

INSERT INTO brand_generations (
    id, "userId", "businessType", "targetAudience", "brandGoals",
    "tonePreference", "psychologyStrategy", "brandNames", taglines,
    status, "effectivenessScore", "createdAt", "updatedAt"
)
VALUES 
    (
        gen_random_uuid(),
        'user-demo-001',
        'E-commerce',
        '{"age": "25-45", "interests": ["fashion", "lifestyle"], "income": "middle"}'::jsonb,
        ARRAY['increase brand awareness', 'drive sales', 'build community'],
        'friendly',
        '{"primary": "Social Proof", "secondary": ["Scarcity", "Authority"]}'::jsonb,
        '{"options": ["TrendSetters", "StyleHub", "FashionForward"]}'::jsonb,
        '{"options": ["Where Style Meets You", "Fashion for Every Story", "Your Style, Delivered"]}'::jsonb,
        'completed',
        0.75,
        NOW() - INTERVAL '5 days',
        NOW() - INTERVAL '5 days'
    ),
    (
        gen_random_uuid(),
        'user-test-001',
        'B2B SaaS',
        '{"role": "decision makers", "company_size": "50-500", "industry": "tech"}'::jsonb,
        ARRAY['generate leads', 'establish authority', 'reduce churn'],
        'professional',
        '{"primary": "Authority Bias", "secondary": ["Reciprocity", "Social Proof"]}'::jsonb,
        '{"options": ["TechFlow", "StreamlineIO", "ProcessPro"]}'::jsonb,
        '{"options": ["Automate Your Success", "Work Smarter, Not Harder", "Enterprise Solutions Made Simple"]}'::jsonb,
        'completed',
        0.82,
        NOW() - INTERVAL '10 days',
        NOW() - INTERVAL '10 days'
    )
ON CONFLICT DO NOTHING;

-- =================================================================
-- PART 10: Test Audit Logs
-- =================================================================

INSERT INTO audit_logs (
    id, action, resource, "resourceId", severity, category,
    outcome, "userId", "ipAddress", "userAgent", details, "createdAt"
)
VALUES 
    (
        'audit-demo-001',
        'user_login',
        'authentication',
        'user-demo-001',
        'low',
        'auth',
        'success',
        'user-demo-001',
        '192.168.1.100',
        'Mozilla/5.0 Chrome/120.0',
        '{"method": "password", "location": "New York"}'::jsonb,
        NOW() - INTERVAL '3 days'
    ),
    (
        'audit-demo-002',
        'campaign_create',
        'campaign',
        'campaign-demo-001',
        'medium',
        'data',
        'success',
        'user-demo-001',
        '192.168.1.100',
        'Mozilla/5.0 Chrome/120.0',
        '{"name": "Summer Sale Campaign", "platform": "instagram"}'::jsonb,
        NOW() - INTERVAL '7 days'
    ),
    (
        'audit-test-001',
        'api_key_regenerate',
        'security',
        'user-test-001',
        'high',
        'security',
        'success',
        'user-test-001',
        '10.0.0.50',
        'Mozilla/5.0 Firefox/120.0',
        '{"reason": "routine rotation", "old_key_revoked": true}'::jsonb,
        NOW() - INTERVAL '1 day'
    )
ON CONFLICT (id) DO NOTHING;

-- =================================================================
-- PART 11: Development Helper Functions
-- =================================================================

-- Function to create a test user with campaign and posts
CREATE OR REPLACE FUNCTION create_test_user(
    p_email TEXT,
    p_name TEXT DEFAULT 'Test User',
    p_org_id TEXT DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
    v_user_id TEXT;
    v_campaign_id TEXT;
BEGIN
    -- Create user
    INSERT INTO users (id, email, password, name, "emailVerified", "organizationId")
    VALUES (
        'user-' || gen_random_uuid()::text,
        p_email,
        '$2a$10$K7L1OJ0TfPIoGPEqgBXmzuH8gZmT3sT8MvF3Ht9iYpTKMmRjO8zKy', -- demo123
        p_name,
        true,
        p_org_id
    ) RETURNING id INTO v_user_id;
    
    -- Create campaign
    INSERT INTO campaigns (id, name, platform, status, "userId")
    VALUES (
        'campaign-' || gen_random_uuid()::text,
        'Test Campaign for ' || p_name,
        'instagram',
        'active',
        v_user_id
    ) RETURNING id INTO v_campaign_id;
    
    -- Create posts
    INSERT INTO posts (content, platform, status, "campaignId")
    VALUES 
        ('Test post 1', 'instagram', 'draft', v_campaign_id),
        ('Test post 2', 'instagram', 'scheduled', v_campaign_id),
        ('Test post 3', 'instagram', 'published', v_campaign_id);
    
    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to generate random activity data
CREATE OR REPLACE FUNCTION generate_test_activity(
    p_user_id TEXT,
    p_days INTEGER DEFAULT 30
) RETURNS void AS $$
DECLARE
    i INTEGER;
    v_campaign_id TEXT;
BEGIN
    FOR i IN 1..p_days LOOP
        -- Random API usage
        INSERT INTO api_usage (endpoint, model, tokens, cost, status, "userId", "createdAt")
        VALUES (
            '/api/ai/generate',
            CASE WHEN random() > 0.5 THEN 'gpt-4' ELSE 'gpt-3.5-turbo' END,
            (random() * 2000)::INTEGER,
            random() * 0.1,
            CASE WHEN random() > 0.9 THEN 'error' ELSE 'success' END,
            p_user_id,
            NOW() - (i || ' days')::INTERVAL + (random() * INTERVAL '24 hours')
        );
        
        -- Random notifications
        IF random() > 0.7 THEN
            INSERT INTO notifications (type, title, message, "userId", "createdAt")
            VALUES (
                CASE 
                    WHEN random() < 0.3 THEN 'error'
                    WHEN random() < 0.6 THEN 'warning'
                    WHEN random() < 0.9 THEN 'info'
                    ELSE 'success'
                END,
                'Test Notification',
                'This is a test notification for day ' || i,
                p_user_id,
                NOW() - (i || ' days')::INTERVAL
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =================================================================
-- PART 12: Reset Functions for Testing
-- =================================================================

-- Function to reset test data (keeps structure)
CREATE OR REPLACE FUNCTION reset_test_data() RETURNS void AS $$
BEGIN
    -- Delete test data (keeps demo data)
    DELETE FROM posts WHERE id LIKE 'post-test-%';
    DELETE FROM campaigns WHERE id LIKE 'campaign-test-%';
    DELETE FROM notifications WHERE id LIKE 'notif-test-%';
    DELETE FROM api_usage WHERE id LIKE 'api-test-%';
    DELETE FROM audit_logs WHERE id LIKE 'audit-test-%';
    DELETE FROM platform_connections WHERE id LIKE 'conn-test-%';
    DELETE FROM users WHERE id LIKE 'user-test-%';
    DELETE FROM organizations WHERE id LIKE 'org-test-%';
    
    -- Reset sequences if needed
    -- ALTER SEQUENCE ... RESTART WITH 1;
    
    RAISE NOTICE 'Test data reset complete';
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- =================================================================
-- USAGE EXAMPLES
-- =================================================================

-- Create a new test user:
-- SELECT create_test_user('newtest@synthex.social', 'New Test User');

-- Generate activity for a user:
-- SELECT generate_test_activity('user-demo-001', 7);

-- Reset test data:
-- SELECT reset_test_data();

-- =================================================================
-- ROLLBACK SCRIPT
-- =================================================================
-- BEGIN;
-- DELETE FROM audit_logs WHERE id LIKE 'audit-demo-%' OR id LIKE 'audit-test-%';
-- DELETE FROM api_usage WHERE id LIKE 'api-demo-%' OR id LIKE 'api-test-%';
-- DELETE FROM notifications WHERE id LIKE 'notif-demo-%' OR id LIKE 'notif-test-%';
-- DELETE FROM platform_connections WHERE id LIKE 'conn-demo-%' OR id LIKE 'conn-test-%';
-- DELETE FROM posts WHERE id LIKE 'post-demo-%' OR id LIKE 'post-test-%';
-- DELETE FROM campaigns WHERE id LIKE 'campaign-demo-%' OR id LIKE 'campaign-test-%';
-- DELETE FROM users WHERE id IN ('user-demo-001', 'user-admin-001', 'user-test-001');
-- DELETE FROM organizations WHERE id IN ('org-demo-001', 'org-test-001', 'org-test-002');
-- DELETE FROM psychology_principles WHERE category IN ('Cognitive Biases', 'Urgency Drivers', 'Social Psychology', 'Behavioral Economics');
-- DROP FUNCTION IF EXISTS create_test_user(TEXT, TEXT, TEXT);
-- DROP FUNCTION IF EXISTS generate_test_activity(TEXT, INTEGER);
-- DROP FUNCTION IF EXISTS reset_test_data();
-- COMMIT;