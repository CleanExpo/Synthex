#!/usr/bin/env python3
"""
generate_image.py — AI Image Generation using Google Gemini (FREE TIER)
Synthex AI Agency · imagen-designer skill

Generates images for video production and marketing materials
using Google's Gemini API with image generation capabilities.

TIER: FREE
MODEL: gemini-2.0-flash-exp (free tier model)

For premium Imagen 4 models, use: scripts/generate_imagen.py
For Nano Banana Pro/Flash, use: scripts/generate_nano_banana.py
"""
import os
import sys
import json
import base64
import argparse
import time
from pathlib import Path
from datetime import datetime, timezone

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False


def get_api_key():
    """Get API key from environment (priority: GEMINI > OPENAI > OPENROUTER > GOOGLE)."""
    # Try Gemini API key first (specific key for Gemini)
    key = os.environ.get("GEMINI_API_KEY")
    if key:
        return key, "gemini"

    # Try OpenAI as second choice (DALL-E fallback)
    openai_key = os.environ.get("OPENAI_API_KEY")
    if openai_key:
        return openai_key, "openai"

    # Try OpenRouter as third choice
    openrouter_key = os.environ.get("OPENROUTER_API_KEY")
    if openrouter_key:
        return openrouter_key, "openrouter"

    # Try GOOGLE_API_KEY last (may not be enabled for Gemini)
    google_key = os.environ.get("GOOGLE_API_KEY")
    if google_key:
        return google_key, "gemini"

    # Try loading from .env files - collect all keys first, then prioritize
    env_files = [Path(".env.local"), Path(".env"), Path(".env.production.local")]
    found_keys = {}
    for env_path in env_files:
        if env_path.exists():
            for line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
                line = line.strip()
                if line.startswith("GEMINI_API_KEY=") and "GEMINI_API_KEY" not in found_keys:
                    found_keys["GEMINI_API_KEY"] = line.split("=", 1)[1].strip().strip('"\'')
                elif line.startswith("OPENAI_API_KEY=") and "OPENAI_API_KEY" not in found_keys:
                    found_keys["OPENAI_API_KEY"] = line.split("=", 1)[1].strip().strip('"\'')
                elif line.startswith("OPENROUTER_API_KEY=") and "OPENROUTER_API_KEY" not in found_keys:
                    found_keys["OPENROUTER_API_KEY"] = line.split("=", 1)[1].strip().strip('"\'')
                elif line.startswith("GOOGLE_API_KEY=") and "GOOGLE_API_KEY" not in found_keys:
                    found_keys["GOOGLE_API_KEY"] = line.split("=", 1)[1].strip().strip('"\'')

    # Return in priority order: GEMINI > OPENAI > OPENROUTER > GOOGLE
    if "GEMINI_API_KEY" in found_keys:
        return found_keys["GEMINI_API_KEY"], "gemini"
    if "OPENAI_API_KEY" in found_keys:
        return found_keys["OPENAI_API_KEY"], "openai"
    if "OPENROUTER_API_KEY" in found_keys:
        return found_keys["OPENROUTER_API_KEY"], "openrouter"
    if "GOOGLE_API_KEY" in found_keys:
        return found_keys["GOOGLE_API_KEY"], "gemini"

    return None, ""


def calculate_dimensions(aspect: str, base_size: int = 1024) -> tuple:
    """Calculate pixel dimensions from aspect ratio."""
    ratios = {
        "16:9": (1792, 1024),
        "9:16": (1024, 1792),
        "1:1": (1024, 1024),
        "4:3": (1365, 1024),
        "3:4": (1024, 1365),
    }
    return ratios.get(aspect, (1792, 1024))


def enhance_prompt(prompt: str, style: str) -> str:
    """Enhance prompt with style-specific additions."""
    style_additions = {
        "realistic": "Photorealistic, high detail, professional photography style.",
        "artistic": "Artistic interpretation, creative, visually striking.",
        "minimal": "Minimalist design, clean, simple, lots of whitespace.",
        "corporate": "Professional corporate style, clean, modern, business appropriate.",
    }

    suffix = style_additions.get(style, style_additions["realistic"])
    enhanced = f"{prompt} {suffix} High quality, 4K resolution."
    return enhanced


