// Schedule Calendar Functionality

let currentDate = new Date();
let selectedDate = null;
let scheduledPosts = [];

// Initialize calendar
function initializeCalendar() {
    // Set today's date in quick schedule
    const today = new Date();
    document.getElementById('quickDate').value = today.toISOString().split('T')[0];
    
    // Setup event listeners
    setupEventListeners();
    
    // Load scheduled posts
    loadScheduledPosts();
    
    // Render calendar
    renderCalendar();
}

// Setup event listeners
function setupEventListeners() {
    // View selector
    document.querySelectorAll('.view-option').forEach(option => {
        option.addEventListener('click', (e) => {
            document.querySelectorAll('.view-option').forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            const view = option.dataset.view;
            changeCalendarView(view);
        });
    });
    
    // Time slots
    document.querySelectorAll('.time-slot').forEach(slot => {
        slot.addEventListener('click', () => {
            document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('active'));
            slot.classList.add('active');
        });
    });
    
    // Schedule form
    document.getElementById('scheduleForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitSchedule();
    });
}

// Render calendar
function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Update month title
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    // Clear calendar
    const calendarDays = document.getElementById('calendarDays');
    calendarDays.innerHTML = '';
    
    // Add previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
        const day = createDayElement(daysInPrevMonth - i, true, new Date(year, month - 1, daysInPrevMonth - i));
        calendarDays.appendChild(day);
    }
    
    // Add current month days
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const isToday = date.toDateString() === today.toDateString();
        const dayElement = createDayElement(day, false, date, isToday);
        calendarDays.appendChild(dayElement);
    }
    
    // Add next month days to fill grid
    const totalCells = calendarDays.children.length;
    const remainingCells = 42 - totalCells; // 6 weeks * 7 days
    for (let day = 1; day <= remainingCells; day++) {
        const dayElement = createDayElement(day, true, new Date(year, month + 1, day));
        calendarDays.appendChild(dayElement);
    }
    
    // Add scheduled posts to calendar
    addScheduledPostsToCalendar();
}

// Create day element
function createDayElement(day, isOtherMonth, date, isToday = false) {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'calendar-day';
    
    if (isOtherMonth) {
        dayDiv.classList.add('other-month');
    }
    
    if (isToday) {
        dayDiv.classList.add('today');
    }
    
    // Check if this date is selected
    if (selectedDate && date.toDateString() === selectedDate.toDateString()) {
        dayDiv.classList.add('selected');
    }
    
    dayDiv.onclick = () => selectDate(date);
    
    const dayNumber = document.createElement('div');
    dayNumber.className = 'day-number';
    dayNumber.textContent = day;
    dayDiv.appendChild(dayNumber);
    
    const postsContainer = document.createElement('div');
    postsContainer.className = 'day-posts';
    postsContainer.id = `posts-${date.toISOString().split('T')[0]}`;
    dayDiv.appendChild(postsContainer);
    
    return dayDiv;
}

// Add scheduled posts to calendar
function addScheduledPostsToCalendar() {
    scheduledPosts.forEach(post => {
        const postDate = new Date(post.scheduledAt);
        const dateKey = postDate.toISOString().split('T')[0];
        const postsContainer = document.getElementById(`posts-${dateKey}`);
        
        if (postsContainer) {
            const postIndicator = document.createElement('div');
            postIndicator.className = `post-indicator ${post.platform}`;
            
            const time = postDate.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
            });
            
            postIndicator.innerHTML = `
                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="10"/>
                </svg>
                <span>${time}</span>
            `;
            
            postIndicator.onclick = (e) => {
                e.stopPropagation();
                viewPost(post);
            };
            
            postsContainer.appendChild(postIndicator);
        }
    });
}

// Select date
function selectDate(date) {
    selectedDate = date;
    document.getElementById('quickDate').value = date.toISOString().split('T')[0];
    renderCalendar();
}

// Previous month
function previousMonth() {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
}

// Next month
function nextMonth() {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
}

// Go to today
function goToToday() {
    currentDate = new Date();
    selectedDate = new Date();
    renderCalendar();
}

// Change calendar view
function changeCalendarView(view) {
    // This would implement week and day views
    console.log('Changing to view:', view);
}

// Open schedule modal
function openScheduleModal() {
    const modal = document.getElementById('scheduleModal');
    modal.style.display = 'flex';
    
    // Set default date and time
    const now = new Date();
    const date = selectedDate || now;
    document.getElementById('scheduleDate').value = date.toISOString().split('T')[0];
    
    // Set time to next hour
    now.setHours(now.getHours() + 1, 0, 0, 0);
    document.getElementById('scheduleTime').value = now.toTimeString().slice(0, 5);
}

// Close schedule modal
function closeScheduleModal() {
    const modal = document.getElementById('scheduleModal');
    modal.style.display = 'none';
    document.getElementById('scheduleForm').reset();
}

// Quick schedule post
function quickSchedulePost() {
    const date = document.getElementById('quickDate').value;
    const timeSlot = document.querySelector('.time-slot.active');
    
    if (!date || !timeSlot) {
        alert('Please select a date and time');
        return;
    }
    
    // Open modal with pre-filled date and time
    openScheduleModal();
    document.getElementById('scheduleDate').value = date;
    document.getElementById('scheduleTime').value = timeSlot.dataset.time;
}

