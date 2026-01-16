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

**Current Phase**: Project Setup

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for detailed implementation phases and progress.

## 🔗 Links

- **GitHub Repository**: https://github.com/cf-vnkr/autoblog
- **Live Site**: https://cfdemo.site (coming soon)
- **Source Blog**: https://blog.cloudflare.com

## 📄 License

MIT

---

**Powered by**: Cloudflare Workers • Workers AI • Cloudflare Pages
