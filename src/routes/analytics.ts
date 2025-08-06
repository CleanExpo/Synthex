import express, { RequestHandler } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import puppeteer from 'puppeteer';
import ExcelJS from 'exceljs';
import * as csvWriter from 'csv-writer';

const router = express.Router();

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

// GET /api/v1/analytics/overview - Get analytics overview
router.get('/overview', requireAuth, (req, res) => {
    try {
        const { range = 'week' } = req.query;
        
        // Sample analytics data based on range
        let data;
        switch (range) {
            case 'day':
                data = {
                    totalReach: 12500,
                    engagement: 850,
                    totalPosts: 5,
                    clickRate: 3.2,
                    impressions: 45000,
                    shares: 120,
                    comments: 340,
                    likes: 890
                };
                break;
            case 'month':
                data = {
                    totalReach: 125000,
                    engagement: 8500,
                    totalPosts: 48,
                    clickRate: 4.1,
                    impressions: 450000,
                    shares: 1200,
                    comments: 3400,
                    likes: 8900
                };
                break;
            default: // week
                data = {
                    totalReach: 45000,
                    engagement: 3200,
                    totalPosts: 12,
                    clickRate: 3.8,
                    impressions: 180000,
                    shares: 450,
                    comments: 1200,
                    likes: 3500
                };
        }
        
        res.json({
            success: true,
            data,
            range
        });
    } catch (error) {
        console.error('Error fetching analytics overview:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch analytics overview'
        });
    }
});

// GET /api/v1/analytics/platforms/:platform - Get platform-specific analytics
router.get('/platforms/:platform', requireAuth, (req, res) => {
    try {
        const { platform } = req.params;
        
        // Sample platform-specific data
        const platformData = {
            instagram: {
                followers: 15240,
                posts: 128,
                avgEngagement: 4.2,
                topPost: 'Summer collection launch',
                reach: 45000,
                impressions: 89000
            },
            facebook: {
                followers: 8950,
                posts: 96,
                avgEngagement: 3.1,
                topPost: 'Customer testimonials',
                reach: 32000,
                impressions: 67000
            },
            twitter: {
                followers: 5670,
                posts: 245,
                avgEngagement: 2.8,
                topPost: 'Industry insights thread',
                reach: 28000,
                impressions: 45000
            },
            linkedin: {
                followers: 3200,
                posts: 64,
                avgEngagement: 5.1,
                topPost: 'Company culture spotlight',
                reach: 18000,
                impressions: 34000
            }
        };
        
        const data = platformData[platform as keyof typeof platformData];
        
        if (!data) {
            return res.status(404).json({
                success: false,
                error: 'Platform not found'
            });
        }
        
        res.json({
            success: true,
            data,
            platform
        });
    } catch (error) {
        console.error('Error fetching platform analytics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch platform analytics'
        });
    }
});

// GET /api/v1/analytics/content-performance - Get content performance analytics
router.get('/content-performance', requireAuth, (req, res) => {
    try {
        const sampleData = [
            {
                id: '1',
                title: 'Summer Collection Launch',
                type: 'image',
                platform: 'instagram',
                publishedAt: '2024-12-05T10:00:00Z',
                metrics: {
                    reach: 8500,
                    engagement: 650,
                    shares: 45,
                    comments: 89,
                    likes: 516
                }
            },
            {
                id: '2',
                title: 'Customer Success Story',
                type: 'video',
                platform: 'facebook',
                publishedAt: '2024-12-04T14:30:00Z',
                metrics: {
                    reach: 6200,
                    engagement: 420,
                    shares: 28,
                    comments: 56,
                    likes: 336
                }
            },
            {
                id: '3',
                title: 'Industry Insights Thread',
                type: 'text',
                platform: 'twitter',
                publishedAt: '2024-12-03T09:15:00Z',
                metrics: {
                    reach: 4800,
                    engagement: 290,
                    shares: 34,
                    comments: 67,
                    likes: 189
                }
            },
            {
                id: '4',
                title: 'Company Culture Spotlight',
                type: 'article',
                platform: 'linkedin',
                publishedAt: '2024-12-02T16:45:00Z',
                metrics: {
                    reach: 3400,
                    engagement: 380,
                    shares: 23,
                    comments: 45,
                    likes: 312
                }
            }
        ];
        
        res.json({
            success: true,
            data: sampleData
        });
    } catch (error) {
        console.error('Error fetching content performance:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch content performance'
        });
    }
});

