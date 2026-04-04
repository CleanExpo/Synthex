// Analytics Dashboard Functionality

// Chart instances
let engagementChart, platformChart;
let currentRange = 'week';
let refreshInterval;

// Initialize analytics dashboard
function initializeAnalytics() {
    // Setup charts
    setupCharts();
    
    // Load initial data
    loadAnalyticsData(currentRange);
    
    // Setup event listeners
    setupEventListeners();
    
    // Auto-refresh every 30 seconds
    refreshInterval = setInterval(() => {
        loadAnalyticsData(currentRange);
    }, 30000);
}

// Setup charts
function setupCharts() {
    Chart.defaults.color = '#a0a0a0';
    Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';
    Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Inter", sans-serif';
    
    // Engagement Chart
    const engagementCtx = document.getElementById('engagementChart').getContext('2d');
    engagementChart = new Chart(engagementCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Engagement Rate',
                data: [],
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                pointBackgroundColor: '#6366f1',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#a0a0a0',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return `Engagement: ${context.parsed.y}%`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#6b7280'
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#6b7280',
                        callback: function(value) {
                            return value + '%';
                        }
                    },
                    beginAtZero: true
                }
            }
        }
    });
    
    // Platform Chart (Doughnut)
    const platformCtx = document.getElementById('platformChart');
    if (platformCtx) {
        platformChart = new Chart(platformCtx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Instagram', 'Facebook', 'Twitter', 'LinkedIn', 'TikTok'],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#E4405F',
                        '#1877F2',
                        '#1DA1F2',
                        '#0077B5',
                        '#000000'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 16,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = formatNumber(context.parsed);
                                const percentage = ((context.parsed / context.dataset.data.reduce((a, b) => a + b, 0)) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
}

// Load analytics data
async function loadAnalyticsData(range = 'week') {
    try {
        // Show loading state
        showLoadingState();
        
        // Fetch data from API
        const response = await synthexAPI.getAnalyticsOverview(range);
        
        if (response && response.data) {
            updateDashboard(response.data);
        } else {
            // Use sample data if API fails
            useSampleData();
        }
    } catch (error) {
        console.error('Analytics loading error:', error);
        useSampleData();
    }
}

// Update dashboard with data
function updateDashboard(data) {
    // Update metric cards
    updateMetricCards(data);
    
    // Update charts
    updateChartData(data);
    
    // Update platform breakdown
    updatePlatformBreakdown(data);
    
    // Update top content
    updateTopContent(data);
    
    // Hide loading state
    hideLoadingState();
}

// Update metric cards
function updateMetricCards(data) {
    // Total Reach
    const totalReach = data.totalReach || 0;
    animateValue(document.getElementById('totalReach'), 0, totalReach, 2000);
    
    // Engagement Rate
    const engagementRate = data.engagement || 0;
    animateValue(document.getElementById('engagementRate'), 0, engagementRate, 2000, true);
    
    // Click Rate
    const clickRate = data.clickRate || 0;
    animateValue(document.getElementById('clickRate'), 0, clickRate, 2000, true);
    
    // Total Posts
    const totalPosts = data.totalPosts || 0;
    animateValue(document.getElementById('totalPosts'), 0, totalPosts, 2000);
}

// Update chart data
function updateChartData(data) {
    // Generate labels based on range
    const labels = generateDateLabels(currentRange);
    
    // Update engagement chart
    if (engagementChart) {
        const engagementData = data.engagementHistory || generateRandomData(labels.length, 5, 12);
        engagementChart.data.labels = labels;
        engagementChart.data.datasets[0].data = engagementData;
        engagementChart.update('none');
    }
    
    // Update platform chart
    if (platformChart && data.platformBreakdown) {
        const platforms = Object.keys(data.platformBreakdown);
        const values = Object.values(data.platformBreakdown);
        platformChart.data.labels = platforms;
        platformChart.data.datasets[0].data = values;
        platformChart.update('none');
    }
}

// Update platform breakdown
function updatePlatformBreakdown(data) {
    const breakdown = data.platformBreakdown || {
        Instagram: 45200,
        Facebook: 32800,
        Twitter: 28100,
        LinkedIn: 15400,
        TikTok: 8500
    };
    
    Object.entries(breakdown).forEach(([platform, value]) => {
        const element = document.querySelector(`[data-platform="${platform.toLowerCase()}"]`);
        if (element) {
            const valueElement = element.querySelector('.platform-value');
            if (valueElement) {
                valueElement.textContent = formatNumber(value);
            }
        }
    });
}

// Update top content
function updateTopContent(data) {
    const topContent = data.topContent || generateSampleContent();
    const container = document.getElementById('topContent');
    
    if (!container) return;
    
    container.innerHTML = topContent.map((content, index) => `
        <div class="content-item">
            <div class="content-rank">${index + 1}</div>
            <div class="content-info">
                <div class="content-title">${content.title}</div>
                <div class="content-meta">
                    <span>${content.platform}</span>
                    <span>•</span>
                    <span>${content.date}</span>
                </div>
            </div>
            <div class="content-stats">
                <div class="stat">
                    <span class="stat-value">${formatNumber(content.reach)}</span>
                    <span class="stat-label">Reach</span>
                </div>
                <div class="stat">
                    <span class="stat-value">${content.engagement}%</span>
                    <span class="stat-label">Engagement</span>
                </div>
            </div>
        </div>
    `).join('');
}

// Setup event listeners
function setupEventListeners() {
    // Range selector
    document.querySelectorAll('[data-range]').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const range = button.dataset.range;
            
            // Update active state
            document.querySelectorAll('[data-range]').forEach(b => b.classList.remove('active'));
            button.classList.add('active');
            
            // Load new data
            currentRange = range;
            loadAnalyticsData(range);
        });
    });
    
    // Chart metric tabs
    document.querySelectorAll('.chart-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const metric = tab.dataset.metric;
            updateChartMetric(metric);
        });
    });
}

