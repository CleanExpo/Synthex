#!/usr/bin/env python3
"""
generate_nano_banana.py — Nano Banana Pro/Flash Image Generation
Synthex AI Agency · imagen-generator agent

Generates images using Google's Gemini Nano Banana experimental models.
Supports both Pro (higher quality) and Flash (faster) variants.

Usage:
    python scripts/generate_nano_banana.py "A futuristic city at sunset" \
        --model pro \
        --aspect 16:9 \
        --output output/city.png
"""
import os
import sys
import json
import base64
import argparse
import time
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, Dict, Any

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

# Model configurations
# Updated Feb 2026 - See: https://ai.google.dev/gemini-api/docs/image-generation
MODELS = {
    # FREE TIER - Nano Banana (Gemini 2.5 Flash Image)
    "flash": {
        "id": "gemini-2.5-flash-image",
        "name": "Nano Banana",
        "description": "Fast generation, high-volume (FREE)",
        "tier": "free",
        "timeout": 60,
        "max_retries": 1,
    },
    # PREMIUM TIER - Nano Banana 2 Pro (Gemini 3 Pro Image)
    "pro": {
        "id": "gemini-3-pro-image-preview",
        "name": "Nano Banana 2 Pro",
        "description": "Professional quality, 4K output (PREMIUM)",
        "tier": "premium",
        "timeout": 180,
        "max_retries": 2,
    },
}

# Aspect ratio to pixel dimensions
ASPECT_RATIOS = {
    "16:9": (1792, 1024),
    "9:16": (1024, 1792),
    "1:1": (1024, 1024),
    "4:3": (1365, 1024),
    "3:4": (1024, 1365),
    "21:9": (2048, 878),
    "9:21": (878, 2048),
}

# API endpoint
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def get_api_key() -> tuple[Optional[str], str]:
    """Get API key from environment or .env files.

    Returns:
        Tuple of (api_key, provider) where provider is 'gemini', 'openrouter', or 'openai'
    """
    # Try Gemini API key first (specific Gemini key)
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
    env_files = [".env.local", ".env", ".env.production.local"]
    found_keys = {}
    for env_file in env_files:
        env_path = Path(env_file)
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


def enhance_prompt(prompt: str, model: str) -> str:
    """Enhance prompt for better generation results."""
    quality_hints = {
        "pro": "Ultra high quality, photorealistic, 8K resolution, professional photography, sharp details, perfect lighting.",
        "flash": "High quality, clear details, good composition, professional look.",
    }

    hint = quality_hints.get(model, quality_hints["flash"])
    return f"{prompt}. {hint}"


