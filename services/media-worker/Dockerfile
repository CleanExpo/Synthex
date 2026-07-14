# media-worker — native ffmpeg in a container (Railway).
FROM node:22-slim

# ffmpeg + ffprobe from the distro (a real package manager exists here — the
# whole reason this runs on Railway rather than the constrained build Mac).
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY server.mjs ./

ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.mjs"]
