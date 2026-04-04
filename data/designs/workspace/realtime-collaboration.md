# Real-Time Collaboration System

## 1. Live Cursor & Presence System

### User Presence Architecture
```javascript
class PresenceManager {
  constructor() {
    this.users = new Map();
    this.localUser = null;
    this.colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57'];
  }

  initializeUser(userData) {
    this.localUser = {
      id: userData.id,
      name: userData.name,
      avatar: userData.avatar,
      color: this.assignColor(),
      cursor: { x: 0, y: 0 },
      selection: [],
      status: 'active',
      lastSeen: Date.now()
    };
    
    this.broadcast('user:join', this.localUser);
    this.startHeartbeat();
  }

  updateCursor(x, y) {
    this.localUser.cursor = { x, y };
    this.throttledBroadcast('cursor:move', {
      userId: this.localUser.id,
      cursor: { x, y },
      timestamp: Date.now()
    });
  }

  renderRemoteCursor(user) {
    return `
      <div class="remote-cursor" 
           style="left: ${user.cursor.x}px; 
                  top: ${user.cursor.y}px;
                  color: ${user.color}">
        <svg class="cursor-icon">
          <path d="M0,0 L0,20 L7,17 L10,25 L13,23 L10,15 L20,15 Z"/>
        </svg>
        <span class="cursor-label">${user.name}</span>
      </div>
    `;
  }
}
```

### Cursor Visualization
```css
.remote-cursor {
  position: absolute;
  pointer-events: none;
  z-index: 10000;
  transition: all 50ms linear;
}

.cursor-icon {
  width: 20px;
  height: 25px;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
}

.cursor-label {
  position: absolute;
  top: 25px;
  left: 10px;
  padding: 2px 8px;
  background: currentColor;
  color: white;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid currentColor;
}
```

### Active Users Display
```
┌──────────────────────────────┐
│ Active Users (4)             │
├──────────────────────────────┤
│ ● John (editing)             │
│ ● Sarah (viewing)            │
│ ● Mike (commenting)          │
│ ● Emma (selecting)           │
└──────────────────────────────┘
```

## 2. Comment & Annotation System

### Comment Thread Architecture
```javascript
class CommentSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.threads = new Map();
    this.activeThread = null;
  }

  createComment(x, y, text, author) {
    const comment = {
      id: this.generateId(),
      position: { x, y },
      text: text,
      author: author,
      timestamp: Date.now(),
      replies: [],
      resolved: false,
      mentions: this.extractMentions(text)
    };
    
    const thread = {
      id: comment.id,
      anchor: { x, y },
      comments: [comment],
      participants: [author],
      status: 'open'
    };
    
    this.threads.set(thread.id, thread);
    this.renderCommentPin(thread);
    this.notifyMentions(comment.mentions);
    
    return thread;
  }

  renderCommentThread(thread) {
    return `
      <div class="comment-thread" data-thread-id="${thread.id}">
        <div class="comment-anchor" 
             style="left: ${thread.anchor.x}px; top: ${thread.anchor.y}px">
          <span class="comment-number">${thread.comments.length}</span>
        </div>
        <div class="comment-panel">
          ${thread.comments.map(c => this.renderComment(c)).join('')}
          <div class="comment-input">
            <textarea placeholder="Reply..."></textarea>
            <button>Send</button>
          </div>
        </div>
      </div>
    `;
  }

  renderComment(comment) {
    return `
      <div class="comment" data-comment-id="${comment.id}">
        <div class="comment-header">
          <img src="${comment.author.avatar}" class="comment-avatar">
          <span class="comment-author">${comment.author.name}</span>
          <span class="comment-time">${this.formatTime(comment.timestamp)}</span>
        </div>
        <div class="comment-body">${this.processText(comment.text)}</div>
        <div class="comment-actions">
          <button class="reply">Reply</button>
          <button class="resolve">Resolve</button>
          <button class="edit">Edit</button>
        </div>
      </div>
    `;
  }
}
```