def generate_image(
    prompt: str,
    model: str,
    aspect: str,
    output_path: str,
    api_key: str,
) -> Dict[str, Any]:
    """Generate image using Nano Banana model."""
    if not HAS_REQUESTS:
        return {"success": False, "error": "requests library not installed. Run: pip install requests"}

    model_config = MODELS.get(model, MODELS["flash"])
    model_id = model_config["id"]
    timeout = model_config["timeout"]
    max_retries = model_config["max_retries"]

    url = GEMINI_API_URL.format(model=model_id)

    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": api_key,
    }

    # Enhanced prompt
    enhanced_prompt = enhance_prompt(prompt, model)

    # Request payload
    payload = {
        "contents": [{
            "parts": [{
                "text": f"Generate a high-quality image: {enhanced_prompt}"
            }]
        }],
        "generationConfig": {
            "responseModalities": ["image", "text"],
            "responseMimeType": "image/png",
        },
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_ONLY_HIGH"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_ONLY_HIGH"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_ONLY_HIGH"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_ONLY_HIGH"},
        ]
    }

    last_error = None
    retries_left = max_retries
    for attempt in range(max_retries + 1):
        try:
            if attempt > 0:
                print(f"  Retry attempt {attempt}/{max_retries}...")
                time.sleep(5 * attempt)  # Exponential backoff

            response = requests.post(url, headers=headers, json=payload, timeout=timeout)

            # Handle rate limiting
            if response.status_code == 429:
                wait_time = int(response.headers.get("Retry-After", 60))
                print(f"  Rate limited. Waiting {wait_time} seconds...")
                time.sleep(wait_time)
                continue

            if response.status_code != 200:
                last_error = f"API error {response.status_code}: {response.text[:300]}"
                continue

            result = response.json()

            # Extract image from response
            if "candidates" in result and len(result["candidates"]) > 0:
                candidate = result["candidates"][0]

                # Check for safety blocks
                if candidate.get("finishReason") == "SAFETY":
                    return {"success": False, "error": "Content blocked by safety filters"}

                if "content" in candidate and "parts" in candidate["content"]:
                    for part in candidate["content"]["parts"]:
                        if "inlineData" in part:
                            image_data = part["inlineData"]["data"]
                            mime_type = part["inlineData"].get("mimeType", "image/png")

                            # Decode and save
                            image_bytes = base64.b64decode(image_data)
                            output_file = Path(output_path)
                            output_file.parent.mkdir(parents=True, exist_ok=True)
                            output_file.write_bytes(image_bytes)

                            # Get dimensions
                            width, height = ASPECT_RATIOS.get(aspect, (1024, 1024))

                            return {
                                "success": True,
                                "path": str(output_file.absolute()),
                                "size_bytes": len(image_bytes),
                                "mime_type": mime_type,
                                "model": model_config["name"],
                                "model_id": model_id,
                                "dimensions": {"width": width, "height": height},
                                "aspect_ratio": aspect,
                            }

            last_error = "No image data in API response"

        except requests.exceptions.Timeout:
            last_error = f"Request timed out after {timeout} seconds"
        except requests.exceptions.RequestException as e:
            last_error = f"Request failed: {str(e)}"
        except Exception as e:
            last_error = f"Unexpected error: {str(e)}"

    return {"success": False, "error": last_error or "Generation failed after retries"}


def generate_with_openrouter(
    prompt: str,
    model: str,
    aspect: str,
    output_path: str,
    api_key: str,
) -> Dict[str, Any]:
    """Generate image using OpenRouter API as fallback."""
    if not HAS_REQUESTS:
        return {"success": False, "error": "requests library not installed. Run: pip install requests"}

    model_config = MODELS.get(model, MODELS["flash"])

    # OpenRouter endpoint
    url = "https://openrouter.ai/api/v1/chat/completions"

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "https://synthex.ai",
        "X-Title": "Synthex Image Generator",
    }

    # Enhanced prompt
    enhanced_prompt = enhance_prompt(prompt, model)

    # Use Nano Banana via OpenRouter
    # Free tier: gemini-2.5-flash-image, Premium: gemini-3-pro-image-preview
    openrouter_model = "google/gemini-2.5-flash-image" if model_config["tier"] == "free" else "google/gemini-3-pro-image-preview"

    payload = {
        "model": openrouter_model,
        "messages": [{
            "role": "user",
            "content": f"Generate a high-quality image: {enhanced_prompt}"
        }],
        "response_format": {"type": "image"},
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=model_config["timeout"])

        if response.status_code == 429:
            return {"success": False, "error": "Rate limited. Please wait and try again."}

        if response.status_code != 200:
            return {"success": False, "error": f"OpenRouter API error {response.status_code}: {response.text[:300]}"}

        result = response.json()

        # Extract image from response
        if "choices" in result and len(result["choices"]) > 0:
            choice = result["choices"][0]
            message = choice.get("message", {})
            content = message.get("content", "")

            # Check for base64 image data
            if "data:image" in content or content.startswith("iVBOR"):
                # Extract base64 data
                if "base64," in content:
                    image_data = content.split("base64,")[1]
                else:
                    image_data = content

                image_bytes = base64.b64decode(image_data)
                output_file = Path(output_path)
                output_file.parent.mkdir(parents=True, exist_ok=True)
                output_file.write_bytes(image_bytes)

                width, height = ASPECT_RATIOS.get(aspect, (1024, 1024))

                return {
                    "success": True,
                    "path": str(output_file.absolute()),
                    "size_bytes": len(image_bytes),
                    "mime_type": "image/png",
                    "model": f"{model_config['name']} (via OpenRouter)",
                    "model_id": openrouter_model,
                    "dimensions": {"width": width, "height": height},
                    "aspect_ratio": aspect,
                    "provider": "openrouter",
                }

        return {"success": False, "error": "No image data in OpenRouter response. Try using GEMINI_API_KEY directly."}

    except requests.exceptions.Timeout:
        return {"success": False, "error": f"Request timed out after {model_config['timeout']} seconds"}
    except Exception as e:
        return {"success": False, "error": f"OpenRouter error: {str(e)}"}


