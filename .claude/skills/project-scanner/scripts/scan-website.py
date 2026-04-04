#!/usr/bin/env python3
"""
scan-website.py — Website content scanner for non-repo clients
Synthex AI Agency · project-scanner skill

Scrapes client website pages to extract services, content,
brand elements, and video-worthy material. Used when clients
don't have a codebase to scan.
"""
import json
import re
import sys
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlparse, urljoin

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False


def extract_text_blocks(html: str) -> dict:
    """Extract meaningful text blocks from HTML."""
    # Strip script and style tags
    text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<nav[^>]*>.*?</nav>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<footer[^>]*>.*?</footer>', '', text, flags=re.DOTALL | re.IGNORECASE)

    # Extract headings
    headings = re.findall(r'<h[1-3][^>]*>(.*?)</h[1-3]>', text, re.DOTALL | re.IGNORECASE)
    headings = [re.sub(r'<[^>]+>', '', h).strip() for h in headings]
    headings = [h for h in headings if h and len(h) > 2]

    # Extract paragraphs
    paragraphs = re.findall(r'<p[^>]*>(.*?)</p>', text, re.DOTALL | re.IGNORECASE)
    paragraphs = [re.sub(r'<[^>]+>', '', p).strip() for p in paragraphs]
    paragraphs = [p for p in paragraphs if p and len(p) > 30]

    # Extract list items (often services)
    list_items = re.findall(r'<li[^>]*>(.*?)</li>', text, re.DOTALL | re.IGNORECASE)
    list_items = [re.sub(r'<[^>]+>', '', li).strip() for li in list_items]
    list_items = [li for li in list_items if li and len(li) > 10]

    return {
        "headings": headings[:20],
        "paragraphs": paragraphs[:30],
        "list_items": list_items[:30],
    }


def extract_meta(html: str) -> dict:
    """Extract meta tags for brand/SEO info."""
    meta = {}

    # Title
    title_match = re.search(r'<title>(.*?)</title>', html, re.DOTALL | re.IGNORECASE)
    if title_match:
        meta["title"] = title_match.group(1).strip()

    # Description
    desc_match = re.search(
        r'<meta[^>]+name=["\']description["\'][^>]+content=["\'](.*?)["\']',
        html, re.IGNORECASE
    )
    if desc_match:
        meta["description"] = desc_match.group(1).strip()

    # Open Graph tags
    og_matches = re.findall(
        r'<meta[^>]+property=["\']og:(\w+)["\'][^>]+content=["\'](.*?)["\']',
        html, re.IGNORECASE
    )
    for key, val in og_matches:
        meta[f"og_{key}"] = val.strip()

    # Keywords
    kw_match = re.search(
        r'<meta[^>]+name=["\']keywords["\'][^>]+content=["\'](.*?)["\']',
        html, re.IGNORECASE
    )
    if kw_match:
        meta["keywords"] = kw_match.group(1).strip()

    return meta


def detect_services(content: dict) -> list:
    """Identify services from page content."""
    services = []
    service_keywords = [
        "service", "solution", "offer", "provide", "special",
        "expert", "professional", "certified", "licensed",
        "consultation", "support", "maintenance"
    ]

    for heading in content.get("headings", []):
        for kw in service_keywords:
            if kw in heading.lower():
                services.append({
                    "name": heading,
                    "source": "heading",
                    "verification": "VERIFIED"
                })
                break

    for item in content.get("list_items", []):
        if any(kw in item.lower() for kw in service_keywords):
            services.append({
                "name": item[:100],
                "source": "list_item",
                "verification": "VERIFIED"
            })

    return services[:15]


def detect_features(content: dict) -> list:
    """Identify product features from page content."""
    features = []
    feature_keywords = [
        "feature", "benefit", "advantage", "capability",
        "include", "support", "enable", "power"
    ]

    all_text = " ".join(content.get("paragraphs", []))

    for heading in content.get("headings", []):
        for kw in feature_keywords:
            if kw in heading.lower():
                features.append({
                    "name": heading,
                    "source": "heading",
                    "verification": "VERIFIED"
                })
                break

    return features[:15]


def detect_placeholders(content: dict) -> list:
    """Check for placeholder/template content."""
    markers = []
    all_text = " ".join(content.get("paragraphs", []))

    patterns = [
        (r'lorem ipsum', "Lorem ipsum text detected"),
        (r'your company', "Template text — 'your company'"),
        (r'example\.com', "Example.com placeholder"),
        (r'insert .* here', "Insert placeholder"),
        (r'coming soon', "Coming soon page"),
        (r'\[.*?\]', "Bracket placeholders"),
    ]

    for pattern, desc in patterns:
        if re.search(pattern, all_text, re.IGNORECASE):
            markers.append(desc)

    return markers


