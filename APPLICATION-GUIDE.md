# SYNTHEX Application Guide

## Quick Start

### Option 1: Windows Batch File
```bash
start-app.bat
```

### Option 2: PowerShell
```powershell
.\start-app.ps1
```

### Option 3: Manual Start
```bash
node simple-server.js
```

## Access the Application

Once the server is running, open your browser and navigate to:

- **Homepage**: http://localhost:3001
- **Login**: http://localhost:3001/login  
- **Dashboard**: http://localhost:3001/dashboard
- **Content Studio**: http://localhost:3001/content-studio.html

## Features

### 1. Authentication System
- Login with email/password
- Session management
- Protected routes

### 2. Dashboard
- Real-time statistics
- Campaign overview
- Activity feed
- Performance metrics

### 3. Content Generation
- AI-powered content creation
- Multi-platform support
- Content preview
- Character limits for each platform

### 4. Campaign Management
- Create and manage campaigns
- Schedule posts
- Track performance

## Test Credentials

You can login with any email/password combination in development mode:
- Email: `test@example.com`
- Password: `password123`

## API Endpoints

The application includes the following API endpoints:

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/campaigns` - List campaigns
- `POST /api/content/generate` - Generate AI content
- `GET /api/health` - Health check

## Technology Stack

- **Frontend**: HTML5, CSS3 (Glassmorphic Design), JavaScript
- **Backend**: Node.js, Express.js
- **Design**: Apple-style glassmorphic UI with dark theme
- **Authentication**: JWT tokens with localStorage

## File Structure

```
D:\Synthex\
├── public/                 # Frontend files
│   ├── index.html         # Homepage
│   ├── login-unified.html # Login page
│   ├── dashboard-unified.html # Dashboard
│   ├── content-studio.html # Content generation
│   ├── js/
│   │   ├── synthex-components.js # UI components
│   │   └── api-client.js # API communication
│   └── css/               # Stylesheets
├── simple-server.js       # Development server
├── start-app.bat         # Windows startup script
└── start-app.ps1         # PowerShell startup script
```

## Development Notes

1. The application uses a mock authentication system for development
2. All API responses are simulated with realistic data
3. The glassmorphic UI is optimized for modern browsers
4. Session data is stored in localStorage

## Troubleshooting

### Port Already in Use
If port 3000 is already in use, you can change it in `simple-server.js`:
```javascript
const PORT = process.env.PORT || 3001; // Change to desired port
```

### Dependencies Not Installing
Run:
```bash
npm cache clean --force
npm install
```

### Page Not Loading
1. Check if the server is running
2. Clear browser cache
3. Check browser console for errors

## Next Steps

To make this a production-ready application:

1. **Backend Integration**: Connect to real database (Supabase/PostgreSQL)
2. **Authentication**: Implement OAuth (Google, GitHub)
3. **AI Integration**: Connect to OpenRouter/Anthropic APIs
4. **Deployment**: Deploy to Vercel/Railway/Heroku
5. **Testing**: Add unit and integration tests

## Support

For issues or questions, check:
- Browser console for errors
- Network tab for API calls
- Server console for backend errors

## License

MIT License - See LICENSE file for details