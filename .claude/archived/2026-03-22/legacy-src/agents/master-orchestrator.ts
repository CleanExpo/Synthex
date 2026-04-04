/**
 * Master Orchestrator Agent
 * Oversees ALL other agents and ensures unified operation across the entire platform
 */

import { EventEmitter } from 'events';

interface AgentStatus {
    id: string;
    name: string;
    status: 'idle' | 'active' | 'error' | 'offline';
    lastActivity: Date;
    health: number; // 0-100
    tasks: Task[];
    capabilities: string[];
}

interface Task {
    id: string;
    type: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    assignedAgent: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    data: any;
    createdAt: Date;
    updatedAt: Date;
}

interface UserSession {
    userId: string;
    tier: 'basic' | 'pro' | 'enterprise';
    permissions: string[];
    activeProjects: string[];
    preferences: any;
}

export class MasterOrchestrator extends EventEmitter {
    private agents: Map<string, AgentStatus> = new Map();
    private tasks: Map<string, Task> = new Map();
    private userSessions: Map<string, UserSession> = new Map();
    private systemHealth: number = 100;
    private isActive: boolean = false;

    constructor() {
        super();
        this.initializeAgents();
        this.startHealthMonitoring();
    }

    /**
     * Initialize all available agents in the system
     */
    private initializeAgents() {
        const agentConfigs = [
            {
                id: 'content-generator',
                name: 'Content Generation Agent',
                capabilities: ['text-generation', 'image-creation', 'video-scripts', 'social-posts']
            },
            {
                id: 'campaign-optimizer',
                name: 'Campaign Optimization Agent',
                capabilities: ['a-b-testing', 'performance-analysis', 'audience-targeting', 'budget-optimization']
            },
            {
                id: 'analytics-engine',
                name: 'Analytics Engine Agent',
                capabilities: ['data-collection', 'reporting', 'insights-generation', 'predictive-analysis']
            },
            {
                id: 'social-scheduler',
                name: 'Social Media Scheduler',
                capabilities: ['post-scheduling', 'cross-platform-posting', 'timing-optimization', 'queue-management']
            },
            {
                id: 'audience-intelligence',
                name: 'Audience Intelligence Agent',
                capabilities: ['demographic-analysis', 'behavior-tracking', 'persona-creation', 'segmentation']
            },
            {
                id: 'compliance-monitor',
                name: 'Compliance Monitoring Agent',
                capabilities: ['policy-checking', 'content-moderation', 'legal-compliance', 'brand-safety']
            },
            {
                id: 'trend-predictor',
                name: 'Trend Prediction Agent',
                capabilities: ['trend-analysis', 'viral-prediction', 'hashtag-optimization', 'timing-analysis']
            },
            {
                id: 'platform-specialist',
                name: 'Platform Specialist Agent',
                capabilities: ['platform-optimization', 'format-adaptation', 'algorithm-analysis', 'feature-utilization']
            }
        ];

        agentConfigs.forEach(config => {
            this.agents.set(config.id, {
                ...config,
                status: 'idle',
                lastActivity: new Date(),
                health: 100,
                tasks: [],
            });
        });

        console.log(`🎭 Master Orchestrator initialized with ${this.agents.size} agents`);
    }

    /**
     * Start the master orchestrator
     */
    async start(): Promise<void> {
        this.isActive = true;
        console.log('🚀 Master Orchestrator starting...');

        // Start all agents
        for (const [agentId, agent] of this.agents) {
            await this.startAgent(agentId);
        }

        // Start task processing
        this.startTaskProcessing();

        console.log('✅ Master Orchestrator is now active');
        this.emit('orchestrator:started');
    }

    /**
     * Stop the master orchestrator
     */
    async stop(): Promise<void> {
        this.isActive = false;
        console.log('🛑 Master Orchestrator stopping...');

        // Stop all agents
        for (const [agentId] of this.agents) {
            await this.stopAgent(agentId);
        }

        console.log('✅ Master Orchestrator stopped');
        this.emit('orchestrator:stopped');
    }