def extract_brand_colours(html: str) -> list:
    """Try to extract brand colours from CSS."""
    colours = set()

    # Look for hex colours in inline styles and style blocks
    hex_matches = re.findall(r'#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b', html)
    for match in hex_matches[:20]:
        if len(match) == 3:
            colours.add(f"#{match[0]*2}{match[1]*2}{match[2]*2}")
        else:
            colours.add(f"#{match}")

    # Filter out common non-brand colours
    common = {"#000000", "#ffffff", "#000", "#fff", "#333333", "#666666", "#999999"}
    brand_colours = [c for c in colours if c.lower() not in common]

    return brand_colours[:5]


def scan_url(url: str) -> dict:
    """Scan a single URL for content."""
    if not HAS_REQUESTS:
        return {"url": url, "error": "requests library not installed"}

    try:
        resp = requests.get(url, timeout=15, headers={
            "User-Agent": "SynthexBot/1.0 (content-analysis; https://synthex.social)"
        })
        resp.raise_for_status()
        html = resp.text

        meta = extract_meta(html)
        content = extract_text_blocks(html)
        services = detect_services(content)
        features = detect_features(content)
        placeholders = detect_placeholders(content)
        colours = extract_brand_colours(html)

        return {
            "url": url,
            "status": resp.status_code,
            "meta": meta,
            "content_stats": {
                "headings": len(content["headings"]),
                "paragraphs": len(content["paragraphs"]),
                "list_items": len(content["list_items"]),
            },
            "services": services,
            "features": features,
            "brand_colours": colours,
            "placeholders": placeholders,
            "verification": "VERIFIED" if not placeholders else "PARTIAL",
            "headings": content["headings"][:10],
            "key_content": content["paragraphs"][:5],
        }
    except requests.exceptions.Timeout:
        return {"url": url, "error": "Request timed out"}
    except requests.exceptions.RequestException as e:
        return {"url": url, "error": str(e)}
    except Exception as e:
        return {"url": url, "error": str(e)}


def main():
    if len(sys.argv) < 2:
        print("Usage: scan-website.py <url1> [url2] ... [--output file.json]")
        print()
        print("Scans website pages to extract services, content, and brand elements.")
        print("Used for clients without a codebase to scan.")
        sys.exit(1)

    urls = []
    output_path = None
    i = 1
    while i < len(sys.argv):
        if sys.argv[i] == "--output" and i + 1 < len(sys.argv):
            output_path = sys.argv[i + 1]
            i += 2
        else:
            urls.append(sys.argv[i])
            i += 1

    print("Synthex Website Scanner")
    print("=======================")
    print(f"Scanning {len(urls)} URL(s)...")
    print()

    results = []
    all_services = []
    all_features = []
    all_colours = []

    for url in urls:
        print(f"Scanning: {url}")
        result = scan_url(url)
        results.append(result)

        if "error" in result:
            print(f"  ERROR: {result['error']}")
        else:
            print(f"  OK: {result['content_stats']}")
            all_services.extend(result.get("services", []))
            all_features.extend(result.get("features", []))
            all_colours.extend(result.get("brand_colours", []))

    # Deduplicate
    seen_services = set()
    unique_services = []
    for s in all_services:
        key = s["name"].lower().strip()
        if key not in seen_services:
            seen_services.add(key)
            unique_services.append(s)

    seen_features = set()
    unique_features = []
    for f in all_features:
        key = f["name"].lower().strip()
        if key not in seen_features:
            seen_features.add(key)
            unique_features.append(f)

    unique_colours = list(set(all_colours))

    domain = urlparse(urls[0]).netloc if urls else "unknown"

    manifest = {
        "source_type": "url-scan",
        "domain": domain,
        "scanned_at": datetime.now(timezone.utc).isoformat(),
        "urls_scanned": len(results),
        "pages": results,
        "services": unique_services,
        "features": unique_features,
        "brand_colours": unique_colours,
        "video_candidates": {
            "service_explainers": len(unique_services),
            "feature_demos": len(unique_features),
            "platform_overview": any(
                r.get("meta", {}).get("description") for r in results
            ),
        },
        "verification": {
            "verified": sum(1 for r in results if r.get("verification") == "VERIFIED"),
            "partial": sum(1 for r in results if r.get("verification") == "PARTIAL"),
            "errors": sum(1 for r in results if "error" in r),
        }
    }

    output = json.dumps(manifest, indent=2)
    if output_path:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        Path(output_path).write_text(output)
        print(f"\nManifest written to {output_path}")
    else:
        print()
        print(output)

    print()
    print("Summary:")
    print(f"  Services discovered: {len(unique_services)}")
    print(f"  Features discovered: {len(unique_features)}")
    print(f"  Brand colours found: {len(unique_colours)}")
    print(f"  Pages scanned: {len(urls)}")


if __name__ == "__main__":
    main()
