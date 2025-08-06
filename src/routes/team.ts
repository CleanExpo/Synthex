import express, { RequestHandler } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import jwt from 'jsonwebtoken';

interface TeamMember {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'editor' | 'viewer';
    joinedAt: string;
    lastActive: string;
    stats: {
        campaigns: number;
        content: number;
        reach: number;
    };
}

interface TeamActivity {
    id: string;
    memberId: string;
    memberName: string;
    action: string;
    target?: string;
    timestamp: string;
}

interface TeamInviteRequest {
    email: string;
    role: 'admin' | 'editor' | 'viewer';
    message?: string;
    campaignAccess: string[];
}

const router = express.Router();

// Sample team members data
const sampleMembers: TeamMember[] = [
    {
        id: '1',
        name: 'Sarah Johnson',
        email: 'sarah@example.com',
        role: 'admin',
        joinedAt: '2024-01-15T00:00:00Z',
        lastActive: new Date().toISOString(),
        stats: {
            campaigns: 45,
            content: 128,
            reach: 450000
        }
    },
    {
        id: '2',
        name: 'Michael Chen',
        email: 'michael@example.com',
        role: 'editor',
        joinedAt: '2024-02-20T00:00:00Z',
        lastActive: new Date(Date.now() - 2 * 3600000).toISOString(),
        stats: {
            campaigns: 23,
            content: 67,
            reach: 125000
        }
    },
    {
        id: '3',
        name: 'Emily Davis',
        email: 'emily@example.com',
        role: 'editor',
        joinedAt: '2024-03-10T00:00:00Z',
        lastActive: new Date(Date.now() - 24 * 3600000).toISOString(),
        stats: {
            campaigns: 18,
            content: 42,
            reach: 89000
        }
    },
    {
        id: '4',
        name: 'James Wilson',
        email: 'james@example.com',
        role: 'viewer',
        joinedAt: '2024-04-05T00:00:00Z',
        lastActive: new Date(Date.now() - 3 * 24 * 3600000).toISOString(),
        stats: {
            campaigns: 0,
            content: 0,
            reach: 0
        }
    }
];

// Sample team activity data
const sampleActivity: TeamActivity[] = [
    {
        id: '1',
        memberId: '1',
        memberName: 'Sarah Johnson',
        action: 'created a new campaign',
        target: 'Summer Sale 2024',
        timestamp: new Date(Date.now() - 30 * 60000).toISOString()
    },
    {
        id: '2',
        memberId: '2',
        memberName: 'Michael Chen',
        action: 'published content to',
        target: 'Instagram',
        timestamp: new Date(Date.now() - 2 * 3600000).toISOString()
    },
    {
        id: '3',
        memberId: '3',
        memberName: 'Emily Davis',
        action: 'generated AI content for',
        target: 'Product Launch',
        timestamp: new Date(Date.now() - 5 * 3600000).toISOString()
    },
    {
        id: '4',
        memberId: '1',
        memberName: 'Sarah Johnson',
        action: 'updated campaign settings for',
        target: 'Holiday Special',
        timestamp: new Date(Date.now() - 24 * 3600000).toISOString()
    },
    {
        id: '5',
        memberId: '2',
        memberName: 'Michael Chen',
        action: 'scheduled 5 posts for',
        target: 'next week',
        timestamp: new Date(Date.now() - 2 * 24 * 3600000).toISOString()
    }
];

// Authentication middleware
const requireAuth: RequestHandler = (req, res, next) => {
    const authReq = req as AuthenticatedRequest;
    const token = authReq.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-key') as any;
        authReq.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// GET /api/v1/team/members - Get team members
router.get('/members', requireAuth, (req, res) => {
    try {
        const authReq = req as AuthenticatedRequest;
        
        // In a real app, you would filter based on user permissions
        // For now, return all members
        res.json({
            success: true,
            data: sampleMembers
        });
    } catch (error) {
        console.error('Error fetching team members:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch team members'
        });
    }
});

// POST /api/v1/team/invite - Send team invitation
router.post('/invite', requireAuth, (req, res) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { email, role, message, campaignAccess }: TeamInviteRequest = req.body;
        
        // Validate required fields
        if (!email || !role) {
            return res.status(400).json({
                success: false,
                error: 'Email and role are required'
            });
        }
        
        // Validate role
        if (!['admin', 'editor', 'viewer'].includes(role)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid role specified'
            });
        }
        
        // Check if user already exists
        const existingMember = sampleMembers.find(member => member.email === email);
        if (existingMember) {
            return res.status(409).json({
                success: false,
                error: 'User is already a team member'
            });
        }
        
        // In a real app, you would:
        // 1. Generate an invitation token
        // 2. Store the invitation in the database
        // 3. Send an email to the invited user
        // 4. Log the invitation activity
        
        console.log(`Team invitation sent to ${email} with role ${role}`);
        console.log('Message:', message);
        console.log('Campaign access:', campaignAccess);
        
        // Add activity record
        const newActivity: TeamActivity = {
            id: String(sampleActivity.length + 1),
            memberId: authReq.user?.id || '1',
            memberName: authReq.user?.name || 'Current User',
            action: 'invited',
            target: `${email} as ${role}`,
            timestamp: new Date().toISOString()
        };
        sampleActivity.unshift(newActivity);
        
        res.json({
            success: true,
            message: 'Invitation sent successfully',
            data: {
                email,
                role,
                invitedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error sending team invitation:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send invitation'
        });
    }
});

