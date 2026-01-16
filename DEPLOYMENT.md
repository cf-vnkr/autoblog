# Deployment Guide

This guide walks through deploying the Autoblog Worker to Cloudflare.

## Prerequisites

- Cloudflare account (free tier works)
- Wrangler CLI installed (already included in the project)
- Access to Cloudflare dashboard

## Step 1: Authenticate with Cloudflare

```bash
cd worker
npx wrangler login
```

This will open a browser window for authentication. Follow the prompts to log in to your Cloudflare account.

Verify authentication:

```bash
npx wrangler whoami
```

## Step 2: Create KV Namespaces

Create the production KV namespace:

```bash
npx wrangler kv namespace create PROCESSED_POSTS
```

You'll see output like:

```
{ binding = "PROCESSED_POSTS", id = "abc123def456..." }
```

Create the preview KV namespace:

```bash
npx wrangler kv namespace create PROCESSED_POSTS --preview
```

You'll see output like:

```
{ binding = "PROCESSED_POSTS", preview_id = "xyz789..." }
```

**Save both IDs** - you'll need them in the next step.

## Step 3: Update wrangler.jsonc

Edit `worker/wrangler.jsonc` and uncomment the KV namespace section, then add your IDs:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "autoblog-scraper",
  "main": "src/index.ts",
  "compatibility_date": "2026-01-16",
  "triggers": {
    "crons": ["0 0 * * *"],
  },
  "kv_namespaces": [
    {
      "binding": "PROCESSED_POSTS",
      "id": "YOUR_PRODUCTION_ID_HERE",
      "preview_id": "YOUR_PREVIEW_ID_HERE",
    },
  ],
  "ai": {
    "binding": "AI",
  },
  "vars": {
    "RSS_FEED_URL": "https://blog.cloudflare.com/rss",
    "POSTS_TO_FETCH": "20",
  },
}
```

Replace `YOUR_PRODUCTION_ID_HERE` and `YOUR_PREVIEW_ID_HERE` with the IDs from Step 2.

## Step 4: Deploy the Worker

Deploy to Cloudflare:

```bash
npx wrangler deploy
```

You'll see output showing the deployment progress and the worker URL:

```
Published autoblog-scraper (0.01 sec)
  https://autoblog-scraper.<your-subdomain>.workers.dev
```

## Step 5: Test the Deployed Worker

Test the health endpoint:

```bash
curl https://autoblog-scraper.<your-subdomain>.workers.dev/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2026-01-16T16:40:00.000Z",
  "config": {
    "feedUrl": "https://blog.cloudflare.com/rss",
    "postsToFetch": "20",
    "kvEnabled": true,
    "aiEnabled": true
  }
}
```

Test the RSS parser:

```bash
curl https://autoblog-scraper.<your-subdomain>.workers.dev/test
```

Expected: JSON array with 3 blog posts from the Cloudflare blog.

Test KV storage:

```bash
curl https://autoblog-scraper.<your-subdomain>.workers.dev/test-kv
```

Expected response:

```json
{
  "message": "KV is working",
  "processedPostCount": 0
}
```

## Step 6: Set Up GitHub Secrets (Optional for Now)

These are needed for Phase 5 (GitHub Publisher). You can set these later:

```bash
# Create a GitHub Personal Access Token with 'repo' permissions
# Then set the secrets:
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put GITHUB_OWNER
npx wrangler secret put GITHUB_REPO
```

## Verify Cron Trigger

Check that the cron trigger is configured:

```bash
npx wrangler deployments list
```

The cron trigger runs at midnight UTC daily. You won't see it execute until then, but you can check the Cloudflare dashboard:

1. Go to Workers & Pages
2. Click on `autoblog-scraper`
3. Go to Logs to see execution logs

## Troubleshooting

### Authentication Issues

```bash
# If authentication fails, try logging out and back in:
npx wrangler logout
npx wrangler login
```

### KV Namespace Issues

```bash
# List all KV namespaces:
npx wrangler kv namespace list
```

### Viewing Logs

```bash
# Tail worker logs in real-time:
npx wrangler tail
```

### Deployment Errors

- Check `wrangler.jsonc` for syntax errors
- Ensure KV namespace IDs are correct
- Verify you have the correct permissions in Cloudflare

## Updating the Worker

After making code changes:

```bash
npm run build:worker  # Type check
npm test --workspace=worker  # Run tests
npx wrangler deploy  # Deploy updates
```

## Rollback

If something goes wrong:

```bash
# List deployments
npx wrangler deployments list

# Rollback to a previous deployment
npx wrangler rollback [deployment-id]
```

## Next Steps

After successful deployment:

1. ✅ Worker is deployed and can fetch RSS feeds
2. ✅ KV storage is working
3. 🔄 Continue with Phase 4: AI Summarizer
4. 🔄 Continue with Phase 5: GitHub Publisher
5. 🔄 Deploy Astro site to Cloudflare Pages
