# Cloudflare Blog Autoblog

An automated blog that scrapes the Cloudflare blog RSS feed, generates AI-powered summaries using Workers AI, and publishes them to a static site hosted on Cloudflare Pages.

## 🏗️ Architecture

```
Cloudflare Worker (Cron) → Workers AI → GitHub → Cloudflare Pages
```

- **Worker**: Runs daily at midnight UTC, fetches RSS feed, generates summaries
- **Workers AI**: Llama 3.1 8B Instruct model for summarization
- **Storage**: Workers KV for tracking processed posts
- **Site**: Astro static site with Tailwind CSS (light theme)
- **Hosting**: Cloudflare Pages at [cfdemo.site](https://cfdemo.site)

## 📦 Project Structure

```
autoblog/
├── worker/          # Cloudflare Worker (scraper + AI)
├── site/            # Astro static site
├── IMPLEMENTATION_PLAN.md
├── AGENTS.md
└── README.md
```

## 🚀 Status

**Current Phase**: Phase 4 - Worker AI Summarizer

**Completed**:

- ✅ Phase 1: Project Setup - Monorepo structure, Wrangler, Astro, ESLint, Prettier
- ✅ Phase 2: Worker - RSS Parser with XML parsing
- ✅ Phase 3: Worker - KV Storage Integration

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for detailed implementation phases and progress.

## 🛠️ Development

### Installation

```bash
npm install
```

### Development

```bash
npm run dev:worker   # Start Worker dev server
npm run dev:site     # Start Astro dev server
```

**Note**: External fetches (like RSS feed) may not work in local dev mode due to Wrangler security restrictions. Test endpoints will show an error. To test with real external APIs, deploy to Cloudflare or use `wrangler dev --remote`.

### Testing Worker Endpoints

```bash
# Health check (works locally)
curl http://localhost:8787/health

# Test RSS parser (may fail locally, works when deployed)
curl http://localhost:8787/test

# Test KV storage (requires KV namespace setup)
curl http://localhost:8787/test-kv
```

### Build

```bash
npm run build        # Build all workspaces
npm run build:worker # Build worker only
npm run build:site   # Build site only
```

### Testing

```bash
npm test             # Run all tests
npm test --workspace=worker  # Run worker tests only
```

### Linting & Formatting

```bash
npm run lint         # Lint all workspaces
npm run lint:fix     # Fix linting issues
npm run format       # Format with Prettier
npm run format:check # Check formatting
```

## 🔗 Links

- **GitHub Repository**: https://github.com/cf-vnkr/autoblog
- **Live Site**: https://cfdemo.site (coming soon)
- **Source Blog**: https://blog.cloudflare.com

## 📄 License

MIT

---

**Powered by**: Cloudflare Workers • Workers AI • Cloudflare Pages