// Submit schedule
async function submitSchedule() {
    const content = document.getElementById('scheduleContent').value;
    const date = document.getElementById('scheduleDate').value;
    const time = document.getElementById('scheduleTime').value;
    const platforms = Array.from(document.querySelectorAll('.checkbox-input:checked')).map(cb => cb.value);
    const repeat = document.getElementById('scheduleRepeat').value;
    
    if (!content || !date || !time || platforms.length === 0) {
        alert('Please fill in all fields and select at least one platform');
        return;
    }
    
    const scheduledAt = new Date(`${date}T${time}`);
    
    try {
        // Create scheduled posts for each platform
        for (const platform of platforms) {
            const response = await synthexAPI.schedulePost({
                content,
                platform,
                scheduledAt: scheduledAt.toISOString(),
                repeat,
                status: 'scheduled'
            });
            
            if (response && response.data) {
                scheduledPosts.push(response.data);
            }
        }
        
        // Close modal and refresh
        closeScheduleModal();
        loadScheduledPosts();
        renderCalendar();
        showNotification('Content scheduled successfully!', 'success');
        
    } catch (error) {
        console.error('Schedule error:', error);
        showNotification('Failed to schedule content', 'error');
    }
}

// Load scheduled posts
async function loadScheduledPosts() {
    try {
        const response = await synthexAPI.getScheduledPosts();
        
        if (response && response.data) {
            scheduledPosts = response.data;
            updateUpcomingPosts();
            renderCalendar();
        } else {
            // Use sample data if API fails
            useSampleScheduledPosts();
        }
    } catch (error) {
        console.error('Error loading scheduled posts:', error);
        useSampleScheduledPosts();
    }
}

// Update upcoming posts sidebar
function updateUpcomingPosts() {
    const container = document.getElementById('upcomingPosts');
    const upcoming = scheduledPosts
        .filter(post => new Date(post.scheduledAt) >= new Date())
        .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
        .slice(0, 5);
    
    container.innerHTML = upcoming.map(post => {
        const date = new Date(post.scheduledAt);
        const isToday = date.toDateString() === new Date().toDateString();
        const isTomorrow = date.toDateString() === new Date(Date.now() + 86400000).toDateString();
        
        let timeStr = '';
        if (isToday) {
            timeStr = 'Today';
        } else if (isTomorrow) {
            timeStr = 'Tomorrow';
        } else {
            timeStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        
        timeStr += ', ' + date.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
        
        return `
            <div class="scheduled-post" onclick="viewPost('${post.id}')">
                <div class="post-time">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <span>${timeStr}</span>
                </div>
                <div class="post-content-preview">${escapeHtml(post.content)}</div>
                <div class="post-platforms">
                    ${post.platforms ? post.platforms.map(p => 
                        `<span class="platform-badge ${p}">${p.charAt(0).toUpperCase() + p.slice(1)}</span>`
                    ).join('') : `<span class="platform-badge ${post.platform}">${post.platform.charAt(0).toUpperCase() + post.platform.slice(1)}</span>`}
                </div>
            </div>
        `;
    }).join('');
}

// View post
function viewPost(postId) {
    const post = typeof postId === 'string' ? 
        scheduledPosts.find(p => p.id === postId) : postId;
    
    if (post) {
        // This would open a modal to view/edit the post
        console.log('Viewing post:', post);
    }
}

// Bulk schedule
function bulkSchedule() {
    alert('Bulk scheduling feature coming soon!');
}

// Use sample scheduled posts
function useSampleScheduledPosts() {
    const now = new Date();
    const platforms = ['instagram', 'facebook', 'twitter', 'linkedin'];
    const sampleContent = [
        'Excited to share our latest product updates! Check out what\'s new.',
        'Join us for a live Q&A session this Friday at 3 PM EST.',
        'Behind the scenes: How we design our eco-friendly packaging.',
        'Customer spotlight: Read how Sarah transformed her business with our tools.',
        'Weekly tip: 5 ways to boost your social media engagement.'
    ];
    
    scheduledPosts = [];
    
    // Generate sample posts for the next 30 days
    for (let i = 0; i < 20; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() + Math.floor(Math.random() * 30));
        date.setHours(9 + Math.floor(Math.random() * 10), 0, 0, 0);
        
        scheduledPosts.push({
            id: `sample-${i}`,
            content: sampleContent[i % sampleContent.length],
            platform: platforms[Math.floor(Math.random() * platforms.length)],
            scheduledAt: date.toISOString(),
            status: 'scheduled'
        });
    }
    
    updateUpcomingPosts();
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? 'var(--accent-green)' : 'var(--error)'};
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 1000;
        animation: slideIn 0.3s ease;
        display: flex;
        align-items: center;
        gap: 12px;
    `;
    
    const icon = type === 'success' ? 
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>' :
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    
    notification.innerHTML = icon + '<span>' + message + '</span>';
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Add animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCalendar);
} else {
    initializeCalendar();
}