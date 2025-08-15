# DNS Configuration Fix for synthex.social

## Current Issues:
Your DNS records are not correctly configured for Vercel deployment.

## Required DNS Configuration:

### Option 1: Using A Record (Recommended)
Delete all existing records for the root domain (@) and add:

**For the root domain (synthex.social):**
- Type: A
- Name: @ (or leave blank)
- Value: 76.76.21.21
- TTL: 3600 (or Auto)

### Option 2: Using CNAME (if your DNS provider supports CNAME flattening)
**For the root domain:**
- Type: CNAME or ALIAS
- Name: @ (or leave blank)  
- Value: cname.vercel-dns.com
- TTL: 3600 (or Auto)

**For www subdomain (optional):**
- Type: CNAME
- Name: www
- Value: cname.vercel-dns.com
- TTL: 3600 (or Auto)

## Steps to Fix:

1. **In your DNS provider (appears to be Vercel):**
   - DELETE the existing A record pointing to 76.76.21.21
   - DELETE the existing ALIAS records pointing to cname.vercel-dns-076.com
   - DELETE the conflicting records

2. **Add the correct record:**
   - Type: A
   - Name: @ (or blank for root)
   - Value: 76.76.21.21
   - TTL: Auto

3. **In Vercel Dashboard:**
   - Go to your project settings
   - Navigate to Domains
   - Add `synthex.social` as a custom domain
   - Follow Vercel's instructions to verify

## Vercel Domain Configuration:

Run this command to add your domain to Vercel:
```bash
vercel domains add synthex.social
```

Then assign it to your project:
```bash
vercel alias synthex.social
```

## Important Notes:
- DNS propagation can take up to 48 hours, but usually completes within 1-2 hours
- The SSL certificate should be automatically provisioned by Vercel once DNS is correct
- Your current SSL certificate shows it's valid until Aug 5, 2025

## Verification:
After making changes, you can verify with:
```bash
nslookup synthex.social
dig synthex.social
```

The domain should resolve to Vercel's servers.