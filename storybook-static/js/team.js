// Team Management Functionality

let teamMembers = [];
let teamActivity = [];
let currentFilter = 'all';

// Initialize team page
async function initializeTeam() {
    await loadTeamMembers();
    await loadTeamActivity();
    await loadTeamStats();
}

// Load team members
async function loadTeamMembers() {
    try {
        const response = await synthexAPI.getTeamMembers();
        if (response && response.data) {
            teamMembers = response.data;
            renderMembers();
        }
    } catch (error) {
        console.error('Failed to load team members:', error);
        // Use sample data
        useSampleData();
    }
}

// Render team members
function renderMembers() {
    const grid = document.getElementById('membersGrid');
    
    // Filter members based on current filter
    let filteredMembers = teamMembers;
    if (currentFilter !== 'all') {
        filteredMembers = teamMembers.filter(member => member.role === currentFilter);
    }
    
    if (filteredMembers.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: var(--space-4xl); color: var(--text-muted);">
                <p>No team members found</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = filteredMembers.map(member => `
        <div class="member-card" onclick="viewMemberDetails('${member.id}')">
            <div class="member-header">
                <div class="member-avatar">${getInitials(member.name)}</div>
                <div class="member-info">
                    <div class="member-name">${member.name}</div>
                    <div class="member-role">
                        <span class="role-badge ${member.role}">${capitalizeFirst(member.role)}</span>
                    </div>
                </div>
            </div>
            
            <div class="member-stats">
                <div class="member-stat">
                    <div class="member-stat-value">${member.stats?.campaigns || 0}</div>
                    <div class="member-stat-label">Campaigns</div>
                </div>
                <div class="member-stat">
                    <div class="member-stat-value">${member.stats?.content || 0}</div>
                    <div class="member-stat-label">Content</div>
                </div>
                <div class="member-stat">
                    <div class="member-stat-value">${formatLastActive(member.lastActive)}</div>
                    <div class="member-stat-label">Last Active</div>
                </div>
            </div>
            
            <div class="member-actions">
                <button class="member-action" onclick="messageMember(event, '${member.id}')">
                    Message
                </button>
                <button class="member-action" onclick="viewMemberActivity(event, '${member.id}')">
                    Activity
                </button>
                ${member.role !== 'admin' ? `
                    <button class="member-action" onclick="editMemberRole(event, '${member.id}')">
                        Edit Role
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

// Load team activity
async function loadTeamActivity() {
    try {
        const response = await synthexAPI.getTeamActivity();
        if (response && response.data) {
            teamActivity = response.data;
            renderActivity();
        }
    } catch (error) {
        console.error('Failed to load team activity:', error);
        // Use sample activity
        useSampleActivity();
    }
}

// Render activity
function renderActivity() {
    const list = document.getElementById('activityList');
    
    if (teamActivity.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; padding: var(--space-xl); color: var(--text-muted);">
                <p>No recent activity</p>
            </div>
        `;
        return;
    }
    
    list.innerHTML = teamActivity.slice(0, 10).map(activity => `
        <div class="activity-item">
            <div class="activity-avatar">${getInitials(activity.memberName)}</div>
            <div class="activity-content">
                <div class="activity-text">
                    <strong>${activity.memberName}</strong> ${activity.action}
                    ${activity.target ? ` <span style="color: var(--primary);">${activity.target}</span>` : ''}
                </div>
                <div class="activity-time">${formatTime(activity.timestamp)}</div>
            </div>
        </div>
    `).join('');
}

// Load team stats
async function loadTeamStats() {
    try {
        const response = await synthexAPI.getTeamStats();
        if (response && response.data) {
            document.getElementById('totalMembers').textContent = response.data.totalMembers || teamMembers.length;
            document.getElementById('activeCampaigns').textContent = response.data.activeCampaigns || 12;
            document.getElementById('contentCreated').textContent = response.data.contentCreated || 248;
            document.getElementById('totalReach').textContent = formatNumber(response.data.totalReach || 125000);
        }
    } catch (error) {
        console.error('Failed to load team stats:', error);
    }
}

// Filter members
function filterMembers(role) {
    currentFilter = role;
    renderMembers();
}

// Open invite modal
function openInviteModal() {
    document.getElementById('inviteModal').style.display = 'flex';
}

// Close invite modal
function closeInviteModal() {
    document.getElementById('inviteModal').style.display = 'none';
    document.getElementById('inviteForm').reset();
}

// Send invite
async function sendInvite(event) {
    event.preventDefault();
    
    const email = document.getElementById('inviteEmail').value;
    const role = document.getElementById('inviteRole').value;
    const message = document.getElementById('inviteMessage').value;
    const campaignAccess = Array.from(document.querySelectorAll('#inviteForm .checkbox-input:checked'))
        .map(cb => cb.value);
    
    try {
        const response = await synthexAPI.inviteTeamMember({
            email,
            role,
            message,
            campaignAccess
        });
        
        if (response && response.success) {
            showNotification('Invitation sent successfully!', 'success');
            closeInviteModal();
            
            // Add notification
            window.notificationSystem.addNotification({
                type: 'success',
                title: 'Team Invitation Sent',
                message: `Invitation sent to ${email}`,
                data: { email, role }
            });
        }
    } catch (error) {
        console.error('Failed to send invite:', error);
        showNotification('Failed to send invitation', 'error');
    }
}

// Quick invite
async function quickInvite(event) {
    event.preventDefault();
    
    const form = event.target;
    const email = form.querySelector('input[type="email"]').value;
    const role = form.querySelector('select').value;
    
    try {
        const response = await synthexAPI.inviteTeamMember({
            email,
            role,
            campaignAccess: ['all']
        });
        
        if (response && response.success) {
            showNotification('Invitation sent!', 'success');
            form.reset();
        }
    } catch (error) {
        console.error('Failed to send quick invite:', error);
        showNotification('Failed to send invitation', 'error');
    }
}

// View member details
function viewMemberDetails(memberId) {
    const member = teamMembers.find(m => m.id === memberId);
    if (!member) return;
    
    const modal = document.getElementById('memberModal');
    const title = document.getElementById('memberModalTitle');
    const content = document.getElementById('memberModalContent');
    
    title.textContent = member.name;
    
    content.innerHTML = `
        <div style="display: flex; gap: var(--space-xl); margin-bottom: var(--space-xl);">
            <div style="text-align: center;">
                <div class="member-avatar" style="width: 80px; height: 80px; font-size: 2rem; margin: 0 auto var(--space-md);">
                    ${getInitials(member.name)}
                </div>
                <div class="role-badge ${member.role}" style="font-size: 0.875rem;">
                    ${capitalizeFirst(member.role)}
                </div>
            </div>
            <div style="flex: 1;">
                <div style="margin-bottom: var(--space-sm);">
                    <div style="font-size: 0.875rem; color: var(--text-secondary);">Email</div>
                    <div>${member.email}</div>
                </div>
                <div style="margin-bottom: var(--space-sm);">
                    <div style="font-size: 0.875rem; color: var(--text-secondary);">Joined</div>
                    <div>${new Date(member.joinedAt).toLocaleDateString()}</div>
                </div>
                <div>
                    <div style="font-size: 0.875rem; color: var(--text-secondary);">Last Active</div>
                    <div>${formatTime(member.lastActive)}</div>
                </div>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-md); margin-bottom: var(--space-xl);">
            <div style="text-align: center; padding: var(--space-md); background: rgba(255, 255, 255, 0.02); border-radius: var(--radius-md);">
                <div style="font-size: 1.5rem; font-weight: 700; margin-bottom: var(--space-xs);">
                    ${member.stats?.campaigns || 0}
                </div>
                <div style="font-size: 0.813rem; color: var(--text-secondary);">Campaigns</div>
            </div>
            <div style="text-align: center; padding: var(--space-md); background: rgba(255, 255, 255, 0.02); border-radius: var(--radius-md);">
                <div style="font-size: 1.5rem; font-weight: 700; margin-bottom: var(--space-xs);">
                    ${member.stats?.content || 0}
                </div>
                <div style="font-size: 0.813rem; color: var(--text-secondary);">Content Created</div>
            </div>
            <div style="text-align: center; padding: var(--space-md); background: rgba(255, 255, 255, 0.02); border-radius: var(--radius-md);">
                <div style="font-size: 1.5rem; font-weight: 700; margin-bottom: var(--space-xs);">
                    ${formatNumber(member.stats?.reach || 0)}
                </div>
                <div style="font-size: 0.813rem; color: var(--text-secondary);">Total Reach</div>
            </div>
        </div>
        
        ${member.role !== 'admin' ? `
            <div class="form-group">
                <label class="form-label">Change Role</label>
                <select class="form-select" id="changeMemberRole">
                    <option value="viewer" ${member.role === 'viewer' ? 'selected' : ''}>Viewer</option>
                    <option value="editor" ${member.role === 'editor' ? 'selected' : ''}>Editor</option>
                    <option value="admin" ${member.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
            </div>
            
            <div class="form-actions">
                <button class="btn btn-secondary" onclick="removeMember('${member.id}')">
                    Remove from Team
                </button>
                <button class="btn btn-primary" onclick="updateMemberRole('${member.id}')">
                    Update Role
                </button>
            </div>
        ` : ''}
    `;
    
    modal.style.display = 'flex';
}

// Close member modal
function closeMemberModal() {
    document.getElementById('memberModal').style.display = 'none';
}

// Message member
function messageMember(event, memberId) {
    event.stopPropagation();
    const member = teamMembers.find(m => m.id === memberId);
    if (member) {
        // In a real app, this would open a messaging interface
        showNotification(`Opening chat with ${member.name}...`, 'info');
    }
}

// View member activity
function viewMemberActivity(event, memberId) {
    event.stopPropagation();
    const member = teamMembers.find(m => m.id === memberId);
    if (member) {
        // Filter activity by member
        const memberActivity = teamActivity.filter(a => a.memberId === memberId);
        // In a real app, this would show member-specific activity
        console.log('Member activity:', memberActivity);
    }
}

// Edit member role
function editMemberRole(event, memberId) {
    event.stopPropagation();
    viewMemberDetails(memberId);
}

// Update member role
async function updateMemberRole(memberId) {
    const newRole = document.getElementById('changeMemberRole').value;
    
    try {
        const response = await synthexAPI.updateTeamMemberRole(memberId, newRole);
        if (response && response.success) {
            showNotification('Role updated successfully!', 'success');
            closeMemberModal();
            loadTeamMembers();
        }
    } catch (error) {
        console.error('Failed to update role:', error);
        showNotification('Failed to update role', 'error');
    }
}

// Remove member
async function removeMember(memberId) {
    if (!confirm('Are you sure you want to remove this member from the team?')) {
        return;
    }
    
    try {
        const response = await synthexAPI.removeTeamMember(memberId);
        if (response && response.success) {
            showNotification('Member removed successfully', 'success');
            closeMemberModal();
            loadTeamMembers();
        }
    } catch (error) {
        console.error('Failed to remove member:', error);
        showNotification('Failed to remove member', 'error');
    }
}

// Load more activity
function loadMoreActivity() {
    // In a real app, this would load more activity items
    console.log('Loading more activity...');
}

// Helper functions
function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatLastActive(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 3600000) {
        return 'Active';
    } else if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours}h ago`;
    } else {
        const days = Math.floor(diff / 86400000);
        return `${days}d ago`;
    }
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) {
        return 'Just now';
    } else if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
        return date.toLocaleDateString();
    }
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function showNotification(message, type = 'info') {
    // Use the notification system
    window.notificationSystem.addNotification({
        type: type,
        title: type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Info',
        message: message
    });
}

// Sample data
function useSampleData() {
    teamMembers = [
        {
            id: '1',
            name: 'Sarah Johnson',
            email: 'sarah@example.com',
            role: 'admin',
            joinedAt: '2024-01-15',
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
            joinedAt: '2024-02-20',
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
            joinedAt: '2024-03-10',
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
            joinedAt: '2024-04-05',
            lastActive: new Date(Date.now() - 3 * 24 * 3600000).toISOString(),
            stats: {
                campaigns: 0,
                content: 0,
                reach: 0
            }
        }
    ];
    
    renderMembers();
}

function useSampleActivity() {
    teamActivity = [
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
    
    renderActivity();
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTeam);
} else {
    initializeTeam();
}

// Close modals on outside click
window.addEventListener('click', (event) => {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
});