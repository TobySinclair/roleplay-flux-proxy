# RealTalk Studio FLUX Proxy

Minimal Deepgram FLUX proxy server for ultra-low latency speech-to-text.

## Features

- 🚀 Ultra-fast speech-to-text with Deepgram FLUX
- 🔌 WebSocket proxy for secure API key handling
- ⚡ Eager End of Turn (EOT) processing
- 🛡️ Built-in error handling and reconnection
- 📊 Health check endpoint

## Quick Start

1. **Set environment variables:**
   ```bash
   DEEPGRAM_API_KEY=your_deepgram_api_key
   FLUX_PROXY_PORT=3001
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

## Railway Deployment

This repository is optimized for Railway deployment:

- **Minimal dependencies** (only `ws` and `dotenv`)
- **Small file size** (~5MB vs 270MB+ for full Next.js app)
- **Fast deployment** (builds in seconds)
- **Automatic HTTPS/WSS** handling

## Usage

Connect your client to: `wss://your-app.up.railway.app`

With parameters:
```
wss://your-app.up.railway.app?model=flux-general-en&encoding=linear16&sample_rate=16000&eager_eot_threshold=0.6&eot_threshold=0.8&eot_timeout_ms=7000
```

## Health Check

Visit: `https://your-app.up.railway.app/health`

## Environment Variables

- `DEEPGRAM_API_KEY` - Your Deepgram API key (required)
- `FLUX_PROXY_PORT` - Port to run on (default: 3001)
- `NEXT_PUBLIC_FLUX_PROXY_URL` - Public WebSocket URL (set by Railway)
