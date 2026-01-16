/**
 * Cloudflare Worker for autoblog scraper
 * Fetches RSS feed, generates AI summaries, and publishes to GitHub
 */

import type { Env } from './types';
import { fetchBlogPosts } from './rss-parser';
import { isPostProcessed, getProcessedPostCount, markPostProcessed } from './kv-storage';
import { generateSummary, isAIAvailable } from './ai-summarizer';
import { createGitHubConfig, createBlogPostSummary, publishToGitHub } from './github-publisher';

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const startTime = Date.now();
    console.log('================================================================================');
    console.log('🤖 Autoblog scraper triggered at:', new Date(event.scheduledTime).toISOString());
    console.log('================================================================================');

    let successCount = 0;
    let failureCount = 0;

    try {
      // Validate required bindings
      if (!isAIAvailable(env.AI)) {
        throw new Error('Workers AI not configured');
      }

      const githubConfig = createGitHubConfig(env);
      if (!githubConfig) {
        throw new Error('GitHub configuration missing (GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO)');
      }

      // Step 1: Fetch RSS feed
      console.log(`\n📡 Step 1: Fetching RSS feed from ${env.RSS_FEED_URL}`);
      const posts = await fetchBlogPosts({
        feedUrl: env.RSS_FEED_URL,
        maxPosts: parseInt(env.POSTS_TO_FETCH, 10),
      });
      console.log(`✅ Fetched ${posts.length} posts from RSS feed`);

      // Step 2: Filter out already processed posts
      console.log('\n🔍 Step 2: Filtering already processed posts');
      let newPosts = posts;
      if (env.PROCESSED_POSTS) {
        const processedCount = await getProcessedPostCount(env.PROCESSED_POSTS);
        console.log(`   Currently tracking ${processedCount} processed posts in KV`);

        newPosts = [];
        for (const post of posts) {
          const processed = await isPostProcessed(env.PROCESSED_POSTS, post.guid);
          if (!processed) {
            newPosts.push(post);
          }
        }
        console.log(`✅ Found ${newPosts.length} new posts to process`);
      } else {
        console.log('⚠️  KV not available - processing all posts');
      }

      if (newPosts.length === 0) {
        console.log('\n✨ No new posts to process. All caught up!');
        console.log(
          '================================================================================',
        );
        return;
      }

      // Step 3-5: Process each new post
      console.log(`\n⚙️  Step 3-5: Processing ${newPosts.length} new posts`);
      console.log('   (Generate summary → Publish to GitHub → Mark as processed)\n');

      for (let i = 0; i < newPosts.length; i++) {
        const post = newPosts[i];
        console.log(`\n📝 Processing post ${i + 1}/${newPosts.length}: "${post.title}"`);

        try {
          // Step 3: Generate AI summary
          console.log('   🤖 Generating AI summary...');
          const summary = await generateSummary(env.AI, post);
          console.log(`   ✅ Generated summary (${summary.length} characters)`);

          // Step 4: Create post summary and publish to GitHub
          console.log('   📤 Publishing to GitHub...');
          const postSummary = createBlogPostSummary(post, summary);
          const published = await publishToGitHub(githubConfig, postSummary);

          if (!published) {
            throw new Error('Failed to publish to GitHub');
          }
          console.log(`   ✅ Published to: site/content/posts/${postSummary.slug}.json`);

          // Step 5: Mark as processed in KV
          if (env.PROCESSED_POSTS) {
            console.log('   💾 Marking as processed in KV...');
            await markPostProcessed(env.PROCESSED_POSTS, post.guid, {
              title: post.title,
              slug: postSummary.slug,
              url: post.link,
            });
            console.log('   ✅ Marked as processed');
          }

          successCount++;
          console.log(`   ✨ Success! (${successCount}/${newPosts.length} completed)`);
        } catch (error) {
          failureCount++;
          console.error(`   ❌ Failed to process post: ${post.title}`);
          console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
          // Continue processing other posts even if one fails
        }
      }

      // Summary
      const duration = Date.now() - startTime;
      console.log(
        '\n================================================================================',
      );
      console.log('📊 Processing Summary:');
      console.log(`   ✅ Successful: ${successCount}`);
      console.log(`   ❌ Failed: ${failureCount}`);
      console.log(`   ⏱️  Duration: ${duration}ms`);
      console.log(
        '================================================================================\n',
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('\n❌ FATAL ERROR in scheduled handler:');
      console.error(error);
      console.error(`⏱️  Failed after ${duration}ms\n`);
      console.log(
        '================================================================================\n',
      );
      throw error;
    }
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
          config: {
            feedUrl: env.RSS_FEED_URL,
            postsToFetch: env.POSTS_TO_FETCH,
            kvEnabled: !!env.PROCESSED_POSTS,
            aiEnabled: !!env.AI,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // Test RSS parser
    if (url.pathname === '/test') {
      try {
        console.log('Fetching RSS feed from:', env.RSS_FEED_URL);
        const posts = await fetchBlogPosts({
          feedUrl: env.RSS_FEED_URL,
          maxPosts: 3,
        });

        console.log(`Successfully fetched ${posts.length} posts`);
        return new Response(JSON.stringify(posts, null, 2), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('Error in /test endpoint:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(
          JSON.stringify({
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
    }

    // Test KV storage
    if (url.pathname === '/test-kv') {
      if (!env.PROCESSED_POSTS) {
        return new Response(JSON.stringify({ error: 'KV namespace not configured' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      try {
        const count = await getProcessedPostCount(env.PROCESSED_POSTS);
        return new Response(
          JSON.stringify({
            message: 'KV is working',
            processedPostCount: count,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(JSON.stringify({ error: errorMessage }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Test AI summarizer
    if (url.pathname === '/test-ai') {
      if (!isAIAvailable(env.AI)) {
        return new Response(JSON.stringify({ error: 'Workers AI not configured' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      try {
        // Fetch one post to summarize
        const posts = await fetchBlogPosts({
          feedUrl: env.RSS_FEED_URL,
          maxPosts: 1,
        });

        if (posts.length === 0) {
          return new Response(JSON.stringify({ error: 'No posts found in RSS feed' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const post = posts[0];
        console.log(`Testing AI summarizer with post: ${post.title}`);

        const summary = await generateSummary(env.AI, post);

        return new Response(
          JSON.stringify(
            {
              message: 'AI summarizer is working',
              post: {
                title: post.title,
                url: post.link,
                categories: post.categories,
                authors: post.authors,
              },
              summary,
              summaryLength: summary.length,
            },
            null,
            2,
          ),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(
          JSON.stringify({
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
    }

    // Test GitHub publisher
    if (url.pathname === '/test-github') {
      const githubConfig = createGitHubConfig(env);

      if (!githubConfig) {
        return new Response(
          JSON.stringify({
            error: 'GitHub secrets not configured',
            message: 'Please set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO secrets',
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      if (!isAIAvailable(env.AI)) {
        return new Response(JSON.stringify({ error: 'Workers AI not configured' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      try {
        // Fetch one post
        const posts = await fetchBlogPosts({
          feedUrl: env.RSS_FEED_URL,
          maxPosts: 1,
        });

        if (posts.length === 0) {
          return new Response(JSON.stringify({ error: 'No posts found in RSS feed' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const post = posts[0];
        console.log(`Testing GitHub publisher with post: ${post.title}`);

        // Generate summary
        const summary = await generateSummary(env.AI, post);

        // Create blog post summary object
        const postSummary = createBlogPostSummary(post, summary);

        // Publish to GitHub
        const success = await publishToGitHub(githubConfig, postSummary);

        return new Response(
          JSON.stringify(
            {
              message: success ? 'Successfully published to GitHub' : 'Failed to publish to GitHub',
              success,
              post: {
                title: post.title,
                slug: postSummary.slug,
                url: post.link,
              },
              githubPath: `site/content/posts/${postSummary.slug}.json`,
              repoUrl: `https://github.com/${githubConfig.owner}/${githubConfig.repo}`,
            },
            null,
            2,
          ),
          {
            status: success ? 200 : 500,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(
          JSON.stringify({
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
    }

    // Manual trigger for the scheduled handler (for testing)
    if (url.pathname === '/trigger') {
      try {
        // Simulate a ScheduledEvent
        const mockEvent = {
          scheduledTime: Date.now(),
          cron: 'manual',
        } as ScheduledEvent;

        // Run the scheduled handler
        await this.scheduled(mockEvent, env, ctx);

        return new Response(
          JSON.stringify({
            message: 'Scheduled handler triggered successfully',
            timestamp: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(
          JSON.stringify({
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
    }

    return new Response(
      'Autoblog Worker\n\nEndpoints:\n- /health - Health check\n- /test - Test RSS parser\n- /test-kv - Test KV storage\n- /test-ai - Test AI summarizer\n- /test-github - Test GitHub publisher\n- /trigger - Manually trigger scheduled handler',
      { status: 200 },
    );
  },
};
