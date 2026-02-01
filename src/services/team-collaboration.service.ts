import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export interface CreateTeamData {
  name: string;
  description?: string;
  ownerId: string;
}

export interface TeamInviteData {
  teamId: string;
  email: string;
  role?: string;
  invitedBy: string;
}

export class TeamCollaborationService {
  static async createTeam(data: CreateTeamData) {
    try {
      const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      
      await prisma.$executeRaw`
        INSERT INTO teams (name, slug, description, owner_id, settings)
        VALUES (${data.name}, ${slug}, ${data.description || null}, ${data.ownerId}, '{}'::jsonb)
      `;
      
      return { success: true, slug };
    } catch (error) {
      console.error('Error creating team:', error);
      return { success: false, error };
    }
  }

  static async inviteMember(data: TeamInviteData) {
    try {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration
      
      await prisma.$executeRaw`
        INSERT INTO team_invites (team_id, email, role, invited_by, token, expires_at)
        VALUES (${data.teamId}, ${data.email}, ${data.role || 'member'}, ${data.invitedBy}, ${token}, ${expiresAt})
      `;
      
      return { success: true, token };
    } catch (error) {
      console.error('Error inviting team member:', error);
      return { success: false, error };
    }
  }

  static async acceptInvite(token: string, userId: string) {
    try {
      const invite = await prisma.$queryRaw<any[]>`
        SELECT * FROM team_invites 
        WHERE token = ${token} AND accepted_at IS NULL AND expires_at > NOW()
        LIMIT 1
      `;

      if (!invite || invite.length === 0) {
        return { success: false, error: 'Invalid or expired invite' };
      }

      await prisma.$transaction([
        prisma.$executeRaw`
          INSERT INTO team_members (team_id, user_id, role)
          VALUES (${invite[0].team_id}, ${userId}, ${invite[0].role})
        `,
        prisma.$executeRaw`
          UPDATE team_invites 
          SET accepted_at = NOW() 
          WHERE token = ${token}
        `
      ]);

      return { success: true };
    } catch (error) {
      console.error('Error accepting invite:', error);
      return { success: false, error };
    }
  }

  static async getUserTeams(userId: string) {
    try {
      const teams = await prisma.$queryRaw<any[]>`
        SELECT t.*, tm.role as member_role
        FROM teams t
        JOIN team_members tm ON t.id = tm.team_id
        WHERE tm.user_id = ${userId}
        ORDER BY t.created_at DESC
      `;
      
      return { success: true, data: teams };
    } catch (error) {
      console.error('Error getting user teams:', error);
      return { success: false, error };
    }
  }

  static async logActivity(teamId: string, userId: string, action: string, details: any = {}) {
    try {
      await prisma.$executeRaw`
        INSERT INTO team_activity_log (team_id, user_id, action, details)
        VALUES (${teamId}, ${userId}, ${action}, ${JSON.stringify(details)}::jsonb)
      `;
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }
}

export default TeamCollaborationService;