    /**
     * Create a new task and assign it to the best agent
     */
    async createTask(taskData: Partial<Task>): Promise<string> {
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const task: Task = {
            id: taskId,
            type: taskData.type || 'general',
            priority: taskData.priority || 'medium',
            assignedAgent: '',
            status: 'pending',
            data: taskData.data || {},
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Find the best agent for this task
        const bestAgent = await this.findBestAgent(task);
        if (bestAgent) {
            task.assignedAgent = bestAgent.id;
            bestAgent.tasks.push(task);
        }

        this.tasks.set(taskId, task);
        
        console.log(`📋 Created task ${taskId} assigned to ${task.assignedAgent}`);
        this.emit('task:created', task);

        return taskId;
    }

    /**
     * Create a user session with tier-based permissions
     */
    createUserSession(userId: string, tier: 'basic' | 'pro' | 'enterprise'): UserSession {
        const permissions = this.getTierPermissions(tier);
        
        const session: UserSession = {
            userId,
            tier,
            permissions,
            activeProjects: [],
            preferences: {}
        };

        this.userSessions.set(userId, session);
        console.log(`👤 Created user session for ${userId} (${tier} tier)`);
        
        return session;
    }

    /**
     * Get tier-based permissions
     */
    private getTierPermissions(tier: 'basic' | 'pro' | 'enterprise'): string[] {
        const permissions = {
            basic: [
                'content:create:basic',
                'campaign:create:single',
                'analytics:view:basic',
                'posts:schedule:5_per_day'
            ],
            pro: [
                'content:create:advanced',
                'campaign:create:multiple',
                'analytics:view:advanced',
                'posts:schedule:unlimited',
                'ai:advanced_features',
                'collaboration:team_features',
                'automation:workflows'
            ],
            enterprise: [
                'content:create:enterprise',
                'campaign:create:enterprise',
                'analytics:view:enterprise',
                'posts:schedule:unlimited',
                'ai:enterprise_features',
                'collaboration:enterprise',
                'automation:advanced',
                'api:full_access',
                'white_label:enabled',
                'custom_integrations'
            ]
        };

        return permissions[tier];
    }

    /**
     * Process user request through the orchestrator
     */
    async processUserRequest(userId: string, request: any): Promise<any> {
        const session = this.userSessions.get(userId);
        if (!session) {
            throw new Error('User session not found');
        }

        // Check permissions
        const requiredPermission = this.getRequiredPermission(request.type);
        if (requiredPermission && !session.permissions.includes(requiredPermission)) {
            throw new Error(`Insufficient permissions. Upgrade to ${this.getRequiredTier(requiredPermission)} tier.`);
        }

        // Create task based on request
        const taskId = await this.createTask({
            type: request.type,
            priority: this.getPriorityForUser(session.tier),
            data: { ...request, userId }
        });

        // Track task for user
        const task = this.tasks.get(taskId);
        if (task) {
            this.emit('user:request:processed', { userId, taskId, request });
            return { taskId, status: 'processing', estimatedCompletion: this.getEstimatedCompletion(task) };
        }

        throw new Error('Failed to create task');
    }

    /**
     * Get comprehensive system status
     */
    getSystemStatus(): any {
        const agentStatuses = Array.from(this.agents.values());
        const activeTasks = Array.from(this.tasks.values()).filter(t => t.status === 'in_progress');
        const completedTasks = Array.from(this.tasks.values()).filter(t => t.status === 'completed');

        return {
            orchestrator: {
                status: this.isActive ? 'active' : 'inactive',
                health: this.systemHealth,
                uptime: process.uptime()
            },
            agents: {
                total: agentStatuses.length,
                active: agentStatuses.filter(a => a.status === 'active').length,
                idle: agentStatuses.filter(a => a.status === 'idle').length,
                error: agentStatuses.filter(a => a.status === 'error').length,
                list: agentStatuses
            },
            tasks: {
                total: this.tasks.size,
                active: activeTasks.length,
                completed: completedTasks.length,
                pending: Array.from(this.tasks.values()).filter(t => t.status === 'pending').length,
                failed: Array.from(this.tasks.values()).filter(t => t.status === 'failed').length
            },
            users: {
                activeSessions: this.userSessions.size,
                tiers: {
                    basic: Array.from(this.userSessions.values()).filter(s => s.tier === 'basic').length,
                    pro: Array.from(this.userSessions.values()).filter(s => s.tier === 'pro').length,
                    enterprise: Array.from(this.userSessions.values()).filter(s => s.tier === 'enterprise').length
                }
            }
        };
    }

    // Private helper methods
    private async startAgent(agentId: string): Promise<void> {
        const agent = this.agents.get(agentId);
        if (agent) {
            agent.status = 'active';
            agent.lastActivity = new Date();
            console.log(`🤖 Started agent: ${agent.name}`);
        }
    }

    private async stopAgent(agentId: string): Promise<void> {
        const agent = this.agents.get(agentId);
        if (agent) {
            agent.status = 'offline';
            agent.tasks = [];
            console.log(`⏹️ Stopped agent: ${agent.name}`);
        }
    }

    private async findBestAgent(task: Task): Promise<AgentStatus | null> {
        const taskTypeMap: Record<string, string> = {
            'content:generate': 'content-generator',
            'campaign:optimize': 'campaign-optimizer',
            'analytics:analyze': 'analytics-engine',
            'social:schedule': 'social-scheduler',
            'audience:analyze': 'audience-intelligence',
            'compliance:check': 'compliance-monitor',
            'trend:analyze': 'trend-predictor',
            'platform:optimize': 'platform-specialist'
        };

        const preferredAgentId = taskTypeMap[task.type];
        if (preferredAgentId) {
            const agent = this.agents.get(preferredAgentId);
            if (agent && agent.status === 'active') {
                return agent;
            }
        }

        // Fallback to any available agent
        for (const agent of this.agents.values()) {
            if (agent.status === 'active' && agent.tasks.length < 5) {
                return agent;
            }
        }

        return null;
    }

    private startTaskProcessing(): void {
        setInterval(() => {
            if (!this.isActive) return;

            // Process pending tasks
            for (const [taskId, task] of this.tasks) {
                if (task.status === 'pending') {
                    this.processTask(taskId);
                }
            }
        }, 5000); // Check every 5 seconds
    }

    private async processTask(taskId: string): Promise<void> {
        const task = this.tasks.get(taskId);
        if (!task) return;

        task.status = 'in_progress';
        task.updatedAt = new Date();

        try {
            // Simulate task processing
            await new Promise(resolve => setTimeout(resolve, Math.random() * 10000 + 5000));
            
            task.status = 'completed';
            task.updatedAt = new Date();
            
            this.emit('task:completed', task);
            console.log(`✅ Task ${taskId} completed`);
        } catch (error) {
            task.status = 'failed';
            task.updatedAt = new Date();
            
            this.emit('task:failed', task);
            console.error(`❌ Task ${taskId} failed:`, error);
        }
    }

    private startHealthMonitoring(): void {
        setInterval(() => {
            this.updateSystemHealth();
        }, 30000); // Check every 30 seconds
    }

    private updateSystemHealth(): void {
        const agents = Array.from(this.agents.values());
        const healthyAgents = agents.filter(a => a.status === 'active' && a.health > 50);
        
        this.systemHealth = Math.round((healthyAgents.length / agents.length) * 100);
        
        if (this.systemHealth < 70) {
            console.warn(`⚠️ System health low: ${this.systemHealth}%`);
            this.emit('system:health:low', this.systemHealth);
        }
    }

    private getRequiredPermission(requestType: string): string | null {
        const permissionMap: Record<string, string> = {
            'content:generate:advanced': 'ai:advanced_features',
            'campaign:create:multiple': 'campaign:create:multiple',
            'analytics:enterprise': 'analytics:view:enterprise',
            'api:access': 'api:full_access'
        };

        return permissionMap[requestType] || null;
    }

    private getRequiredTier(permission: string): string {
        if (permission.includes('enterprise') || permission.includes('api:full_access')) {
            return 'enterprise';
        }
        if (permission.includes('advanced') || permission.includes('multiple')) {
            return 'pro';
        }
        return 'basic';
    }

    private getPriorityForUser(tier: 'basic' | 'pro' | 'enterprise'): 'low' | 'medium' | 'high' | 'critical' {
        const priorityMap = {
            basic: 'low' as const,
            pro: 'medium' as const,
            enterprise: 'high' as const
        };
        return priorityMap[tier];
    }

    private getEstimatedCompletion(task: Task): Date {
        const baseTime = 60000; // 1 minute base
        const priorityMultiplier = {
            low: 3,
            medium: 2,
            high: 1.5,
            critical: 1
        };

        const estimatedMs = baseTime * priorityMultiplier[task.priority];
        return new Date(Date.now() + estimatedMs);
    }
}

// Singleton instance
export const masterOrchestrator = new MasterOrchestrator();