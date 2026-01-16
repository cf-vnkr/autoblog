# Cloudflare Pages Deployment Guide

This guide walks through deploying the Autoblog Astro site to Cloudflare Pages.

## Prerequisites

- Code pushed to GitHub repository: `cf-vnkr/autoblog`
- Cloudflare account with access to Pages
- Custom domain: `cfdemo.site` (optional)

## Step 1: Push Code to GitHub

Ensure all code is committed and pushed:

```bash
git add .
git commit -m "feat: complete autoblog implementation"
git push origin main
```

## Step 2: Connect Repository to Cloudflare Pages

1. **Navigate to Cloudflare Dashboard**:
   - Go to: https://dash.cloudflare.com
   - Select your account
   - Click **Workers & Pages** in the left sidebar

2. **Create Pages Project**:
   - Click **"Create application"**
   - Select **"Pages"**
   - Click **"Connect to Git"**

3. **Connect GitHub**:
   - Select **GitHub** as the git provider
   - Authorize Cloudflare Pages if this is your first time
   - Select repository: **`cf-vnkr/autoblog`**
   - Click **"Begin setup"**

## Step 3: Configure Build Settings

Use these exact settings:

```
Project name:           autoblog
Production branch:      main
Framework preset:       Astro
Build command:          npm run build
Build output directory: site/dist
Root directory:         site
```

### Advanced Settings (expand):

```
Node version:           18 (or 20)
Environment variables:  (none required)
```

### Explanation:
- **Root directory: `site`** - This tells Pages to build from the `site/` subdirectory
- **Build command: `npm run build`** - Runs `astro build`
- **Output: `site/dist`** - Where Astro outputs static files (relative to repo root)

## Step 4: Deploy

1. Click **"Save and Deploy"**
2. Watch the build logs
3. Build should complete in ~1-2 minutes

### Expected Build Output:

```
✓ Installing dependencies
✓ Building site (npm run build)
✓ Deployed to: autoblog.pages.dev
```

## Step 5: Verify Deployment

Visit your Pages URL (will be shown after deployment):
- `https://autoblog.pages.dev`

You should see:
- ✅ Homepage with blog post summaries
- ✅ Header with logo and title
- ✅ Footer with links
- ✅ NLWeb chat widget in bottom right
- ✅ Post detail pages working

## Step 6: Set Up Custom Domain (cfdemo.site)

1. **Add Custom Domain**:
   - In your Pages project, go to **"Custom domains"**
   - Click **"Set up a custom domain"**
   - Enter: `cfdemo.site`
   - Click **"Continue"**

2. **Configure DNS**:
   
   If your domain is on Cloudflare:
   - DNS records will be added automatically
   - Just confirm the CNAME setup

   If your domain is elsewhere:
   - Add a CNAME record:
     ```
     Name:  cfdemo.site (or @)
     Type:  CNAME
     Value: autoblog.pages.dev
     ```

3. **Enable HTTPS**:
   - Cloudflare automatically provisions SSL certificate
   - This happens automatically within ~5 minutes

4. **Wait for DNS Propagation**:
   - Usually takes 5-10 minutes
   - Check status in Pages dashboard

## Step 7: Enable Automatic Deployments

Already configured! Cloudflare Pages will automatically:
- ✅ Rebuild on every push to `main` branch
- ✅ Deploy preview for pull requests
- ✅ Invalidate cache when content changes

## Step 8: Test the Full Workflow

Now that everything is deployed, test the complete system:

1. **Trigger Worker Manually** (or wait for midnight UTC):
   ```bash
   curl https://autoblog-scraper.vnkr.workers.dev/test-github
   ```

2. **Check GitHub**:
   - New JSON file appears in `site/content/posts/`
   - Commit triggers Pages rebuild

3. **Check Pages Deployment**:
   - Go to Pages dashboard
   - See new deployment triggered
   - Wait ~1-2 minutes for build

4. **Visit Site**:
   - Go to `https://cfdemo.site`
   - See new post appears on homepage
   - Click through to post detail page

## Troubleshooting

### Build Fails

Check build logs in Pages dashboard. Common issues:

**Error: `Cannot find module 'astro'`**
- Fix: Ensure `package.json` is in `site/` directory
- Verify `Root directory` is set to `site`

**Error: `No such file or directory: site/dist`**
- Fix: Check `Build output directory` is set correctly
- Should be `site/dist` (relative to repo root)

**Error: `Failed to load posts`**
- This is OK! Site will show "No posts available yet"
- Worker will populate posts on next run

### Site Deployed But Shows No Posts

Expected behavior! The site needs content:
- Worker runs daily at midnight UTC
- Or trigger manually via `/test-github` endpoint
- First post is already published to GitHub

### Custom Domain Not Working

- Check DNS settings in Cloudflare dashboard
- Verify CNAME record points to `autoblog.pages.dev`
- Wait up to 24 hours for DNS propagation
- Check SSL certificate status

### Build Takes Too Long

Normal build time: 1-2 minutes
- If longer, check for errors in build logs
- Verify all dependencies are in `package.json`

## Pages Build Configuration Reference

For reference, here's the full configuration:

```yaml
# .pages/config.yml (auto-generated)
production_branch: main
preview_branch_includes: ['*']
preview_branch_excludes: []

build:
  command: npm run build
  destination: site/dist
  root_dir: site

deployment:
  compatibility_flags: []
  compatibility_date: 2026-01-16
```

## Next Steps

After successful deployment:

1. ✅ Site is live at `cfdemo.site`
2. ✅ Worker runs daily at midnight UTC
3. ✅ New posts automatically appear on site
4. ✅ NLWeb chat widget is functional

## Monitoring

Check deployment status:
- Pages Dashboard: https://dash.cloudflare.com → Workers & Pages → autoblog
- Build logs: Click on any deployment
- Analytics: Available in Pages dashboard

## Useful Links

- **Live Site**: https://cfdemo.site
- **Worker**: https://autoblog-scraper.vnkr.workers.dev
- **GitHub Repo**: https://github.com/cf-vnkr/autoblog
- **Pages Dashboard**: https://dash.cloudflare.com

---

**Status**: Ready for deployment!