### Annotation Tools
```javascript
const annotationTools = {
  highlight: {
    icon: '🖍️',
    action: 'highlight',
    colors: ['yellow', 'green', 'blue', 'pink'],
    opacity: 0.3
  },
  
  arrow: {
    icon: '→',
    action: 'draw-arrow',
    styles: ['solid', 'dashed'],
    colors: ['red', 'black', 'blue']
  },
  
  text: {
    icon: 'T',
    action: 'add-text',
    fonts: ['sans-serif', 'serif', 'monospace'],
    sizes: [12, 14, 16, 18, 24]
  },
  
  shape: {
    icon: '□',
    action: 'draw-shape',
    types: ['rectangle', 'circle', 'line'],
    styles: ['solid', 'dashed', 'dotted']
  }
};
```

## 3. Version History & Branching

### Version Control System
```javascript
class VersionControl {
  constructor() {
    this.versions = [];
    this.currentVersion = null;
    this.branches = new Map();
  }

  createSnapshot(name, author) {
    const snapshot = {
      id: this.generateId(),
      name: name || `Version ${this.versions.length + 1}`,
      author: author,
      timestamp: Date.now(),
      data: this.serializeCanvas(),
      thumbnail: this.generateThumbnail(),
      size: this.calculateSize(),
      changes: this.detectChanges()
    };
    
    this.versions.push(snapshot);
    this.currentVersion = snapshot.id;
    
    return snapshot;
  }

  createBranch(name, fromVersion) {
    const branch = {
      id: this.generateId(),
      name: name,
      parent: fromVersion || this.currentVersion,
      created: Date.now(),
      versions: [],
      author: this.currentUser
    };
    
    this.branches.set(branch.id, branch);
    return branch;
  }

  renderVersionHistory() {
    return `
      <div class="version-history">
        <div class="version-timeline">
          ${this.versions.map(v => `
            <div class="version-node ${v.id === this.currentVersion ? 'current' : ''}">
              <div class="version-thumbnail">
                <img src="${v.thumbnail}" alt="${v.name}">
              </div>
              <div class="version-info">
                <h4>${v.name}</h4>
                <p>${v.author.name} • ${this.formatDate(v.timestamp)}</p>
                <p>${v.changes.length} changes</p>
              </div>
              <div class="version-actions">
                <button onclick="restore('${v.id}')">Restore</button>
                <button onclick="branch('${v.id}')">Branch</button>
                <button onclick="compare('${v.id}')">Compare</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
}
```

### Version Comparison View
```
┌────────────────────────────────────────┐
│         Version Comparison             │
├────────────────┬───────────────────────┤
│  Version 1.2   │   Version 1.3 (Current)│
├────────────────┼───────────────────────┤
│                │  + Added persona       │
│  Hook text A   │  ~ Hook text A'       │
│                │  + New storyboard     │
│  - Deleted item│                       │
└────────────────┴───────────────────────┘
```

## 4. Conflict Resolution Interface

### Conflict Detection
```javascript
class ConflictResolver {
  detectConflicts(localChanges, remoteChanges) {
    const conflicts = [];
    
    for (let local of localChanges) {
      for (let remote of remoteChanges) {
        if (this.isConflict(local, remote)) {
          conflicts.push({
            type: this.getConflictType(local, remote),
            local: local,
            remote: remote,
            element: local.elementId
          });
        }
      }
    }
    
    return conflicts;
  }

  renderConflictDialog(conflict) {
    return `
      <div class="conflict-dialog">
        <h3>Merge Conflict Detected</h3>
        <p>${conflict.type} on ${conflict.element}</p>
        
        <div class="conflict-options">
          <div class="option local">
            <h4>Your Changes</h4>
            <div class="preview">${this.renderPreview(conflict.local)}</div>
            <button onclick="chooseLocal()">Keep Mine</button>
          </div>
          
          <div class="option remote">
            <h4>Their Changes</h4>
            <div class="preview">${this.renderPreview(conflict.remote)}</div>
            <button onclick="chooseRemote()">Keep Theirs</button>
          </div>
          
          <div class="option merge">
            <h4>Merge Both</h4>
            <div class="preview">${this.renderMerged(conflict)}</div>
            <button onclick="chooseMerge()">Merge</button>
          </div>
        </div>
      </div>
    `;
  }

  autoResolve(conflicts) {
    const resolved = [];
    
    for (let conflict of conflicts) {
      if (conflict.type === 'position') {
        // Auto-resolve position conflicts by spacing
        resolved.push(this.resolvePosition(conflict));
      } else if (conflict.type === 'style') {
        // Merge non-conflicting style properties
        resolved.push(this.mergeStyles(conflict));
      } else {
        // Require manual resolution
        resolved.push(null);
      }
    }
    
    return resolved;
  }
}
```

## 5. Real-Time Synchronization

### WebSocket Communication
```javascript
class RealtimeSync {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.messageQueue = [];
    this.syncState = 'connecting';
    this.lastSync = null;
    
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.ws.onopen = () => {
      this.syncState = 'connected';
      this.flushQueue();
      this.requestFullSync();
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onclose = () => {
      this.syncState = 'disconnected';
      this.attemptReconnect();
    };
  }

  broadcast(type, data) {
    const message = {
      type: type,
      data: data,
      timestamp: Date.now(),
      userId: this.userId,
      version: this.version
    };

    if (this.syncState === 'connected') {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
    }
  }

  handleMessage(message) {
    switch(message.type) {
      case 'cursor:move':
        this.updateRemoteCursor(message.data);
        break;
      case 'element:create':
        this.createElement(message.data);
        break;
      case 'element:update':
        this.updateElement(message.data);
        break;
      case 'element:delete':
        this.deleteElement(message.data);
        break;
      case 'comment:add':
        this.addComment(message.data);
        break;
      case 'user:join':
        this.addUser(message.data);
        break;
      case 'user:leave':
        this.removeUser(message.data);
        break;
      case 'sync:full':
        this.performFullSync(message.data);
        break;
    }
  }
}
```

### Optimistic Updates
```javascript
const optimisticUpdate = {
  apply(action) {
    // Apply change immediately
    const result = this.executeAction(action);
    
    // Mark as pending
    action.status = 'pending';
    action.localId = this.generateLocalId();
    
    // Send to server
    this.sendToServer(action).then(response => {
      action.status = 'confirmed';
      action.serverId = response.id;
    }).catch(error => {
      // Rollback on error
      this.rollback(action);
      action.status = 'failed';
      this.notifyError(error);
    });
    
    return result;
  },
  
  rollback(action) {
    const inverse = this.getInverseAction(action);
    this.executeAction(inverse);
  }
};
```

## 6. Collaboration Permissions

### Permission Levels
```javascript
const permissions = {
  viewer: {
    canView: true,
    canComment: true,
    canEdit: false,
    canDelete: false,
    canInvite: false
  },
  
  commenter: {
    canView: true,
    canComment: true,
    canAnnotate: true,
    canEdit: false,
    canDelete: false,
    canInvite: false
  },
  
  editor: {
    canView: true,
    canComment: true,
    canAnnotate: true,
    canEdit: true,
    canDelete: true,
    canInvite: true,
    canVersion: true
  },
  
  owner: {
    canView: true,
    canComment: true,
    canAnnotate: true,
    canEdit: true,
    canDelete: true,
    canInvite: true,
    canVersion: true,
    canManagePermissions: true,
    canTransferOwnership: true
  }
};
```

### Permission UI
```
┌──────────────────────────────────┐
│ Share & Permissions              │
├──────────────────────────────────┤
│ 🔗 Share Link: [Copy]            │
├──────────────────────────────────┤
│ Users with Access:               │
│                                  │
│ 👤 John Doe (Owner)             │
│ 👤 Sarah Smith     [Editor ▼]   │
│ 👤 Mike Johnson    [Viewer ▼]   │
│                                  │
│ [+ Invite People]                │
└──────────────────────────────────┘
```

## 7. Activity Feed

### Activity Tracking
```javascript
class ActivityFeed {
  constructor() {
    this.activities = [];
    this.filters = new Set(['all']);
  }

  logActivity(type, data) {
    const activity = {
      id: this.generateId(),
      type: type,
      user: data.user,
      timestamp: Date.now(),
      details: data.details,
      element: data.element,
      icon: this.getIcon(type)
    };
    
    this.activities.unshift(activity);
    this.broadcast('activity:new', activity);
    this.updateUI();
  }

  renderActivityFeed() {
    return `
      <div class="activity-feed">
        <div class="activity-filters">
          <button class="filter-all active">All</button>
          <button class="filter-edits">Edits</button>
          <button class="filter-comments">Comments</button>
          <button class="filter-versions">Versions</button>
        </div>
        <div class="activity-list">
          ${this.activities
            .filter(a => this.matchesFilter(a))
            .map(a => this.renderActivity(a))
            .join('')}
        </div>
      </div>
    `;
  }

  renderActivity(activity) {
    return `
      <div class="activity-item">
        <img src="${activity.user.avatar}" class="activity-avatar">
        <div class="activity-content">
          <p>
            <strong>${activity.user.name}</strong>
            ${this.getActivityText(activity)}
          </p>
          <span class="activity-time">${this.formatTime(activity.timestamp)}</span>
        </div>
        <span class="activity-icon">${activity.icon}</span>
      </div>
    `;
  }
}
```

## 8. Notification System

### Real-Time Notifications
```javascript
const notificationSystem = {
  types: {
    mention: {
      icon: '@',
      priority: 'high',
      sound: true
    },
    comment: {
      icon: '💬',
      priority: 'medium',
      sound: false
    },
    edit: {
      icon: '✏️',
      priority: 'low',
      sound: false
    },
    version: {
      icon: '📌',
      priority: 'medium',
      sound: false
    }
  },
  
  notify(type, message, data) {
    const notification = {
      id: this.generateId(),
      type: type,
      message: message,
      data: data,
      timestamp: Date.now(),
      read: false
    };
    
    // Show in-app notification
    this.showToast(notification);
    
    // Browser notification if permitted
    if (this.hasPermission()) {
      this.showBrowserNotification(notification);
    }
    
    // Play sound if configured
    if (this.types[type].sound) {
      this.playSound();
    }
    
    return notification;
  }
};
```

## 9. Collaboration Metrics

### Analytics Dashboard
```javascript
const collaborationMetrics = {
  track() {
    return {
      activeUsers: this.getActiveUserCount(),
      totalEdits: this.getEditCount(),
      comments: this.getCommentCount(),
      versions: this.getVersionCount(),
      avgSessionTime: this.getAverageSessionTime(),
      peakConcurrentUsers: this.getPeakUsers(),
      mostActiveUser: this.getMostActiveUser(),
      popularElements: this.getPopularElements()
    };
  },
  
  renderDashboard() {
    const metrics = this.track();
    return `
      <div class="collab-metrics">
        <div class="metric-card">
          <h4>Active Now</h4>
          <p class="metric-value">${metrics.activeUsers}</p>
        </div>
        <div class="metric-card">
          <h4>Total Edits</h4>
          <p class="metric-value">${metrics.totalEdits}</p>
        </div>
        <div class="metric-card">
          <h4>Comments</h4>
          <p class="metric-value">${metrics.comments}</p>
        </div>
        <div class="metric-card">
          <h4>Versions</h4>
          <p class="metric-value">${metrics.versions}</p>
        </div>
      </div>
    `;
  }
};
```

## Implementation Checklist

### Core Features
- [ ] Live cursor tracking
- [ ] User presence indicators
- [ ] Comment system
- [ ] Annotation tools
- [ ] Version history

### Advanced Features
- [ ] Branching support
- [ ] Conflict resolution
- [ ] Permission management
- [ ] Activity feed
- [ ] Notifications

### Real-Time Sync
- [ ] WebSocket connection
- [ ] Optimistic updates
- [ ] Offline support
- [ ] Reconnection logic
- [ ] Data consistency

### Performance
- [ ] Message throttling
- [ ] Efficient diffing
- [ ] Lazy loading
- [ ] Compression
- [ ] Caching strategy