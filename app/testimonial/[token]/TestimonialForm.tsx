'use client';

/**
 * TestimonialForm — Client component
 *
 * Standalone branded form for collecting customer testimonials.
 * Handles text, star rating, photo uploads (up to 3), and optional
 * video upload or YouTube URL.
 */

import { useState, useEffect, useRef } from 'react';
import { Star, Upload, Video, CheckCircle, AlertCircle, X } from 'lucide-react';

interface FormConfig {
  title: string;
  subtitle: string;
  businessName: string;
}

interface Props {
  paramsPromise: Promise<{ token: string }>;
}

export function TestimonialForm({ paramsPromise }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [config, setConfig] = useState<FormConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Resolve token and load config
  useEffect(() => {
    paramsPromise.then(({ token: t }) => {
      setToken(t);
      fetch(`/api/public/testimonials/${t}`)
        .then(r => {
          if (!r.ok)
            return r.json().then(d => {
              throw new Error(d.error ?? 'Not found');
            });
          return r.json();
        })
        .then((data: FormConfig) => setConfig(data))
        .catch(err => setError((err as Error).message));
    });
  }, [paramsPromise]);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const combined = [...photos, ...files].slice(0, 3);
    setPhotos(combined);
    const previews = combined.map(f => URL.createObjectURL(f));
    setPhotoPreviews(previews);
  }

  function removePhoto(index: number) {
    const next = photos.filter((_, i) => i !== index);
    setPhotos(next);
    setPhotoPreviews(next.map(f => URL.createObjectURL(f)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: string[] = [];
    if (!name.trim()) errs.push('Name is required.');
    if (rating === 0) errs.push('Please select a star rating.');
    if (text.trim().length < 10)
      errs.push('Please write at least 10 characters.');
    if (errs.length > 0) {
      setValidationErrors(errs);
      return;
    }
    setValidationErrors([]);

    setSubmitting(true);
    const fd = new FormData();
    fd.append('name', name.trim());
    fd.append('email', email.trim());
    fd.append('rating', String(rating));
    fd.append('text', text.trim());
    photos.forEach((p, i) => fd.append(`photo_${i}`, p));
    if (video) fd.append('video', video);
    if (youtubeUrl.trim()) fd.append('youtube_url', youtubeUrl.trim());

    try {
      const res = await fetch(`/api/public/testimonials/${token}`, {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? 'Submission failed');
      }
      setSubmitted(true);
    } catch (err) {
      setValidationErrors([(err as Error).message]);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading / error states ─────────────────────────────────────────────────

  if (!config && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950">
        <div className="w-6 h-6 border-2 border-orange-500/50 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950 px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
          <h1 className="text-xl font-light text-white">{error}</h1>
          <p className="text-sm text-white/50">
            This link may have expired or been removed.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950 px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto" />
          <h1 className="text-2xl font-light text-white">Thank you!</h1>
          <p className="text-sm text-white/60">
            Your testimonial for{' '}
            <span className="text-white">{config!.businessName}</span> has been
            received and will be reviewed shortly.
          </p>
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-neutral-950 py-12 px-4">
      <div className="max-w-lg mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-xs uppercase tracking-widest text-orange-400">
            {config!.businessName}
          </p>
          <h1 className="text-2xl font-light text-white">{config!.title}</h1>
          <p className="text-sm text-white/50">{config!.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <div className="border border-red-500/30 bg-red-500/5 rounded-sm p-3 space-y-1">
              {validationErrors.map((e, i) => (
                <p key={i} className="text-xs text-red-400">
                  {e}
                </p>
              ))}
            </div>
          )}

          {/* Star rating */}
          <div className="space-y-2">
            <label className="text-xs text-white/60 uppercase tracking-wider">
              Your Rating <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHoveredStar(n)}
                  onMouseLeave={() => setHoveredStar(0)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-7 w-7 transition-colors ${
                      n <= (hoveredStar || rating)
                        ? 'text-orange-400 fill-orange-400'
                        : 'text-white/20'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs text-white/60 uppercase tracking-wider">
              Your Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-sm px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-500/40 focus:bg-white/[0.06] transition-colors"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-xs text-white/60 uppercase tracking-wider">
              Email (optional)
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="jane@example.com"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-sm px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-500/40 focus:bg-white/[0.06] transition-colors"
            />
          </div>

          {/* Testimonial text */}
          <div className="space-y-1.5">
            <label className="text-xs text-white/60 uppercase tracking-wider">
              Your Experience <span className="text-red-400">*</span>
            </label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Tell us about your experience..."
              rows={5}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-sm px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-500/40 focus:bg-white/[0.06] transition-colors resize-none"
            />
            <p className="text-right text-[10px] text-white/30">
              {text.length} / 2000
            </p>
          </div>

          {/* Photo uploads */}
          <div className="space-y-2">
            <label className="text-xs text-white/60 uppercase tracking-wider">
              Photos (optional, up to 3)
            </label>
            <div className="flex flex-wrap gap-2">
              {photoPreviews.map((src, i) => (
                <div key={i} className="relative h-20 w-20">
                  <img
                    src={src}
                    alt={`Photo ${i + 1}`}
                    className="h-20 w-20 object-cover rounded-sm border border-white/[0.08]"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 flex items-center justify-center"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              ))}
              {photos.length < 3 && (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="h-20 w-20 border border-dashed border-white/[0.12] rounded-sm flex flex-col items-center justify-center gap-1 text-white/30 hover:text-white/50 hover:border-white/20 transition-colors"
                >
                  <Upload className="h-5 w-5" />
                  <span className="text-[10px]">Add</span>
                </button>
              )}
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>

          {/* Video */}
          <div className="space-y-2">
            <label className="text-xs text-white/60 uppercase tracking-wider">
              Video Testimonial (optional)
            </label>
            <div className="space-y-2">
              {/* YouTube URL */}
              <input
                type="url"
                value={youtubeUrl}
                onChange={e => {
                  setYoutubeUrl(e.target.value);
                  if (e.target.value) setVideo(null);
                }}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-sm px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-500/40 focus:bg-white/[0.06] transition-colors"
              />
              <p className="text-[10px] text-white/30">
                — or upload an MP4 file (max 100 MB) —
              </p>
              <button
                type="button"
                onClick={() => {
                  if (!youtubeUrl) videoInputRef.current?.click();
                }}
                disabled={!!youtubeUrl}
                className="flex items-center gap-2 text-sm text-white/50 hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Video className="h-4 w-4" />
                {video ? video.name : 'Choose video file'}
              </button>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4"
                className="hidden"
                onChange={e => {
                  setVideo(e.target.files?.[0] ?? null);
                  setYoutubeUrl('');
                }}
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-orange-500 hover:bg-orange-400 disabled:bg-orange-500/40 text-white text-sm font-medium rounded-sm transition-colors"
          >
            {submitting ? 'Submitting…' : 'Submit Testimonial'}
          </button>
        </form>

        <p className="text-center text-[10px] text-white/25">
          Powered by Synthex
        </p>
      </div>
    </div>
  );
}