// PUT /api/v1/team/members/:id/role - Update member role
router.put('/members/:id/role', requireAuth, (req, res) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { id } = req.params;
        const { role } = req.body;
        
        // Validate role
        if (!role || !['admin', 'editor', 'viewer'].includes(role)) {
            return res.status(400).json({
                success: false,
                error: 'Valid role is required'
            });
        }
        
        // Find member
        const memberIndex = sampleMembers.findIndex(member => member.id === id);
        if (memberIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Team member not found'
            });
        }
        
        const member = sampleMembers[memberIndex];
        const oldRole = member.role;
        
        // Update member role
        sampleMembers[memberIndex] = {
            ...member,
            role: role as 'admin' | 'editor' | 'viewer'
        };
        
        // Add activity record
        const newActivity: TeamActivity = {
            id: String(sampleActivity.length + 1),
            memberId: authReq.user?.id || '1',
            memberName: authReq.user?.name || 'Current User',
            action: 'updated role for',
            target: `${member.name} from ${oldRole} to ${role}`,
            timestamp: new Date().toISOString()
        };
        sampleActivity.unshift(newActivity);
        
        res.json({
            success: true,
            message: 'Member role updated successfully',
            data: sampleMembers[memberIndex]
        });
    } catch (error) {
        console.error('Error updating member role:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update member role'
        });
    }
});

// DELETE /api/v1/team/members/:id - Remove team member
router.delete('/members/:id', requireAuth, (req, res) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { id } = req.params;
        
        // Find member
        const memberIndex = sampleMembers.findIndex(member => member.id === id);
        if (memberIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Team member not found'
            });
        }
        
        const member = sampleMembers[memberIndex];
        
        // Prevent removing admin users (simple check)
        if (member.role === 'admin' && sampleMembers.filter(m => m.role === 'admin').length === 1) {
            return res.status(403).json({
                success: false,
                error: 'Cannot remove the last admin user'
            });
        }
        
        // Remove member
        sampleMembers.splice(memberIndex, 1);
        
        // Add activity record
        const newActivity: TeamActivity = {
            id: String(sampleActivity.length + 1),
            memberId: authReq.user?.id || '1',
            memberName: authReq.user?.name || 'Current User',
            action: 'removed team member',
            target: member.name,
            timestamp: new Date().toISOString()
        };
        sampleActivity.unshift(newActivity);
        
        res.json({
            success: true,
            message: 'Team member removed successfully',
            data: { removedMember: member.name }
        });
    } catch (error) {
        console.error('Error removing team member:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to remove team member'
        });
    }
});

// GET /api/v1/team/activity - Get team activity
router.get('/activity', requireAuth, (req, res) => {
    try {
        const { limit = '10', offset = '0' } = req.query;
        const limitNum = parseInt(limit as string, 10);
        const offsetNum = parseInt(offset as string, 10);
        
        // Sort activity by timestamp (newest first)
        const sortedActivity = sampleActivity.sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        
        // Apply pagination
        const paginatedActivity = sortedActivity.slice(offsetNum, offsetNum + limitNum);
        
        res.json({
            success: true,
            data: paginatedActivity,
            pagination: {
                total: sortedActivity.length,
                limit: limitNum,
                offset: offsetNum,
                hasMore: offsetNum + limitNum < sortedActivity.length
            }
        });
    } catch (error) {
        console.error('Error fetching team activity:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch team activity'
        });
    }
});

// GET /api/v1/team/stats - Get team statistics
router.get('/stats', requireAuth, (req, res) => {
    try {
        // Calculate team stats from sample data
        const totalMembers = sampleMembers.length;
        const totalCampaigns = sampleMembers.reduce((sum, member) => sum + member.stats.campaigns, 0);
        const totalContent = sampleMembers.reduce((sum, member) => sum + member.stats.content, 0);
        const totalReach = sampleMembers.reduce((sum, member) => sum + member.stats.reach, 0);
        
        res.json({
            success: true,
            data: {
                totalMembers,
                activeCampaigns: totalCampaigns,
                contentCreated: totalContent,
                totalReach
            }
        });
    } catch (error) {
        console.error('Error fetching team stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch team statistics'
        });
    }
});

export default router;