def generate_with_openai(
    prompt: str,
    model: str,
    aspect: str,
    output_path: str,
    api_key: str,
) -> Dict[str, Any]:
    """Generate image using OpenAI DALL-E API as fallback."""
    if not HAS_REQUESTS:
        return {"success": False, "error": "requests library not installed. Run: pip install requests"}

    model_config = MODELS.get(model, MODELS["flash"])

    # OpenAI DALL-E endpoint
    url = "https://api.openai.com/v1/images/generations"

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    # Map aspect ratio to DALL-E 3 size
    size_map = {
        "16:9": "1792x1024",
        "9:16": "1024x1792",
        "1:1": "1024x1024",
        "4:3": "1024x1024",  # Closest supported
        "3:4": "1024x1024",  # Closest supported
        "21:9": "1792x1024",  # Closest supported
        "9:21": "1024x1792",  # Closest supported
    }
    size = size_map.get(aspect, "1024x1024")

    # Enhanced prompt
    enhanced_prompt = enhance_prompt(prompt, model)

    # Use DALL-E 3 for best quality
    payload = {
        "model": "dall-e-3",
        "prompt": enhanced_prompt,
        "n": 1,
        "size": size,
        "quality": "hd" if model_config["tier"] == "premium" else "standard",
        "response_format": "b64_json",
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=model_config["timeout"])

        if response.status_code == 429:
            return {"success": False, "error": "Rate limited. Please wait and try again."}

        if response.status_code != 200:
            error_detail = response.json().get("error", {}).get("message", response.text[:300])
            return {"success": False, "error": f"OpenAI API error {response.status_code}: {error_detail}"}

        result = response.json()

        # Extract image from response
        if "data" in result and len(result["data"]) > 0:
            image_data = result["data"][0].get("b64_json")
            if image_data:
                image_bytes = base64.b64decode(image_data)
                output_file = Path(output_path)
                output_file.parent.mkdir(parents=True, exist_ok=True)
                output_file.write_bytes(image_bytes)

                # Parse size for dimensions
                width, height = map(int, size.split("x"))

                return {
                    "success": True,
                    "path": str(output_file.absolute()),
                    "size_bytes": len(image_bytes),
                    "mime_type": "image/png",
                    "model": "DALL-E 3 (OpenAI fallback)",
                    "model_id": "dall-e-3",
                    "dimensions": {"width": width, "height": height},
                    "aspect_ratio": aspect,
                    "provider": "openai",
                    "revised_prompt": result["data"][0].get("revised_prompt", ""),
                }

        return {"success": False, "error": "No image data in OpenAI response."}

    except requests.exceptions.Timeout:
        return {"success": False, "error": f"Request timed out after {model_config['timeout']} seconds"}
    except Exception as e:
        return {"success": False, "error": f"OpenAI error: {str(e)}"}