// Helper function to get analytics data for export
async function getAnalyticsDataForExport(range: string = 'week') {
    const overview = {
        week: {
            totalReach: 45000,
            engagement: 3200,
            totalPosts: 12,
            clickRate: 3.8,
            impressions: 180000,
            shares: 450,
            comments: 1200,
            likes: 3500
        },
        month: {
            totalReach: 125000,
            engagement: 8500,
            totalPosts: 48,
            clickRate: 4.1,
            impressions: 450000,
            shares: 1200,
            comments: 3400,
            likes: 8900
        }
    };

    const contentPerformance = [
        {
            title: 'Summer Collection Launch',
            type: 'image',
            platform: 'instagram',
            publishedAt: '2024-12-05T10:00:00Z',
            reach: 8500,
            engagement: 650,
            shares: 45,
            comments: 89,
            likes: 516
        },
        {
            title: 'Customer Success Story',
            type: 'video',
            platform: 'facebook',
            publishedAt: '2024-12-04T14:30:00Z',
            reach: 6200,
            engagement: 420,
            shares: 28,
            comments: 56,
            likes: 336
        },
        {
            title: 'Industry Insights Thread',
            type: 'text',
            platform: 'twitter',
            publishedAt: '2024-12-03T09:15:00Z',
            reach: 4800,
            engagement: 290,
            shares: 34,
            comments: 67,
            likes: 189
        },
        {
            title: 'Company Culture Spotlight',
            type: 'article',
            platform: 'linkedin',
            publishedAt: '2024-12-02T16:45:00Z',
            reach: 3400,
            engagement: 380,
            shares: 23,
            comments: 45,
            likes: 312
        }
    ];

    const platformData = {
        instagram: {
            followers: 15240,
            posts: 128,
            avgEngagement: 4.2,
            reach: 45000,
            impressions: 89000
        },
        facebook: {
            followers: 8950,
            posts: 96,
            avgEngagement: 3.1,
            reach: 32000,
            impressions: 67000
        },
        twitter: {
            followers: 5670,
            posts: 245,
            avgEngagement: 2.8,
            reach: 28000,
            impressions: 45000
        },
        linkedin: {
            followers: 3200,
            posts: 64,
            avgEngagement: 5.1,
            reach: 18000,
            impressions: 34000
        }
    };

    return {
        overview: overview[range as keyof typeof overview] || overview.week,
        contentPerformance,
        platforms: platformData,
        generatedAt: new Date().toISOString(),
        range
    };
}

// POST /api/v1/analytics/export/csv - Export analytics as CSV
router.post('/export/csv', requireAuth, async (req, res) => {
    try {
        const { range = 'week', type = 'overview' } = req.body;
        const data = await getAnalyticsDataForExport(range);
        
        // Create temporary directory if it doesn't exist
        const tempDir = path.join(__dirname, '..', '..', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const timestamp = Date.now();
        const filename = `analytics-${type}-${range}-${timestamp}.csv`;
        const filepath = path.join(tempDir, filename);
        
        let records: any[] = [];
        let headers: any[] = [];
        
        if (type === 'overview') {
            headers = [
                { id: 'metric', title: 'Metric' },
                { id: 'value', title: 'Value' }
            ];
            
            records = [
                { metric: 'Total Reach', value: data.overview.totalReach },
                { metric: 'Engagement', value: data.overview.engagement },
                { metric: 'Total Posts', value: data.overview.totalPosts },
                { metric: 'Click Rate (%)', value: data.overview.clickRate },
                { metric: 'Impressions', value: data.overview.impressions },
                { metric: 'Shares', value: data.overview.shares },
                { metric: 'Comments', value: data.overview.comments },
                { metric: 'Likes', value: data.overview.likes }
            ];
        } else if (type === 'content') {
            headers = [
                { id: 'title', title: 'Content Title' },
                { id: 'type', title: 'Type' },
                { id: 'platform', title: 'Platform' },
                { id: 'publishedAt', title: 'Published Date' },
                { id: 'reach', title: 'Reach' },
                { id: 'engagement', title: 'Engagement' },
                { id: 'shares', title: 'Shares' },
                { id: 'comments', title: 'Comments' },
                { id: 'likes', title: 'Likes' }
            ];
            
            records = data.contentPerformance.map(item => ({
                ...item,
                publishedAt: new Date(item.publishedAt).toLocaleDateString()
            }));
        } else if (type === 'platforms') {
            headers = [
                { id: 'platform', title: 'Platform' },
                { id: 'followers', title: 'Followers' },
                { id: 'posts', title: 'Posts' },
                { id: 'avgEngagement', title: 'Avg Engagement (%)' },
                { id: 'reach', title: 'Reach' },
                { id: 'impressions', title: 'Impressions' }
            ];
            
            records = Object.entries(data.platforms).map(([platform, stats]) => ({
                platform: platform.charAt(0).toUpperCase() + platform.slice(1),
                ...stats
            }));
        }
        
        const writer = csvWriter.createObjectCsvWriter({
            path: filepath,
            header: headers
        });
        
        await writer.writeRecords(records);
        
        // Send file for download
        res.download(filepath, filename, (err) => {
            if (err) {
                console.error('Error sending file:', err);
                res.status(500).json({ error: 'Failed to download file' });
            }
            
            // Clean up temporary file
            setTimeout(() => {
                if (fs.existsSync(filepath)) {
                    fs.unlinkSync(filepath);
                }
            }, 10000); // Delete after 10 seconds
        });
        
    } catch (error) {
        console.error('Error exporting CSV:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export CSV'
        });
    }
});

