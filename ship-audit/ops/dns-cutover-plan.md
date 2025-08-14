# 🌐 DNS Cutover Plan - SYNTHEX Production

## Pre-Cutover Checklist (T-48h)

### 1. DNS Preparation
- [ ] Current DNS provider: _____________
- [ ] Target DNS provider: Vercel DNS
- [ ] Current TTL: _________ seconds
- [ ] Lower TTL to 300 seconds (5 minutes)

### 2. Current DNS Records
```dns
; Current Configuration
synthex.social.     3600    IN  A       [CURRENT_IP]
www.synthex.social. 3600    IN  CNAME   synthex.social.

; Email Records (preserve these)
synthex.social.     3600    IN  MX  10  mail.synthex.social.
synthex.social.     3600    IN  TXT     "v=spf1 include:_spf.google.com ~all"
_dmarc.synthex.social. 3600 IN  TXT     "v=DMARC1; p=quarantine; rua=mailto:dmarc@synthex.social"
```

### 3. Target DNS Records
```dns
; Production Configuration
synthex.social.     300     IN  A       76.76.21.21
www.synthex.social. 300     IN  CNAME   cname.vercel-dns.com.

; Preserve email records as above
```

## Cutover Procedure (T-0)

### Phase 1: Preparation (30 minutes before)
```bash
# 1. Verify current DNS
nslookup synthex.social
dig synthex.social +trace

# 2. Document current state
echo "Current A record: $(dig +short synthex.social A)"
echo "Current CNAME: $(dig +short www.synthex.social CNAME)"

# 3. Test new target
curl -I https://synthex-production.vercel.app
```

### Phase 2: DNS Update
```bash
# 1. Update A record
synthex.social. IN A 76.76.21.21

# 2. Update CNAME
www.synthex.social. IN CNAME cname.vercel-dns.com.

# 3. Keep TTL at 300 for 24 hours
```

### Phase 3: Verification (Every 5 minutes)
```bash
# Monitor propagation
while true; do
  echo "$(date): $(dig +short synthex.social)"
  sleep 300
done

# Check from multiple locations
curl -I https://synthex.social
curl -I https://www.synthex.social
```

## Propagation Monitoring

### DNS Propagation Checkers
- https://dnschecker.org/#A/synthex.social
- https://whatsmydns.net/#A/synthex.social
- https://dnsmap.io/synthex.social

### Expected Propagation Times
| Region | Expected Time | Max Time |
|--------|--------------|----------|
| North America | 5-15 min | 1 hour |
| Europe | 5-15 min | 1 hour |
| Asia Pacific | 15-30 min | 2 hours |
| Global Complete | 30-60 min | 4 hours |

## TLS/SSL Configuration

### Certificate Requirements
- [ ] Domain: synthex.social
- [ ] SANs: www.synthex.social, *.synthex.social
- [ ] Auto-renewal enabled
- [ ] Expiry monitoring configured

### HTTPS Redirect
```nginx
# Force HTTPS
server {
    listen 80;
    server_name synthex.social www.synthex.social;
    return 301 https://$server_name$request_uri;
}
```

### HSTS Configuration
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

## Rollback Plan

### Immediate Rollback (< 1 hour)
```bash
# Revert A record to previous IP
synthex.social. IN A [PREVIOUS_IP]

# Revert CNAME if changed
www.synthex.social. IN CNAME [PREVIOUS_CNAME]
```

### Emergency Contacts
| Service | Contact | Purpose |
|---------|---------|---------|
| DNS Provider | support@[provider] | DNS changes |
| Vercel | support@vercel.com | Target issues |
| CDN | support@[cdn] | Cache purge |

## Post-Cutover Tasks

### Hour 1
- [ ] Verify site loads on synthex.social
- [ ] Test www redirect
- [ ] Check HTTPS certificate
- [ ] Monitor error rates
- [ ] Test critical user flows

### Hour 4
- [ ] Confirm global propagation
- [ ] Check analytics tracking
- [ ] Verify email delivery
- [ ] Review performance metrics

### Day 1
- [ ] Increase TTL to 3600 (1 hour)
- [ ] Remove old DNS records
- [ ] Update monitoring alerts
- [ ] Document final configuration

### Day 7
- [ ] Increase TTL to 86400 (24 hours)
- [ ] Archive old configurations
- [ ] Close change ticket

## Monitoring Commands

### Windows PowerShell
```powershell
# Check DNS resolution
Resolve-DnsName synthex.social
Test-NetConnection synthex.social -Port 443

# Monitor certificate
.\scripts\check-tls-cert.ps1 -Domain synthex.social
```

### Cross-platform
```bash
# DNS lookup
nslookup synthex.social 8.8.8.8
nslookup synthex.social 1.1.1.1

# Trace route
traceroute synthex.social

# Certificate check
openssl s_client -connect synthex.social:443 -servername synthex.social
```

## Success Criteria

### DNS Health
- [ ] A record resolves correctly
- [ ] CNAME follows properly
- [ ] No NXDOMAIN errors
- [ ] TTL respected

### TLS/SSL Health
- [ ] Valid certificate
- [ ] Correct SANs
- [ ] HSTS enabled
- [ ] No mixed content warnings

### Application Health
- [ ] Site loads under 3 seconds
- [ ] All assets load via HTTPS
- [ ] API endpoints respond
- [ ] No CORS errors

---

**Created:** 2025-08-14
**DNS Cutover Date:** _____________
**Completed:** _____________
**Sign-off:** _____________