def main():
    parser = argparse.ArgumentParser(
        description="Generate images with Nano Banana Pro/Flash models",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/generate_nano_banana.py "A sunset over mountains" --model pro
  python scripts/generate_nano_banana.py "Modern office interior" --model flash --aspect 16:9
  python scripts/generate_nano_banana.py "Abstract art" --output artwork.png
        """
    )
    parser.add_argument("prompt", help="Image description/prompt")
    parser.add_argument(
        "--model", "-m",
        choices=["pro", "flash"],
        default="flash",
        help="Model variant: pro (quality) or flash (speed). Default: flash"
    )
    parser.add_argument(
        "--aspect", "-a",
        choices=list(ASPECT_RATIOS.keys()),
        default="16:9",
        help="Aspect ratio. Default: 16:9"
    )
    parser.add_argument(
        "--output", "-o",
        default=None,
        help="Output file path. Default: output/nano_banana_{timestamp}.png"
    )

    args = parser.parse_args()

    # Default output path
    if args.output is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        args.output = f"output/nano_banana_{timestamp}.png"

    # Header
    model_config = MODELS[args.model]
    print()
    print("=" * 60)
    print(f"  {model_config['name']} Image Generator")
    print("=" * 60)
    print()
    print(f"  Model:   {args.model} ({model_config['description']})")
    print(f"  Aspect:  {args.aspect}")
    print(f"  Output:  {args.output}")
    print(f"  Prompt:  {args.prompt[:60]}{'...' if len(args.prompt) > 60 else ''}")
    print()

    # Get API key (priority: GEMINI > OPENAI > OPENROUTER > GOOGLE)
    api_key, provider = get_api_key()
    if not api_key:
        print("ERROR: No API key found!")
        print()
        print("Please set one of the following (in priority order):")
        print()
        print("  1. GEMINI_API_KEY (recommended - get from https://aistudio.google.com/)")
        print("     export GEMINI_API_KEY=your-gemini-key")
        print()
        print("  2. OPENAI_API_KEY (DALL-E 3 fallback)")
        print("     export OPENAI_API_KEY=your-openai-key")
        print()
        print("  3. OPENROUTER_API_KEY (multi-model fallback)")
        print("     export OPENROUTER_API_KEY=your-openrouter-key")
        print()
        print("Add to .env.local for persistence.")
        print()
        sys.exit(1)

    print(f"Using provider: {provider.upper()}")
    print("Generating image...")
    start_time = time.time()

    # Use appropriate generator based on provider
    if provider == "openai":
        result = generate_with_openai(
            prompt=args.prompt,
            model=args.model,
            aspect=args.aspect,
            output_path=args.output,
            api_key=api_key,
        )
    elif provider == "openrouter":
        result = generate_with_openrouter(
            prompt=args.prompt,
            model=args.model,
            aspect=args.aspect,
            output_path=args.output,
            api_key=api_key,
        )
    else:
        result = generate_image(
            prompt=args.prompt,
            model=args.model,
            aspect=args.aspect,
            output_path=args.output,
            api_key=api_key,
        )

    elapsed = time.time() - start_time
    print()

    if result["success"]:
        print("SUCCESS")
        print("-" * 40)
        print(f"  Path:       {result['path']}")
        print(f"  Size:       {result['size_bytes']:,} bytes")
        print(f"  Type:       {result['mime_type']}")
        print(f"  Model:      {result['model']}")
        print(f"  Dimensions: {result['dimensions']['width']}x{result['dimensions']['height']}")
        print(f"  Time:       {elapsed:.1f}s")
        print()

        # Write metadata JSON
        meta_path = Path(args.output).with_suffix('.json')
        result["generated_at"] = datetime.now(timezone.utc).isoformat()
        result["prompt"] = args.prompt
        result["elapsed_seconds"] = round(elapsed, 2)
        meta_path.write_text(json.dumps(result, indent=2))
        print(f"  Metadata:   {meta_path}")
    else:
        print("FAILED")
        print("-" * 40)
        print(f"  Error: {result['error']}")
        print()
        sys.exit(1)

    print()


if __name__ == "__main__":
    main()