// POST /api/v1/analytics/export/excel - Export analytics as Excel
router.post('/export/excel', requireAuth, async (req, res) => {
    try {
        const { range = 'week' } = req.body;
        const data = await getAnalyticsDataForExport(range);
        
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'SYNTHEX Analytics';
        workbook.created = new Date();
        
        // Overview Sheet
        const overviewSheet = workbook.addWorksheet('Overview');
        overviewSheet.columns = [
            { header: 'Metric', key: 'metric', width: 20 },
            { header: 'Value', key: 'value', width: 15 }
        ];
        
        overviewSheet.addRows([
            { metric: 'Total Reach', value: data.overview.totalReach },
            { metric: 'Engagement', value: data.overview.engagement },
            { metric: 'Total Posts', value: data.overview.totalPosts },
            { metric: 'Click Rate (%)', value: data.overview.clickRate },
            { metric: 'Impressions', value: data.overview.impressions },
            { metric: 'Shares', value: data.overview.shares },
            { metric: 'Comments', value: data.overview.comments },
            { metric: 'Likes', value: data.overview.likes }
        ]);
        
        // Content Performance Sheet
        const contentSheet = workbook.addWorksheet('Content Performance');
        contentSheet.columns = [
            { header: 'Content Title', key: 'title', width: 25 },
            { header: 'Type', key: 'type', width: 10 },
            { header: 'Platform', key: 'platform', width: 12 },
            { header: 'Published Date', key: 'publishedAt', width: 15 },
            { header: 'Reach', key: 'reach', width: 12 },
            { header: 'Engagement', key: 'engagement', width: 12 },
            { header: 'Shares', key: 'shares', width: 10 },
            { header: 'Comments', key: 'comments', width: 10 },
            { header: 'Likes', key: 'likes', width: 10 }
        ];
        
        contentSheet.addRows(data.contentPerformance.map(item => ({
            ...item,
            publishedAt: new Date(item.publishedAt).toLocaleDateString()
        })));
        
        // Platforms Sheet
        const platformsSheet = workbook.addWorksheet('Platform Analytics');
        platformsSheet.columns = [
            { header: 'Platform', key: 'platform', width: 12 },
            { header: 'Followers', key: 'followers', width: 12 },
            { header: 'Posts', key: 'posts', width: 10 },
            { header: 'Avg Engagement (%)', key: 'avgEngagement', width: 16 },
            { header: 'Reach', key: 'reach', width: 12 },
            { header: 'Impressions', key: 'impressions', width: 12 }
        ];
        
        platformsSheet.addRows(Object.entries(data.platforms).map(([platform, stats]) => ({
            platform: platform.charAt(0).toUpperCase() + platform.slice(1),
            ...stats
        })));
        
        // Style headers
        [overviewSheet, contentSheet, platformsSheet].forEach(sheet => {
            sheet.getRow(1).font = { bold: true };
            sheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: '6366F1' }
            };
        });
        
        // Create temporary directory if it doesn't exist
        const tempDir = path.join(__dirname, '..', '..', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const timestamp = Date.now();
        const filename = `analytics-report-${range}-${timestamp}.xlsx`;
        const filepath = path.join(tempDir, filename);
        
        await workbook.xlsx.writeFile(filepath);
        
        // Send file for download
        res.download(filepath, filename, (err) => {
            if (err) {
                console.error('Error sending file:', err);
                res.status(500).json({ error: 'Failed to download file' });
            }
            
            // Clean up temporary file
            setTimeout(() => {
                if (fs.existsSync(filepath)) {
                    fs.unlinkSync(filepath);
                }
            }, 10000); // Delete after 10 seconds
        });
        
    } catch (error) {
        console.error('Error exporting Excel:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export Excel'
        });
    }
});

