'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Users,
  UserPlus,
  MoreVertical,
  Shield,
  Edit,
  Eye,
  Trash2,
  Clock,
  Activity,
  Search,
  Filter,
  Mail,
  Phone,
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Crown,
  Settings,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';

// Types
interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Editor' | 'Viewer';
  avatar?: string;
  status: 'Active' | 'Pending' | 'Inactive';
  joinedAt: string;
  lastActive: string;
  permissions?: string[];
}

interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  timestamp: string;
  details?: string;
}

interface InviteFormData {
  email: string;
  role: 'Admin' | 'Editor' | 'Viewer';
  message?: string;
}

export default function TeamPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    {
      id: '1',
      name: 'John Smith',
      email: 'john@synthex.social',
      role: 'Admin',
      avatar: '',
      status: 'Active',
      joinedAt: '2024-01-15',
      lastActive: '2 hours ago',
      permissions: ['all']
    },
    {
      id: '2',
      name: 'Sarah Johnson',
      email: 'sarah@company.com',
      role: 'Editor',
      avatar: '',
      status: 'Active',
      joinedAt: '2024-02-20',
      lastActive: '5 minutes ago',
      permissions: ['create', 'edit', 'publish']
    },
    {
      id: '3',
      name: 'Mike Chen',
      email: 'mike@company.com',
      role: 'Viewer',
      avatar: '',
      status: 'Pending',
      joinedAt: '2024-03-01',
      lastActive: 'Never',
      permissions: ['view']
    },
    {
      id: '4',
      name: 'Emily Davis',
      email: 'emily@company.com',
      role: 'Editor',
      avatar: '',
      status: 'Inactive',
      joinedAt: '2024-01-30',
      lastActive: '2 days ago',
      permissions: ['create', 'edit']
    }
  ]);

  const [activityLog, setActivityLog] = useState<ActivityLog[]>([
    {
      id: '1',
      userId: '2',
      userName: 'Sarah Johnson',
      action: 'Created new content',
      timestamp: '2 hours ago',
      details: 'Instagram post for Q1 campaign'
    },
    {
      id: '2',
      userId: '1',
      userName: 'John Smith',
      action: 'Updated team permissions',
      timestamp: '4 hours ago',
      details: 'Added publishing rights to Mike Chen'
    },
    {
      id: '3',
      userId: '4',
      userName: 'Emily Davis',
      action: 'Accessed analytics',
      timestamp: '1 day ago',
      details: 'Viewed Q4 performance report'
    },
    {
      id: '4',
      userId: '2',
      userName: 'Sarah Johnson',
      action: 'Scheduled content',
      timestamp: '1 day ago',
      details: 'LinkedIn post for tomorrow 9 AM'
    },
    {
      id: '5',
      userId: '1',
      userName: 'John Smith',
      action: 'Invited team member',
      timestamp: '3 days ago',
      details: 'Sent invitation to mike@company.com'
    }
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteFormData>({
    email: '',
    role: 'Viewer',
    message: ''
  });

  // Filter team members
  const filteredMembers = teamMembers.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         member.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || member.status === statusFilter;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleInviteMember = async () => {
    if (!inviteForm.email) {
      toast.error('Please enter an email address');
      return;
    }

    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const newMember: TeamMember = {
        id: Date.now().toString(),
        name: inviteForm.email.split('@')[0],
        email: inviteForm.email,
        role: inviteForm.role,
        status: 'Pending',
        joinedAt: new Date().toISOString().split('T')[0],
        lastActive: 'Never',
        permissions: getRolePermissions(inviteForm.role)
      };

      setTeamMembers(prev => [...prev, newMember]);
      
      // Add to activity log
      const newActivity: ActivityLog = {
        id: Date.now().toString(),
        userId: '1', // Current user
        userName: 'John Smith', // Current user name
        action: 'Invited team member',
        timestamp: 'Just now',
        details: `Sent invitation to ${inviteForm.email}`
      };
      setActivityLog(prev => [newActivity, ...prev]);

      toast.success(`Invitation sent to ${inviteForm.email}`);
      setInviteDialogOpen(false);
      setInviteForm({ email: '', role: 'Viewer', message: '' });
    } catch (error) {
      toast.error('Failed to send invitation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: 'Admin' | 'Editor' | 'Viewer') => {
    try {
      const member = teamMembers.find(m => m.id === memberId);
      if (!member) return;

      setTeamMembers(prev => 
        prev.map(m => 
          m.id === memberId 
            ? { ...m, role: newRole, permissions: getRolePermissions(newRole) }
            : m
        )
      );

      // Add to activity log
      const newActivity: ActivityLog = {
        id: Date.now().toString(),
        userId: '1',
        userName: 'John Smith',
        action: 'Updated member role',
        timestamp: 'Just now',
        details: `Changed ${member.name}'s role to ${newRole}`
      };
      setActivityLog(prev => [newActivity, ...prev]);

      toast.success(`${member.name}'s role updated to ${newRole}`);
    } catch (error) {
      toast.error('Failed to update role');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const member = teamMembers.find(m => m.id === memberId);
      if (!member) return;

      setTeamMembers(prev => prev.filter(m => m.id !== memberId));
      
      // Add to activity log
      const newActivity: ActivityLog = {
        id: Date.now().toString(),
        userId: '1',
        userName: 'John Smith',
        action: 'Removed team member',
        timestamp: 'Just now',
        details: `Removed ${member.name} from the team`
      };
      setActivityLog(prev => [newActivity, ...prev]);

      toast.success(`${member.name} removed from team`);
    } catch (error) {
      toast.error('Failed to remove member');
    }
  };

  const handleResendInvitation = async (memberId: string) => {
    try {
      const member = teamMembers.find(m => m.id === memberId);
      if (!member) return;

      toast.success(`Invitation resent to ${member.email}`);
    } catch (error) {
      toast.error('Failed to resend invitation');
    }
  };

  const getRolePermissions = (role: string): string[] => {
    switch (role) {
      case 'Admin':
        return ['all'];
      case 'Editor':
        return ['create', 'edit', 'publish', 'schedule'];
      case 'Viewer':
        return ['view'];
      default:
        return ['view'];
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'Admin':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'Editor':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Viewer':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'Pending':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'Inactive':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Active':
        return <CheckCircle className="h-4 w-4" />;
      case 'Pending':
        return <AlertTriangle className="h-4 w-4" />;
      case 'Inactive':
        return <XCircle className="h-4 w-4" />;
      default:
        return <XCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Team Management</h1>
          <p className="text-gray-400 mt-1">
            Manage your team members, roles, and permissions
          </p>
        </div>
        <div className="flex space-x-3 mt-4 sm:mt-0">
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-white">
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent className="liquid-glass border border-white/10">
              <DialogHeader>
                <DialogTitle className="text-white">Invite Team Member</DialogTitle>
                <DialogDescription className="text-gray-400">
                  Send an invitation to join your team with specific role permissions.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="email" className="text-gray-400">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="member@company.com"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                    className="bg-white/5 border-white/10 text-white mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="role" className="text-gray-400">Role</Label>
                  <Select
                    value={inviteForm.role}
                    onValueChange={(value) => setInviteForm(prev => ({ ...prev, role: value as any }))}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="liquid-glass border-white/10">
                      <SelectItem value="Admin">
                        <div className="flex items-center">
                          <Crown className="mr-2 h-4 w-4 text-red-400" />
                          <div>
                            <div className="font-medium">Admin</div>
                            <div className="text-xs text-gray-400">Full access to all features</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="Editor">
                        <div className="flex items-center">
                          <Edit className="mr-2 h-4 w-4 text-blue-400" />
                          <div>
                            <div className="font-medium">Editor</div>
                            <div className="text-xs text-gray-400">Can create and edit content</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="Viewer">
                        <div className="flex items-center">
                          <Eye className="mr-2 h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium">Viewer</div>
                            <div className="text-xs text-gray-400">Read-only access</div>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="message" className="text-gray-400">Custom Message (Optional)</Label>
                  <textarea
                    id="message"
                    rows={3}
                    placeholder="Welcome to our team! We're excited to have you..."
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-white mt-1 placeholder:text-gray-500"
                    value={inviteForm.message}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, message: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setInviteDialogOpen(false)}
                  className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleInviteMember}
                  disabled={isLoading}
                  className="gradient-primary text-white"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Send Invitation
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="liquid-glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Total Members</p>
                <p className="text-2xl font-bold text-white">{teamMembers.length}</p>
              </div>
              <Users className="h-8 w-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="liquid-glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Active Members</p>
                <p className="text-2xl font-bold text-white">
                  {teamMembers.filter(m => m.status === 'Active').length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="liquid-glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Pending Invites</p>
                <p className="text-2xl font-bold text-white">
                  {teamMembers.filter(m => m.status === 'Pending').length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="liquid-glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Admins</p>
                <p className="text-2xl font-bold text-white">
                  {teamMembers.filter(m => m.role === 'Admin').length}
                </p>
              </div>
              <Crown className="h-8 w-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="liquid-glass">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 sm:space-x-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <Input
                type="search"
                placeholder="Search team members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
              />
            </div>
            <div className="flex space-x-3">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-32 bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="liquid-glass border-white/10">
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Editor">Editor</SelectItem>
                  <SelectItem value="Viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="liquid-glass border-white/10">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Team Members List */}
        <div className="lg:col-span-2">
          <Card className="liquid-glass">
            <CardHeader>
              <CardTitle className="text-white">Team Members</CardTitle>
              <CardDescription className="text-gray-400">
                Manage roles and permissions for your team
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {filteredMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10"
                >
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.avatar} alt={member.name} />
                      <AvatarFallback className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                        {member.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium text-white">{member.name}</h3>
                        {member.role === 'Admin' && <Crown className="h-4 w-4 text-red-400" />}
                      </div>
                      <p className="text-sm text-gray-400">{member.email}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge className={`text-xs ${getRoleBadgeColor(member.role)}`}>
                          {member.role}
                        </Badge>
                        <Badge className={`text-xs ${getStatusBadgeColor(member.status)} flex items-center space-x-1`}>
                          {getStatusIcon(member.status)}
                          <span>{member.status}</span>
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className="text-right">
                      <p className="text-sm text-gray-400">Last active</p>
                      <p className="text-xs text-gray-500">{member.lastActive}</p>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-gray-400">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="liquid-glass border-white/10" align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-white/10" />
                        
                        {member.status === 'Pending' && (
                          <>
                            <DropdownMenuItem onClick={() => handleResendInvitation(member.id)}>
                              <Mail className="mr-2 h-4 w-4" />
                              Resend Invitation
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-white/10" />
                          </>
                        )}
                        
                        <DropdownMenuLabel>Change Role</DropdownMenuLabel>
                        {['Admin', 'Editor', 'Viewer'].map((role) => (
                          <DropdownMenuItem
                            key={role}
                            onClick={() => handleUpdateRole(member.id, role as any)}
                            disabled={member.role === role}
                          >
                            {role === 'Admin' && <Crown className="mr-2 h-4 w-4 text-red-400" />}
                            {role === 'Editor' && <Edit className="mr-2 h-4 w-4 text-blue-400" />}
                            {role === 'Viewer' && <Eye className="mr-2 h-4 w-4 text-gray-400" />}
                            {role}
                            {member.role === role && <span className="ml-auto text-xs">(current)</span>}
                          </DropdownMenuItem>
                        ))}
                        
                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuItem
                          onClick={() => handleRemoveMember(member.id)}
                          className="text-red-400 focus:text-red-400"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove Member
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
              
              {filteredMembers.length === 0 && (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-400">No team members found</h3>
                  <p className="text-gray-500">Try adjusting your search or filters.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Activity Log */}
        <div>
          <Card className="liquid-glass">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Activity className="mr-2 h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription className="text-gray-400">
                Team member activity and changes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {activityLog.slice(0, 10).map((activity) => (
                <div key={activity.id} className="flex space-x-3">
                  <div className="flex-shrink-0">
                    <div className="h-2 w-2 rounded-full bg-purple-400 mt-2"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">
                      <span className="font-medium">{activity.userName}</span>
                      <span className="text-gray-400"> {activity.action}</span>
                    </p>
                    {activity.details && (
                      <p className="text-xs text-gray-500 mt-1">{activity.details}</p>
                    )}
                    <div className="flex items-center mt-2">
                      <Clock className="h-3 w-3 text-gray-500 mr-1" />
                      <span className="text-xs text-gray-500">{activity.timestamp}</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Role Permissions Guide */}
          <Card className="liquid-glass mt-6">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Shield className="mr-2 h-5 w-5" />
                Role Permissions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Crown className="h-4 w-4 text-red-400" />
                  <span className="text-sm font-medium text-red-400">Admin</span>
                </div>
                <ul className="text-xs text-gray-400 space-y-1 ml-6">
                  <li>• Full system access</li>
                  <li>• Manage team members</li>
                  <li>• Billing and settings</li>
                  <li>• All content permissions</li>
                </ul>
              </div>
              
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Edit className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-medium text-blue-400">Editor</span>
                </div>
                <ul className="text-xs text-gray-400 space-y-1 ml-6">
                  <li>• Create and edit content</li>
                  <li>• Schedule posts</li>
                  <li>• Access analytics</li>
                  <li>• Use AI features</li>
                </ul>
              </div>
              
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Eye className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-400">Viewer</span>
                </div>
                <ul className="text-xs text-gray-400 space-y-1 ml-6">
                  <li>• View all content</li>
                  <li>• Access reports</li>
                  <li>• Export data</li>
                  <li>• No edit permissions</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}