#!/usr/bin/env python3
"""
generate_imagen.py — Imagen 4 Premium Image Generation
Synthex AI Agency · imagen-generator agent

Generates images using Google's Imagen 4 models (Premium/Paid tier).
Supports 1K and 2K resolution outputs with multiple model variants.

NOTE: This script uses PAID Imagen API endpoints.
      For free tier, use generate_nano_banana.py with gemini-2.0-flash-exp.

Usage:
    python scripts/generate_imagen.py "A futuristic city at sunset" \
        --model imagen-4-ultra \
        --size 2K \
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
from typing import Optional, Dict, Any, List

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

# ============================================================================
# PREMIUM IMAGE GENERATION MODELS (Paid Tier Only)
# ============================================================================
# Updated Feb 2026 - See: https://ai.google.dev/gemini-api/docs/image-generation
# These models require paid subscription or Vertex AI access
# For free tier, use generate_nano_banana.py with gemini-2.5-flash-image
# ============================================================================

MODELS = {
    # Nano Banana 2 Pro (Gemini 3 Pro Image) - FLAGSHIP
    "nano-banana-2-pro": {
        "id": "gemini-3-pro-image-preview",
        "name": "Nano Banana 2 Pro",
        "description": "Professional 4K, advanced text rendering (PREMIUM)",
        "tier": "premium",
        "max_resolution": "4K",
        "timeout": 180,
        "features": ["4K", "text-rendering", "thinking", "search-grounding"],
    },
    # Nano Banana Pro (Gemini 3 Pro Image)
    "nano-banana-pro": {
        "id": "gemini-3-pro-image-preview",
        "name": "Nano Banana Pro",
        "description": "High quality, 2K output (PREMIUM)",
        "tier": "premium",
        "max_resolution": "2K",
        "timeout": 120,
        "features": ["2K", "text-rendering"],
    },
    # Nano Banana (Gemini 2.5 Flash Image) - Free tier fallback
    "nano-banana": {
        "id": "gemini-2.5-flash-image",
        "name": "Nano Banana",
        "description": "Fast generation, high-volume (FREE)",
        "tier": "free",
        "max_resolution": "1K",
        "timeout": 60,
        "features": ["fast", "high-volume"],
    },
    # Legacy Imagen models (Vertex AI)
    "imagen-3": {
        "id": "imagen-3.0-generate-001",
        "name": "Imagen 3",
        "description": "Vertex AI Imagen 3 (PREMIUM)",
        "tier": "premium",
        "max_resolution": "1K",
        "timeout": 120,
        "features": ["vertex-ai"],
    },
}

# Resolution configurations
# Nano Banana Pro supports up to 4K output
RESOLUTIONS = {
    "1K": {
        "16:9": (1024, 576),
        "9:16": (576, 1024),
        "1:1": (1024, 1024),
        "4:3": (1024, 768),
        "3:4": (768, 1024),
        "21:9": (1024, 439),
    },
    "2K": {
        "16:9": (2048, 1152),
        "9:16": (1152, 2048),
        "1:1": (2048, 2048),
        "4:3": (2048, 1536),
        "3:4": (1536, 2048),
        "21:9": (2048, 878),
    },
    "4K": {
        "16:9": (3840, 2160),
        "9:16": (2160, 3840),
        "1:1": (3840, 3840),
        "4:3": (3840, 2880),
        "3:4": (2880, 3840),
        "21:9": (3840, 1646),
    },
}

# Vertex AI endpoint (premium)
VERTEX_AI_URL = "https://{location}-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:predict"

# Alternative: Generative Language API (if available for Imagen)
GENERATIVE_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def get_credentials() -> Dict[str, Optional[str]]:
    """Get all required credentials for Imagen API."""
    creds = {
        "api_key": os.environ.get("GEMINI_API_KEY"),
        "openrouter_key": os.environ.get("OPENROUTER_API_KEY"),
        "google_api_key": os.environ.get("GOOGLE_API_KEY"),
        "project_id": os.environ.get("VERTEX_AI_PROJECT") or os.environ.get("GOOGLE_CLOUD_PROJECT"),
        "location": os.environ.get("VERTEX_AI_LOCATION", "us-central1"),
        "access_token": os.environ.get("GOOGLE_ACCESS_TOKEN"),
    }

    # Try loading from .env files
    env_files = [".env.local", ".env", ".env.production.local"]
    for env_file in env_files:
        env_path = Path(env_file)
        if env_path.exists():
            for line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                for key in ["GEMINI_API_KEY", "OPENROUTER_API_KEY", "GOOGLE_API_KEY",
                           "VERTEX_AI_PROJECT", "GOOGLE_CLOUD_PROJECT", "VERTEX_AI_LOCATION"]:
                    if line.startswith(f"{key}="):
                        value = line.split("=", 1)[1].strip().strip('"\'')
                        env_key = key.lower().replace("_", "_")
                        if key == "GEMINI_API_KEY":
                            creds["api_key"] = creds["api_key"] or value
                        elif key == "OPENROUTER_API_KEY":
                            creds["openrouter_key"] = creds["openrouter_key"] or value
                        elif key == "GOOGLE_API_KEY":
                            creds["google_api_key"] = creds["google_api_key"] or value
                        elif key in ["VERTEX_AI_PROJECT", "GOOGLE_CLOUD_PROJECT"]:
                            creds["project_id"] = creds["project_id"] or value
                        elif key == "VERTEX_AI_LOCATION":
                            creds["location"] = value
    return creds


def generate_with_vertex_ai(
    prompt: str,
    model_id: str,
    width: int,
    height: int,
    output_path: str,
    creds: Dict[str, str],
    count: int = 1,
) -> Dict[str, Any]:
    """Generate image using Vertex AI Imagen endpoint (Premium)."""
    if not creds.get("project_id"):
        return {"success": False, "error": "VERTEX_AI_PROJECT not set. Required for premium Imagen models."}

    url = VERTEX_AI_URL.format(
        location=creds["location"],
        project=creds["project_id"],
        model=model_id,
    )

    # Get access token (requires gcloud auth)
    access_token = creds.get("access_token")
    if not access_token:
        # Try to get from gcloud
        try:
            import subprocess
            result = subprocess.run(
                ["gcloud", "auth", "print-access-token"],
                capture_output=True,
                text=True,
                timeout=10,
            )
            if result.returncode == 0:
                access_token = result.stdout.strip()
        except Exception:
            pass

    if not access_token:
        return {"success": False, "error": "No access token. Run: gcloud auth application-default login"}

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    payload = {
        "instances": [{
            "prompt": prompt,
        }],
        "parameters": {
            "sampleCount": count,
            "aspectRatio": f"{width}:{height}",
            "safetyFilterLevel": "block_few",
            "personGeneration": "allow_adult",
        }
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=300)

        if response.status_code == 429:
            return {"success": False, "error": "Rate limited. Please wait and try again."}

        if response.status_code == 403:
            return {"success": False, "error": "Access denied. Ensure Imagen API is enabled and you have permissions."}

        if response.status_code != 200:
            return {"success": False, "error": f"API error {response.status_code}: {response.text[:300]}"}

        result = response.json()

        # Extract images from predictions
        predictions = result.get("predictions", [])
        if not predictions:
            return {"success": False, "error": "No images generated"}

        saved_files = []
        for i, pred in enumerate(predictions):
            if "bytesBase64Encoded" in pred:
                image_data = pred["bytesBase64Encoded"]
                image_bytes = base64.b64decode(image_data)

                # Determine output path for multiple images
                if count > 1:
                    out_path = Path(output_path)
                    file_path = out_path.parent / f"{out_path.stem}_{i+1}{out_path.suffix}"
                else:
                    file_path = Path(output_path)

                file_path.parent.mkdir(parents=True, exist_ok=True)
                file_path.write_bytes(image_bytes)
                saved_files.append({
                    "path": str(file_path.absolute()),
                    "size_bytes": len(image_bytes),
                })

        if saved_files:
            return {
                "success": True,
                "files": saved_files,
                "path": saved_files[0]["path"],
                "size_bytes": saved_files[0]["size_bytes"],
                "count": len(saved_files),
            }

        return {"success": False, "error": "No image data in response"}

    except requests.exceptions.Timeout:
        return {"success": False, "error": "Request timed out"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def generate_with_generative_api_openrouter(
    prompt: str,
    output_path: str,
    api_key: str,
) -> Dict[str, Any]:
    """Generate image using OpenRouter API as fallback."""
    url = "https://openrouter.ai/api/v1/chat/completions"

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "https://synthex.ai",
        "X-Title": "Synthex Image Generator",
    }

    payload = {
        "model": "google/gemini-2.0-flash-exp:free",
        "messages": [{
            "role": "user",
            "content": f"Generate a high-quality professional image: {prompt}"
        }],
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=180)

        if response.status_code != 200:
            return {"success": False, "error": f"OpenRouter API error {response.status_code}: {response.text[:300]}"}

        result = response.json()

        if "choices" in result and len(result["choices"]) > 0:
            choice = result["choices"][0]
            message = choice.get("message", {})
            content = message.get("content", "")

            if "base64," in content:
                image_data = content.split("base64,")[1]
                image_bytes = base64.b64decode(image_data)

                output_file = Path(output_path)
                output_file.parent.mkdir(parents=True, exist_ok=True)
                output_file.write_bytes(image_bytes)

                return {
                    "success": True,
                    "path": str(output_file.absolute()),
                    "size_bytes": len(image_bytes),
                    "mime_type": "image/png",
                    "provider": "openrouter",
                }

        return {"success": False, "error": "No image data in OpenRouter response"}

    except Exception as e:
        return {"success": False, "error": str(e)}


def generate_with_generative_api(
    prompt: str,
    model_id: str,
    output_path: str,
    api_key: str,
) -> Dict[str, Any]:
    """Generate image using Generative Language API (fallback)."""
    url = GENERATIVE_API_URL.format(model=model_id)

    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": api_key,
    }

    payload = {
        "contents": [{
            "parts": [{
                "text": f"Generate a high-quality professional image: {prompt}"
            }]
        }],
        "generationConfig": {
            "responseModalities": ["IMAGE", "TEXT"],
        },
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=180)

        if response.status_code != 200:
            return {"success": False, "error": f"API error {response.status_code}: {response.text[:300]}"}

        result = response.json()

        if "candidates" in result and len(result["candidates"]) > 0:
            candidate = result["candidates"][0]
            if "content" in candidate and "parts" in candidate["content"]:
                for part in candidate["content"]["parts"]:
                    if "inlineData" in part:
                        image_data = part["inlineData"]["data"]
                        image_bytes = base64.b64decode(image_data)

                        output_file = Path(output_path)
                        output_file.parent.mkdir(parents=True, exist_ok=True)
                        output_file.write_bytes(image_bytes)

                        return {
                            "success": True,
                            "path": str(output_file.absolute()),
                            "size_bytes": len(image_bytes),
                            "mime_type": part["inlineData"].get("mimeType", "image/png"),
                        }

        return {"success": False, "error": "No image data in response"}

    except Exception as e:
        return {"success": False, "error": str(e)}


def main():
    parser = argparse.ArgumentParser(
        description="Generate images with Imagen 4 Premium models",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
NOTE: This script uses PAID Imagen API endpoints.
      For free tier, use generate_nano_banana.py instead.

Examples:
  python scripts/generate_imagen.py "A sunset over mountains" --model imagen-4-ultra --size 2K
  python scripts/generate_imagen.py "Modern office" --model imagen-4-fast --size 1K
  python scripts/generate_imagen.py "Abstract art" --count 4 --output variations.png
        """
    )
    parser.add_argument("prompt", help="Image description/prompt")
    parser.add_argument(
        "--model", "-m",
        choices=list(MODELS.keys()),
        default="nano-banana-2-pro",
        help="Model variant. Default: nano-banana-2-pro (Gemini 3 Pro Image)"
    )
    parser.add_argument(
        "--size", "-s",
        choices=["1K", "2K", "4K"],
        default="2K",
        help="Output resolution. Default: 2K (4K requires Nano Banana 2 Pro)"
    )
    parser.add_argument(
        "--aspect", "-a",
        choices=["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
        default="16:9",
        help="Aspect ratio. Default: 16:9"
    )
    parser.add_argument(
        "--count", "-c",
        type=int,
        choices=[1, 2, 3, 4],
        default=1,
        help="Number of images to generate. Default: 1"
    )
    parser.add_argument(
        "--output", "-o",
        default=None,
        help="Output file path. Default: output/imagen_{timestamp}.png"
    )

    args = parser.parse_args()

    # Validate resolution for model
    model_config = MODELS[args.model]
    if args.size == "2K" and model_config["max_resolution"] == "1K":
        print(f"WARNING: {model_config['name']} only supports 1K resolution. Using 1K.")
        args.size = "1K"

    # Default output path
    if args.output is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        args.output = f"output/imagen_{timestamp}.png"

    # Get dimensions
    width, height = RESOLUTIONS[args.size].get(args.aspect, (1024, 1024))

    # Header
    print()
    print("=" * 60)
    print(f"  {model_config['name']} — Premium Image Generation")
    print("=" * 60)
    print()
    print(f"  Model:      {args.model} ({model_config['tier'].upper()})")
    print(f"  Resolution: {args.size} ({width}x{height})")
    print(f"  Aspect:     {args.aspect}")
    print(f"  Count:      {args.count}")
    print(f"  Output:     {args.output}")
    print(f"  Prompt:     {args.prompt[:50]}{'...' if len(args.prompt) > 50 else ''}")
    print()
    print("-" * 60)
    print("  NOTE: This uses PAID Imagen APIs.")
    print("  For free tier, use: python scripts/generate_nano_banana.py")
    print("-" * 60)
    print()

    # Get credentials
    creds = get_credentials()

    if not creds.get("api_key") and not creds.get("project_id") and not creds.get("openrouter_key"):
        print("ERROR: No credentials found!")
        print()
        print("For Vertex AI (recommended for Imagen 4):")
        print("  export VERTEX_AI_PROJECT=your-project-id")
        print("  gcloud auth application-default login")
        print()
        print("Or for Generative API:")
        print("  export GEMINI_API_KEY=your-api-key")
        print()
        print("Or for OpenRouter fallback:")
        print("  export OPENROUTER_API_KEY=your-openrouter-key")
        print()
        sys.exit(1)

    print("Generating image...")
    start_time = time.time()

    # Try Vertex AI first (for true Imagen 4), then fallback to Generative API, then OpenRouter
    if creds.get("project_id"):
        print("  Using Vertex AI endpoint (Premium)...")
        result = generate_with_vertex_ai(
            prompt=args.prompt,
            model_id=model_config["id"],
            width=width,
            height=height,
            output_path=args.output,
            creds=creds,
            count=args.count,
        )
    elif creds.get("api_key"):
        print("  Using Generative API endpoint...")
        result = generate_with_generative_api(
            prompt=args.prompt,
            model_id=model_config["id"],
            output_path=args.output,
            api_key=creds["api_key"],
        )
    elif creds.get("openrouter_key"):
        print("  Using OpenRouter API (fallback)...")
        print("  NOTE: OpenRouter uses gemini-2.0-flash-exp, not Imagen 4.")
        # Use OpenRouter with gemini model as fallback
        result = generate_with_generative_api_openrouter(
            prompt=args.prompt,
            output_path=args.output,
            api_key=creds["openrouter_key"],
        )
    else:
        result = {"success": False, "error": "No valid credentials"}

    elapsed = time.time() - start_time
    print()

    if result["success"]:
        print("SUCCESS")
        print("-" * 40)
        print(f"  Path:       {result['path']}")
        print(f"  Size:       {result['size_bytes']:,} bytes")
        if result.get("count", 1) > 1:
            print(f"  Count:      {result['count']} images")
            for i, f in enumerate(result.get("files", [])):
                print(f"    [{i+1}] {f['path']}")
        print(f"  Model:      {model_config['name']} ({model_config['tier']})")
        print(f"  Resolution: {width}x{height}")
        print(f"  Time:       {elapsed:.1f}s")
        print()

        # Write metadata JSON
        meta_path = Path(args.output).with_suffix('.json')
        result["generated_at"] = datetime.now(timezone.utc).isoformat()
        result["prompt"] = args.prompt
        result["model"] = args.model
        result["model_name"] = model_config["name"]
        result["tier"] = model_config["tier"]
        result["resolution"] = args.size
        result["dimensions"] = {"width": width, "height": height}
        result["aspect_ratio"] = args.aspect
        result["elapsed_seconds"] = round(elapsed, 2)
        meta_path.write_text(json.dumps(result, indent=2))
        print(f"  Metadata:   {meta_path}")
    else:
        print("FAILED")
        print("-" * 40)
        print(f"  Error: {result['error']}")
        print()
        print("Troubleshooting:")
        print("  1. Ensure Vertex AI API is enabled in your Google Cloud project")
        print("  2. Run: gcloud auth application-default login")
        print("  3. Check VERTEX_AI_PROJECT is set correctly")
        print("  4. Verify you have Imagen API access (paid tier)")
        print()
        sys.exit(1)

    print()


if __name__ == "__main__":
    main()