// POST /api/v1/analytics/export/pdf - Export analytics as PDF
router.post('/export/pdf', requireAuth, async (req, res) => {
    try {
        const { range = 'week' } = req.body;
        const data = await getAnalyticsDataForExport(range);
        
        // Create HTML content for PDF
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Analytics Report - ${range.charAt(0).toUpperCase() + range.slice(1)}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #fff; color: #333; }
        .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #6366f1; padding-bottom: 20px; }
        .logo { font-size: 24px; font-weight: bold; color: #6366f1; margin-bottom: 10px; }
        .subtitle { color: #666; font-size: 16px; }
        .section { margin-bottom: 40px; }
        .section-title { font-size: 18px; font-weight: bold; color: #6366f1; margin-bottom: 20px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
        .metric-box { padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px; text-align: center; }
        .metric-value { font-size: 24px; font-weight: bold; color: #6366f1; }
        .metric-label { font-size: 14px; color: #666; margin-top: 5px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background-color: #f8fafc; font-weight: bold; color: #374151; }
        tr:hover { background-color: #f8fafc; }
        .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">SYNTHEX</div>
        <div class="subtitle">Analytics Report - ${range.charAt(0).toUpperCase() + range.slice(1)}</div>
        <div style="font-size: 12px; color: #888; margin-top: 10px;">Generated on ${new Date().toLocaleDateString()}</div>
    </div>

    <div class="section">
        <div class="section-title">Performance Overview</div>
        <div class="metrics-grid">
            <div class="metric-box">
                <div class="metric-value">${data.overview.totalReach.toLocaleString()}</div>
                <div class="metric-label">Total Reach</div>
            </div>
            <div class="metric-box">
                <div class="metric-value">${data.overview.engagement.toLocaleString()}</div>
                <div class="metric-label">Engagement</div>
            </div>
            <div class="metric-box">
                <div class="metric-value">${data.overview.totalPosts}</div>
                <div class="metric-label">Total Posts</div>
            </div>
            <div class="metric-box">
                <div class="metric-value">${data.overview.clickRate}%</div>
                <div class="metric-label">Click Rate</div>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Content Performance</div>
        <table>
            <thead>
                <tr>
                    <th>Content Title</th>
                    <th>Platform</th>
                    <th>Reach</th>
                    <th>Engagement</th>
                    <th>Shares</th>
                </tr>
            </thead>
            <tbody>
                ${data.contentPerformance.map(item => `
                    <tr>
                        <td>${item.title}</td>
                        <td style="text-transform: capitalize;">${item.platform}</td>
                        <td>${item.reach.toLocaleString()}</td>
                        <td>${item.engagement.toLocaleString()}</td>
                        <td>${item.shares}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="section">
        <div class="section-title">Platform Analytics</div>
        <table>
            <thead>
                <tr>
                    <th>Platform</th>
                    <th>Followers</th>
                    <th>Posts</th>
                    <th>Avg Engagement</th>
                    <th>Reach</th>
                </tr>
            </thead>
            <tbody>
                ${Object.entries(data.platforms).map(([platform, stats]) => `
                    <tr>
                        <td style="text-transform: capitalize;">${platform}</td>
                        <td>${stats.followers.toLocaleString()}</td>
                        <td>${stats.posts}</td>
                        <td>${stats.avgEngagement}%</td>
                        <td>${stats.reach.toLocaleString()}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="footer">
        Generated by SYNTHEX Analytics Platform | ${new Date().toISOString()}
    </div>
</body>
</html>
        `;
        
        // Launch Puppeteer
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.setContent(htmlContent);
        
        // Generate PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            margin: {
                top: '20px',
                bottom: '20px',
                left: '20px',
                right: '20px'
            },
            printBackground: true
        });
        
        await browser.close();
        
        // Create temporary directory if it doesn't exist
        const tempDir = path.join(__dirname, '..', '..', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const timestamp = Date.now();
        const filename = `analytics-report-${range}-${timestamp}.pdf`;
        const filepath = path.join(tempDir, filename);
        
        fs.writeFileSync(filepath, pdfBuffer);
        
        // Send file for download
        res.download(filepath, filename, (err) => {
            if (err) {
                console.error('Error sending file:', err);
                res.status(500).json({ error: 'Failed to download file' });
            }
            
            // Clean up temporary file
            setTimeout(() => {
                if (fs.existsSync(filepath)) {
                    fs.unlinkSync(filepath);
                }
            }, 10000); // Delete after 10 seconds
        });
        
    } catch (error) {
        console.error('Error exporting PDF:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export PDF'
        });
    }
});

export default router;