// Update chart based on selected metric
function updateChartMetric(metric) {
    const labels = generateDateLabels(currentRange);
    let data, label, color;
    
    switch(metric) {
        case 'engagement':
            data = generateRandomData(labels.length, 5, 12);
            label = 'Engagement Rate';
            color = '#6366f1';
            break;
        case 'reach':
            data = generateRandomData(labels.length, 80000, 150000);
            label = 'Reach';
            color = '#10b981';
            break;
        case 'clicks':
            data = generateRandomData(labels.length, 2, 5);
            label = 'Click Rate';
            color = '#f59e0b';
            break;
    }
    
    engagementChart.data.datasets[0].label = label;
    engagementChart.data.datasets[0].data = data;
    engagementChart.data.datasets[0].borderColor = color;
    engagementChart.data.datasets[0].backgroundColor = color + '20';
    engagementChart.data.datasets[0].pointBackgroundColor = color;
    engagementChart.update();
}

// Helper functions
function generateDateLabels(range) {
    const labels = [];
    let days = 7;
    
    switch(range) {
        case 'today':
            days = 1;
            break;
        case 'week':
            days = 7;
            break;
        case 'month':
            days = 30;
            break;
        case 'year':
            days = 12; // months
            break;
    }
    
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        
        if (range === 'year') {
            date.setMonth(date.getMonth() - i);
            labels.push(date.toLocaleDateString('en-US', { month: 'short' }));
        } else {
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        }
    }
    
    return labels;
}

function generateRandomData(length, min, max) {
    return Array.from({ length }, () => Math.random() * (max - min) + min);
}

function generateSampleContent() {
    const platforms = ['Instagram', 'Twitter', 'LinkedIn', 'Facebook'];
    const titles = [
        'New Product Launch Announcement',
        'Behind the Scenes: Team Culture',
        'Customer Success Story',
        'Industry Insights: Future Trends',
        'Holiday Season Campaign'
    ];
    
    return titles.map((title, index) => ({
        title,
        platform: platforms[index % platforms.length],
        date: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        reach: Math.floor(Math.random() * 50000) + 10000,
        engagement: (Math.random() * 10 + 5).toFixed(1)
    }));
}

function animateValue(element, start, end, duration, isPercentage = false) {
    if (!element) return;
    
    const range = end - start;
    const increment = end > start ? 1 : -1;
    const stepTime = Math.abs(Math.floor(duration / range));
    let current = start;
    
    const timer = setInterval(() => {
        current += increment * Math.max(1, Math.ceil(Math.abs(range) / 100));
        
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
            current = end;
            clearInterval(timer);
        }
        
        if (isPercentage) {
            element.textContent = current.toFixed(1) + '%';
        } else {
            element.textContent = formatNumber(current);
        }
    }, stepTime);
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return Math.round(num).toString();
}

function showLoadingState() {
    // Add loading indicators to cards
    document.querySelectorAll('.metric-value').forEach(el => {
        el.style.opacity = '0.5';
    });
}

function hideLoadingState() {
    // Remove loading indicators
    document.querySelectorAll('.metric-value').forEach(el => {
        el.style.opacity = '1';
    });
}

function useSampleData() {
    const sampleData = {
        totalReach: 125000,
        engagement: 8.4,
        clickRate: 3.2,
        totalPosts: 248,
        engagementHistory: [6.2, 7.1, 7.8, 7.5, 8.2, 8.0, 8.4],
        platformBreakdown: {
            Instagram: 45200,
            Facebook: 32800,
            Twitter: 28100,
            LinkedIn: 15400,
            TikTok: 8500
        },
        topContent: generateSampleContent()
    };
    
    updateDashboard(sampleData);
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAnalytics);
} else {
    initializeAnalytics();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (refreshInterval) clearInterval(refreshInterval);
});