def generate_with_gemini(prompt: str, api_key: str, output_path: str, aspect: str = "16:9") -> dict:
    """Generate image using Gemini API."""
    if not HAS_REQUESTS:
        return {"success": False, "error": "requests library not installed"}

    # Gemini API endpoint for image generation
    # FREE TIER: Nano Banana (gemini-2.5-flash-image)
    # See: https://ai.google.dev/gemini-api/docs/image-generation
    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent"

    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": api_key
    }

    # Request payload for image generation
    payload = {
        "contents": [{
            "parts": [{
                "text": f"Generate an image: {prompt}"
            }]
        }],
        "generationConfig": {
            "responseModalities": ["image", "text"],
            "responseMimeType": "image/png"
        }
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=120)

        if response.status_code == 429:
            # Rate limited - wait and retry
            print("Rate limited, waiting 60 seconds...")
            time.sleep(60)
            response = requests.post(url, headers=headers, json=payload, timeout=120)

        if response.status_code != 200:
            return {
                "success": False,
                "error": f"API error {response.status_code}: {response.text[:500]}"
            }

        result = response.json()

        # Extract image data from response
        if "candidates" in result and len(result["candidates"]) > 0:
            candidate = result["candidates"][0]
            if "content" in candidate and "parts" in candidate["content"]:
                for part in candidate["content"]["parts"]:
                    if "inlineData" in part:
                        image_data = part["inlineData"]["data"]
                        mime_type = part["inlineData"].get("mimeType", "image/png")

                        # Decode and save image
                        image_bytes = base64.b64decode(image_data)
                        output_file = Path(output_path)
                        output_file.parent.mkdir(parents=True, exist_ok=True)
                        output_file.write_bytes(image_bytes)

                        return {
                            "success": True,
                            "path": str(output_file),
                            "size_bytes": len(image_bytes),
                            "mime_type": mime_type
                        }

        return {"success": False, "error": "No image data in response"}

    except requests.exceptions.Timeout:
        return {"success": False, "error": "Request timed out after 120 seconds"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def generate_with_openrouter(prompt: str, api_key: str, output_path: str, aspect: str = "16:9") -> dict:
    """Generate image using OpenRouter API as fallback."""
    if not HAS_REQUESTS:
        return {"success": False, "error": "requests library not installed"}

    url = "https://openrouter.ai/api/v1/chat/completions"

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "https://synthex.ai",
        "X-Title": "Synthex Image Generator",
    }

    # Use Nano Banana (gemini-2.5-flash-image) via OpenRouter
    payload = {
        "model": "google/gemini-2.5-flash-image",
        "messages": [{
            "role": "user",
            "content": f"Generate a high-quality image: {prompt}"
        }],
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=120)

        if response.status_code == 429:
            print("Rate limited, waiting 60 seconds...")
            time.sleep(60)
            response = requests.post(url, headers=headers, json=payload, timeout=120)

        if response.status_code != 200:
            return {
                "success": False,
                "error": f"OpenRouter API error {response.status_code}: {response.text[:500]}"
            }

        result = response.json()

        # Extract image from response
        if "choices" in result and len(result["choices"]) > 0:
            choice = result["choices"][0]
            message = choice.get("message", {})
            content = message.get("content", "")

            # Check for base64 image data
            if "base64," in content:
                image_data = content.split("base64,")[1]
                image_bytes = base64.b64decode(image_data)

                output_file = Path(output_path)
                output_file.parent.mkdir(parents=True, exist_ok=True)
                output_file.write_bytes(image_bytes)

                return {
                    "success": True,
                    "path": str(output_file),
                    "size_bytes": len(image_bytes),
                    "mime_type": "image/png",
                    "provider": "openrouter"
                }

        return {"success": False, "error": "No image data in OpenRouter response"}

    except requests.exceptions.Timeout:
        return {"success": False, "error": "Request timed out after 120 seconds"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def generate_placeholder(output_path: str, aspect: str, prompt: str) -> dict:
    """Generate a placeholder image when API is unavailable."""
    # Create a simple placeholder SVG
    width, height = calculate_dimensions(aspect)

    svg_content = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#EBEBEF"/>
  <rect x="10%" y="10%" width="80%" height="80%" fill="#E0E0E0" rx="20"/>
  <text x="50%" y="45%" font-family="Arial, sans-serif" font-size="24"
        fill="#666" text-anchor="middle" dominant-baseline="middle">
    [Image Placeholder]
  </text>
  <text x="50%" y="55%" font-family="Arial, sans-serif" font-size="14"
        fill="#888" text-anchor="middle" dominant-baseline="middle">
    {prompt[:50]}{'...' if len(prompt) > 50 else ''}
  </text>
</svg>'''

    output_file = Path(output_path)
    if not output_file.suffix:
        output_file = output_file.with_suffix('.svg')

    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text(svg_content)

    return {
        "success": True,
        "path": str(output_file),
        "size_bytes": len(svg_content),
        "mime_type": "image/svg+xml",
        "placeholder": True
    }


def main():
    parser = argparse.ArgumentParser(description="Generate AI images using Gemini")
    parser.add_argument("--prompt", required=True, help="Image description")
    parser.add_argument("--aspect", default="16:9",
                        choices=["16:9", "9:16", "1:1", "4:3", "3:4"],
                        help="Aspect ratio")
    parser.add_argument("--output", required=True, help="Output file path")
    parser.add_argument("--style", default="realistic",
                        choices=["realistic", "artistic", "minimal", "corporate"],
                        help="Visual style")
    parser.add_argument("--placeholder", action="store_true",
                        help="Generate placeholder if API unavailable")

    args = parser.parse_args()

    print(f"Imagen Generator")
    print(f"================")
    print(f"Prompt: {args.prompt[:80]}{'...' if len(args.prompt) > 80 else ''}")
    print(f"Aspect: {args.aspect}")
    print(f"Style: {args.style}")
    print(f"Output: {args.output}")
    print()

    # Check for API key (Gemini or OpenRouter fallback)
    api_key, provider = get_api_key()
    if not api_key:
        print("WARNING: No API key found (GEMINI_API_KEY or OPENROUTER_API_KEY)")
        if args.placeholder:
            print("Generating placeholder image...")
            result = generate_placeholder(args.output, args.aspect, args.prompt)
        else:
            print("ERROR: Set GEMINI_API_KEY, OPENROUTER_API_KEY, or use --placeholder flag")
            sys.exit(1)
    else:
        # Enhance prompt with style
        enhanced_prompt = enhance_prompt(args.prompt, args.style)
        print(f"Provider: {provider.upper()}")
        print(f"Enhanced prompt: {enhanced_prompt[:100]}...")
        print()

        # Generate image with appropriate provider
        if provider == "openrouter":
            print("Generating image with OpenRouter API...")
            result = generate_with_openrouter(enhanced_prompt, api_key, args.output, args.aspect)
        else:
            print("Generating image with Gemini API...")
            result = generate_with_gemini(enhanced_prompt, api_key, args.output, args.aspect)

        # If API fails and placeholder flag set, fall back to placeholder
        if not result["success"] and args.placeholder:
            print(f"API failed: {result.get('error', 'Unknown error')}")
            print("Generating placeholder instead...")
            result = generate_placeholder(args.output, args.aspect, args.prompt)

    # Output result
    print()
    if result["success"]:
        print("SUCCESS")
        print(f"  Path: {result['path']}")
        print(f"  Size: {result['size_bytes']} bytes")
        print(f"  Type: {result['mime_type']}")
        if result.get("placeholder"):
            print("  Note: This is a placeholder image")
    else:
        print("FAILED")
        print(f"  Error: {result.get('error', 'Unknown error')}")
        sys.exit(1)

    # Write result JSON for programmatic use
    result_json = Path(args.output).with_suffix('.json')
    result["generated_at"] = datetime.now(timezone.utc).isoformat()
    result["prompt"] = args.prompt
    result["aspect"] = args.aspect
    result["style"] = args.style
    result_json.write_text(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
