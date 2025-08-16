# SendGrid Email Configuration

## Environment Variables to Add in Vercel

### Required for SendGrid:
```env
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your-sendgrid-api-key-here
EMAIL_FROM=noreply@synthex.social
EMAIL_FROM_NAME=Synthex
```

### How to Add in Vercel:

1. Go to your Vercel Dashboard
2. Select your Synthex project
3. Go to Settings → Environment Variables
4. Add each variable:

   **Variable 1:**
   - Key: `EMAIL_PROVIDER`
   - Value: `sendgrid`
   - Environment: Production, Preview, Development

   **Variable 2:**
   - Key: `SENDGRID_API_KEY`
   - Value: `[Your SendGrid API Key]`
   - Environment: Production, Preview, Development
   
   **Variable 3:**
   - Key: `EMAIL_FROM`
   - Value: `noreply@synthex.social` (or your preferred email)
   - Environment: Production, Preview, Development
   
   **Variable 4:**
   - Key: `EMAIL_FROM_NAME`
   - Value: `Synthex`
   - Environment: Production, Preview, Development

## Enable SendGrid in Code

Since you have the API key, we should install the SendGrid package and enable it properly:

### Step 1: Install SendGrid Package
```bash
npm install @sendgrid/mail
```

### Step 2: The email service in `lib/email/email-service.ts` is already configured to use SendGrid when these environment variables are set. The current placeholder code will automatically use SendGrid once:
1. The package is installed
2. The environment variables are set
3. The commented code is uncommented (I can do this for you)

## SendGrid Setup in Their Dashboard

Make sure in your SendGrid account you have:
1. **Verified your sender domain** (synthex.social)
2. **Created the API key** with at least "Mail Send" permissions
3. **Set up sender authentication** for better deliverability

## Test Email Functionality

Once configured, the email service will handle:
- ✅ Email verification for new users
- ✅ Password reset emails
- ✅ Welcome emails after verification
- ✅ Notification emails

## Current Status

The code is ready but currently using a placeholder because `@sendgrid/mail` isn't installed. Once you:
1. Add the environment variables to Vercel
2. Install the SendGrid package locally
3. Uncomment the SendGrid implementation

Your email service will be fully functional!
