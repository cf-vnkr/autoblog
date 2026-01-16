# Cloudflare Workers Autoblog - Implementation Plan

## Project Overview

An automated blog scraper that fetches the latest posts from the Cloudflare blog, generates AI summaries using Workers AI, and publishes them to a static site hosted on Cloudflare Pages at `cfdemo.site`.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Cloudflare Worker (Cron: Daily at Midnight UTC)       │
│  ├─ Fetch RSS from blog.cloudflare.com/rss             │
│  ├─ Check Workers KV for processed posts               │
│  ├─ For new posts (initially last 20):                 │
│  │  ├─ Generate summary with Workers AI (Llama 3.1)   │
│  │  ├─ Store post data as JSON in GitHub repo         │
│  │  └─ Mark as processed in KV                        │
│  └─ Trigger Pages rebuild via GitHub commit           │
│                                                         │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  GitHub Repository                                     │
│  └─ /content/posts/*.json (summaries + metadata)      │
│                                                         │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Cloudflare Pages (cfdemo.site)                        │
│  └─ Astro Static Site Generator                       │
│     ├─ Reads JSON posts at build time                 │
│     ├─ Generates static HTML pages                    │
│     └─ Deploys automatically on git push              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Project Structure

```
autoblog/
├── worker/                          # Cloudflare Worker (scraper + AI)
│   ├── src/
│   │   ├── index.ts                # Main worker with scheduled handler
│   │   ├── rss-parser.ts           # Parse RSS feed
│   │   ├── ai-summarizer.ts        # Generate summaries with Workers AI
│   │   ├── github-publisher.ts     # Commit JSON files to GitHub
│   │   └── types.ts                # TypeScript types
│   ├── wrangler.jsonc              # Worker configuration
│   ├── package.json
│   └── tsconfig.json
│
├── site/                            # Astro static site
│   ├── src/
│   │   ├── pages/
│   │   │   ├── index.astro         # Homepage (list of posts)
│   │   │   └── post/[slug].astro   # Individual post page
│   │   ├── layouts/
│   │   │   └── Layout.astro        # Base layout
│   │   └── components/
│   │       ├── PostCard.astro      # Post preview component
│   │       └── Header.astro        # Site header
│   ├── content/
│   │   └── posts/                  # JSON files (created by worker)
│   │       └── *.json
│   ├── public/
│   │   └── favicon.svg
│   ├── astro.config.mjs
│   ├── package.json
│   └── tsconfig.json
│
├── package.json                     # Root package.json (workspace)
├── .gitignore
├── AGENTS.md                        # Agent guidelines
├── IMPLEMENTATION_PLAN.md           # This file
└── README.md
```

## Technology Stack

### Worker (Scraper + AI Summarizer)

- **Runtime**: Cloudflare Workers
- **Language**: TypeScript
- **Tooling**: Wrangler CLI
- **AI Model**: Workers AI with Llama 3.1 8B Instruct (`@cf/meta/llama-3.1-8b-instruct`)
- **Storage**: Workers KV (track processed posts)
- **Trigger**: Cron (`0 0 * * *` - midnight UTC daily)
- **External APIs**:
  - Cloudflare Blog RSS (blog.cloudflare.com/rss)
  - GitHub API (create/update files)

### Static Site (Astro)

- **Framework**: Astro 5.x (latest stable)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Hosting**: Cloudflare Pages
- **Domain**: cfdemo.site
- **Theme**: Light theme, simple and readable

### Storage & Services

- **Workers KV**: Store processed post IDs and metadata
- **GitHub**: Version control + trigger Cloudflare Pages deployments
- **Workers AI**: Generate post summaries
- **Cloudflare Pages**: Build and host static site

## Implementation Phases

### Phase 1: Project Setup ✓

**Goal**: Initialize monorepo with proper structure and tooling

1. Initialize git repository
2. Create GitHub repository
3. Set up npm workspaces in root `package.json`
4. Create `worker/` subdirectory with Wrangler
5. Create `site/` subdirectory with Astro
6. Configure TypeScript for both workspaces
7. Set up ESLint and Prettier
8. Create `.gitignore` file

**Deliverables**:

- Working monorepo structure
- Both workspaces can build independently
- Linting and formatting configured

### Phase 2: Worker - RSS Parser

**Goal**: Fetch and parse Cloudflare blog RSS feed

1. Create RSS parser module (`rss-parser.ts`)
2. Fetch feed from `https://blog.cloudflare.com/rss`
3. Parse XML using native APIs or lightweight library
4. Extract fields for each post:
   - `title` (string)
   - `link` (URL)
   - `guid` (unique identifier)
   - `pubDate` (ISO 8601 date)
   - `description` (string - excerpt)
   - `content:encoded` (string - full HTML content)
   - `category` (array of strings)
   - `dc:creator` (array of authors)
5. Return structured `BlogPost[]` array
6. Implement error handling for network failures
7. Add unit tests

**Deliverables**:

- `rss-parser.ts` module with types
- Tested RSS parsing logic
- Error handling for malformed feeds

### Phase 3: Worker - KV Storage Integration

**Goal**: Track which posts have been processed

1. Define KV namespace binding in `wrangler.jsonc`
2. Create utility functions for KV operations:
   - `isPostProcessed(guid: string): Promise<boolean>`
   - `markPostProcessed(guid: string, metadata: object): Promise<void>`
   - `getProcessedPosts(): Promise<string[]>`
3. Key schema: `post:{guid}`
4. Value schema: `{ processed: true, timestamp: ISO8601, title: string }`
5. Implement TTL strategy (optional, for cleanup)
6. Add error handling for KV failures

**Deliverables**:

- KV utility module with types
- Namespace created in Cloudflare
- Integration tested locally with Wrangler

### Phase 4: Worker - AI Summarizer

**Goal**: Generate summaries using Workers AI

1. Create AI summarizer module (`ai-summarizer.ts`)
2. Configure Workers AI binding in `wrangler.jsonc`
3. Implement prompt engineering:

   ```
   System: You are a technical content summarizer for a developer blog.

   User: Summarize the following Cloudflare blog post in 2-3 concise paragraphs.
   Focus on the key technical details, main announcements, and practical implications
   for developers. Write in clear, professional language.

   Title: {title}
   Content: {content}
   ```

4. Call Workers AI with model `@cf/meta/llama-3.1-8b-instruct`
5. Extract summary text from response
6. Add disclaimer prefix: "**AI-Generated Summary**: This is an automated summary of a Cloudflare blog post..."
7. Implement retry logic for AI failures
8. Add character limits and validation
9. Handle edge cases (very short/long content)

**Deliverables**:

- `ai-summarizer.ts` module
- Tested prompt template
- Error handling for AI service

### Phase 5: Worker - GitHub Publisher

**Goal**: Commit post JSON files to GitHub repository

1. Create GitHub publisher module (`github-publisher.ts`)
2. Set up GitHub Personal Access Token as Worker secret
3. Implement GitHub API integration:
   - Get repository default branch
   - Check if file exists
   - Create/update file via Contents API
   - Create commit with message
4. JSON file schema:
   ```json
   {
     "slug": "human-native-joins-cloudflare",
     "title": "Human Native is joining Cloudflare",
     "url": "https://blog.cloudflare.com/human-native-joins-cloudflare/",
     "publishedAt": "2026-01-15T14:00:00Z",
     "summary": "**AI-Generated Summary**: ...",
     "authors": ["Will Allen", "James Smith"],
     "categories": ["AI", "Generative AI", "Data"],
     "guid": "Szd19ssv1kbKxjxNZhUmR"
   }
   ```
5. File naming: `{slug}.json` in `site/content/posts/`
6. Commit message: `feat: add summary for "{title}"`
7. Implement rate limiting awareness
8. Add error handling for GitHub API

**Deliverables**:

- `github-publisher.ts` module
- GitHub token configuration
- Tested file creation/updates

### Phase 6: Worker - Scheduled Handler

**Goal**: Orchestrate the full workflow on cron schedule

1. Implement `scheduled()` export in `index.ts`
2. Workflow logic:

   ```typescript
   export default {
     async scheduled(event, env, ctx) {
       // 1. Fetch RSS feed
       const posts = await fetchBlogPosts();

       // 2. Get last 20 posts (or filter new ones)
       const postsToProcess = posts.slice(0, 20);

       // 3. For each post:
       for (const post of postsToProcess) {
         // Check if already processed
         if (await env.KV.isProcessed(post.guid)) continue;

         // Generate AI summary
         const summary = await generateSummary(post, env.AI);

         // Publish to GitHub
         await publishToGitHub(post, summary, env);

         // Mark as processed
         await env.KV.markProcessed(post.guid);
       }
     },
   };
   ```

3. Add comprehensive logging
4. Implement error boundaries (continue on single post failure)
5. Add execution time tracking
6. Configure cron trigger in `wrangler.jsonc`

**Deliverables**:

- Complete Worker implementation
- Cron trigger configured
- Error handling and logging

### Phase 7: Astro Site - Project Setup

**Goal**: Initialize Astro site with Tailwind CSS

1. Create Astro project in `site/`
2. Install dependencies:
   - `astro`
   - `@astrojs/tailwind`
   - `tailwindcss`
3. Configure `astro.config.mjs`:
   - Set `site` to `https://cfdemo.site`
   - Configure Tailwind integration
   - Set `output: 'static'`
4. Set up Tailwind config for light theme:
   - Clean, readable typography
   - Professional color palette
   - Responsive breakpoints
5. Create base layout (`Layout.astro`)
6. Design system tokens (spacing, colors, fonts)
7. **IMPORTANT**: Add NLWeb chat widget integration in `Layout.astro` `<head>` section:

   ```html
   <!-- NLWeb Chat Widget CSS -->
   <link rel="stylesheet" href="https://ask.cfdemo.site/nlweb-dropdown-chat.css" />
   <link rel="stylesheet" href="https://ask.cfdemo.site/common-chat-styles.css" />
   ```

   And before closing `</body>` tag:

   ```html
   <!-- NLWeb Chat Widget Container -->
   <div id="docs-search-container"></div>

   <!-- NLWeb Chat Widget JavaScript -->
   <script type="module">
     import { NLWebDropdownChat } from 'https://ask.cfdemo.site/nlweb-dropdown-chat.js';

     const chat = new NLWebDropdownChat({
       containerId: 'docs-search-container',
       site: 'https://ask.cfdemo.site',
       placeholder: 'Search for docs...',
       endpoint: 'https://ask.cfdemo.site',
     });
   </script>
   ```

**Deliverables**:

- Working Astro dev server
- Tailwind CSS configured
- Base layout component with NLWeb chat widget integrated

### Phase 8: Astro Site - Content Schema & Utils

**Goal**: Load and validate post JSON files

1. Create TypeScript types for posts:
   ```typescript
   interface BlogPost {
     slug: string;
     title: string;
     url: string;
     publishedAt: string;
     summary: string;
     authors: string[];
     categories: string[];
     guid: string;
   }
   ```
2. Create utility functions:
   - `getAllPosts(): Promise<BlogPost[]>`
   - `getPostBySlug(slug: string): Promise<BlogPost | null>`
   - `sortPostsByDate(posts: BlogPost[]): BlogPost[]`
3. Read JSON files from `content/posts/` directory
4. Implement caching for build performance
5. Add validation for required fields

**Deliverables**:

- Content utility module
- Type definitions
- Post loading logic

### Phase 9: Astro Site - Homepage

**Goal**: Display list of summarized blog posts

1. Create `src/pages/index.astro`
2. Layout structure:
   - Header with site title: "Cloudflare Blog Summaries"
   - Subtitle: "AI-powered summaries of the latest Cloudflare blog posts"
   - Post list (cards)
   - Footer with credits
3. Post card component (`PostCard.astro`):
   - Title (linked to detail page)
   - Published date (formatted)
   - Categories (badges)
   - Summary excerpt (first 200 chars)
   - "Read more →" link
4. Styling:
   - Light theme
   - Clean typography (system fonts or Inter)
   - Card shadows for depth
   - Responsive grid layout
5. Sort posts by date (newest first)
6. Add pagination if >20 posts

**Deliverables**:

- Homepage with post list
- Post card component
- Responsive design

### Phase 10: Astro Site - Post Detail Page

**Goal**: Display individual post with full summary

1. Create dynamic route: `src/pages/post/[slug].astro`
2. Layout structure:
   - Back button to homepage
   - Post title (h1)
   - Metadata bar (date, authors, categories)
   - AI disclaimer badge
   - Full summary (formatted paragraphs)
   - CTA button: "Read full post on Cloudflare Blog →"
   - Related posts (optional)
3. Implement `getStaticPaths()` for SSG
4. Handle 404 for missing posts
5. Add OpenGraph meta tags for sharing
6. Implement proper heading hierarchy

**Deliverables**:

- Post detail page
- Dynamic routing
- SEO meta tags

### Phase 11: Astro Site - Header & Footer

**Goal**: Create consistent site navigation and branding

1. Header component (`Header.astro`):
   - Site logo/title (linked to home)
   - Navigation (if needed)
   - Minimal, clean design
2. Footer component:
   - Copyright notice
   - Link to Cloudflare blog
   - "Powered by Cloudflare Workers AI & Pages"
   - GitHub repository link (optional)
3. Integrate into `Layout.astro`
4. Ensure responsive design

**Deliverables**:

- Header component
- Footer component
- Consistent layout

### Phase 12: Deployment - Worker

**Goal**: Deploy Worker to Cloudflare

1. Create KV namespace:
   ```bash
   wrangler kv namespace create PROCESSED_POSTS
   wrangler kv namespace create PROCESSED_POSTS --preview
   ```
2. Update `wrangler.jsonc` with KV namespace IDs
3. Create GitHub Personal Access Token:
   - Permissions: `repo` (full control)
   - Store securely
4. Set Worker secrets:
   ```bash
   wrangler secret put GITHUB_TOKEN
   wrangler secret put GITHUB_OWNER
   wrangler secret put GITHUB_REPO
   ```
5. Deploy Worker:
   ```bash
   cd worker
   wrangler deploy
   ```
6. Verify cron trigger in dashboard
7. Test manual trigger:
   ```bash
   wrangler dev --test-scheduled
   curl "http://localhost:8787/__scheduled"
   ```

**Deliverables**:

- Worker deployed to production
- Cron trigger active
- Secrets configured

### Phase 13: Deployment - Astro Site

**Goal**: Deploy site to Cloudflare Pages

1. Connect GitHub repository to Cloudflare Pages:
   - Go to Pages dashboard
   - Create new project
   - Connect GitHub account
   - Select repository
2. Configure build settings:
   - Framework preset: Astro
   - Build command: `npm run build`
   - Build output directory: `site/dist`
   - Root directory: `site`
   - Node version: 18 or 20
3. Set up custom domain:
   - Add `cfdemo.site` to Pages project
   - Configure DNS (if needed)
   - Enable HTTPS
4. Enable automatic deployments on git push
5. Test build and deployment

**Deliverables**:

- Site live at cfdemo.site
- Automatic deployments configured
- Custom domain working

### Phase 14: Testing & Validation

**Goal**: End-to-end testing of the full system

1. **Worker Tests**:
   - Test RSS parsing with real feed
   - Test AI summary generation (quality check)
   - Test GitHub file creation
   - Test KV read/write operations
   - Test error handling scenarios
2. **Site Tests**:
   - Test build process
   - Verify all posts load correctly
   - Test responsive design on mobile
   - Validate HTML/CSS
   - Check accessibility (basic)
3. **Integration Tests**:
   - Manually trigger Worker schedule
   - Verify new post appears in GitHub
   - Confirm Pages rebuild triggers
   - Check site updates with new content
4. **Performance Tests**:
   - Worker execution time (<10s)
   - Page load speed (<2s)
   - Lighthouse scores (>90)

**Deliverables**:

- Test results documented
- Bugs fixed
- Performance validated

### Phase 15: Documentation & Polish

**Goal**: Complete documentation and final touches

1. Update `README.md`:
   - Project description
   - Architecture diagram
   - Setup instructions
   - Deployment guide
   - Environment variables
   - Troubleshooting
2. Add code comments for complex logic
3. Create `CHANGELOG.md`
4. Add favicon and OG images
5. Set up error monitoring (optional)
6. Create monitoring dashboard (optional)

**Deliverables**:

- Complete README
- Documented codebase
- Production-ready project

## Post JSON Schema

```typescript
interface BlogPostSummary {
  slug: string; // URL-friendly identifier
  title: string; // Original post title
  url: string; // Link to original Cloudflare blog post
  publishedAt: string; // ISO 8601 date string
  summary: string; // AI-generated summary with disclaimer
  authors: string[]; // Post authors
  categories: string[]; // Post categories/tags
  guid: string; // Unique identifier from RSS
}
```

## Configuration Files

### `worker/wrangler.jsonc`

```json
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "autoblog-scraper",
  "main": "src/index.ts",
  "compatibility_date": "2026-01-16",
  "triggers": {
    "crons": ["0 0 * * *"]
  },
  "kv_namespaces": [
    {
      "binding": "PROCESSED_POSTS",
      "id": "<PRODUCTION_KV_NAMESPACE_ID>",
      "preview_id": "<PREVIEW_KV_NAMESPACE_ID>"
    }
  ],
  "ai": {
    "binding": "AI"
  },
  "vars": {
    "RSS_FEED_URL": "https://blog.cloudflare.com/rss",
    "POSTS_TO_FETCH": "20"
  }
}
```

### `site/astro.config.mjs`

```javascript
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://cfdemo.site',
  integrations: [tailwind()],
  output: 'static',
  build: {
    format: 'directory',
  },
});
```

### Root `package.json`

```json
{
  "name": "autoblog",
  "version": "1.0.0",
  "private": true,
  "workspaces": ["worker", "site"],
  "scripts": {
    "dev:worker": "npm run dev --workspace=worker",
    "dev:site": "npm run dev --workspace=site",
    "build": "npm run build --workspaces",
    "lint": "npm run lint --workspaces",
    "format": "prettier --write \"**/*.{ts,tsx,astro,json,md}\""
  },
  "devDependencies": {
    "prettier": "^3.2.4",
    "prettier-plugin-astro": "^0.13.0"
  }
}
```

## Environment Variables & Secrets

### Worker Secrets (via Wrangler)

- `GITHUB_TOKEN`: GitHub Personal Access Token with `repo` scope
- `GITHUB_OWNER`: GitHub username (e.g., "alex")
- `GITHUB_REPO`: Repository name (e.g., "autoblog")

### Worker Variables (in wrangler.jsonc)

- `RSS_FEED_URL`: "https://blog.cloudflare.com/rss"
- `POSTS_TO_FETCH`: "20"

## Estimated Costs (Cloudflare Free Tier)

All components fit within Cloudflare's free tier:

- **Workers**: 100,000 requests/day (1/day for cron) ✅ FREE
- **Workers KV**: 100,000 reads + 1,000 writes/day ✅ FREE
- **Workers AI**: 10,000 neurons/day (sufficient for 20 summaries) ✅ FREE
- **Pages**: 500 builds/month (30/month for daily updates) ✅ FREE
- **Domain**: cfdemo.site (already owned and configured)

## Timeline Estimate

- **Phase 1-6 (Worker)**: 2-3 days
- **Phase 7-11 (Site)**: 2-3 days
- **Phase 12-13 (Deployment)**: 1 day
- **Phase 14-15 (Testing & Docs)**: 1 day

**Total**: ~6-8 days for full implementation

## Success Criteria

1. ✅ Worker runs daily at midnight UTC
2. ✅ Successfully fetches and parses 20 latest posts from Cloudflare blog RSS
3. ✅ Generates quality AI summaries using Llama 3.1 8B Instruct
4. ✅ Commits post JSON files to GitHub repository
5. ✅ Cloudflare Pages automatically rebuilds on new commits
6. ✅ Site displays posts with clean, readable light theme
7. ✅ All posts include AI disclaimer
8. ✅ Original blog post links work correctly
9. ✅ Site is accessible at cfdemo.site with HTTPS
10. ✅ No errors in Worker or Pages logs

## Future Enhancements (Out of Scope)

- Email notifications for new posts
- RSS feed for the summary blog
- Full-text search functionality
- Advanced filtering (by category, author, date)
- Admin dashboard for manual scraping
- Analytics integration (Cloudflare Web Analytics)
- Comment system (Giscus/Utterances)
- Dark mode toggle
- Reading time estimates
- Social share buttons

---

**Last Updated**: January 16, 2026  
**Status**: Ready for Implementation
