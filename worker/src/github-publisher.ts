/**
 * GitHub Publisher
 * Publishes blog post summaries as JSON files to GitHub repository
 */

import type { BlogPost, BlogPostSummary } from './types';
import { extractSlugFromUrl } from './rss-parser';

/**
 * GitHub API configuration
 */
interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

/**
 * GitHub API response for getting file content
 */
interface GitHubFileResponse {
  sha: string;
  content: string;
}

/**
 * Generates a slug for the JSON filename from a blog post
 * @param post Blog post
 * @returns URL-friendly slug
 */
function generateSlugForPost(post: BlogPost): string {
  // Try to extract slug from URL first
  const urlSlug = extractSlugFromUrl(post.link);
  if (urlSlug) {
    return urlSlug;
  }

  // Fallback to generating from title
  return post.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Creates a BlogPostSummary object from a blog post and its AI-generated summary
 * @param post Blog post
 * @param summary AI-generated summary
 * @returns BlogPostSummary object
 */
export function createBlogPostSummary(post: BlogPost, summary: string): BlogPostSummary {
  const slug = generateSlugForPost(post);

  return {
    slug,
    title: post.title,
    url: post.link,
    publishedAt: post.pubDate,
    summary,
    authors: post.authors,
    categories: post.categories,
    guid: post.guid,
  };
}

/**
 * Checks if a file exists in the GitHub repository
 * @param config GitHub configuration
 * @param filePath Path to the file in the repository
 * @returns File SHA if exists, null otherwise
 */
async function getFileSha(config: GitHubConfig, filePath: string): Promise<string | null> {
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${filePath}`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Cloudflare-Autoblog-Worker',
      },
    });

    if (response.status === 404) {
      return null; // File doesn't exist
    }

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as GitHubFileResponse;
    return data.sha;
  } catch (error) {
    console.error(`Error checking file existence: ${filePath}`, error);
    return null;
  }
}

/**
 * Publishes a blog post summary to GitHub as a JSON file
 * @param config GitHub configuration
 * @param postSummary Blog post summary to publish
 * @returns True if successful, false otherwise
 */
export async function publishToGitHub(
  config: GitHubConfig,
  postSummary: BlogPostSummary,
): Promise<boolean> {
  const filePath = `site/content/posts/${postSummary.slug}.json`;
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${filePath}`;

  try {
    console.log(`Publishing post to GitHub: ${postSummary.title} -> ${filePath}`);

    // Check if file already exists
    const existingSha = await getFileSha(config, filePath);

    // Prepare the file content
    const content = JSON.stringify(postSummary, null, 2);
    const base64Content = btoa(content); // Base64 encode for GitHub API

    // Prepare the request body
    const body: any = {
      message: existingSha
        ? `chore: update summary for "${postSummary.title}"`
        : `feat: add summary for "${postSummary.title}"`,
      content: base64Content,
      branch: 'main',
    };

    // If file exists, include its SHA for update
    if (existingSha) {
      body.sha = existingSha;
      console.log(`File exists, updating with SHA: ${existingSha}`);
    }

    // Create or update the file
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Cloudflare-Autoblog-Worker',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const result = (await response.json()) as any;
    console.log(`Successfully published to GitHub: ${result.content?.html_url || filePath}`);

    return true;
  } catch (error) {
    console.error(`Failed to publish to GitHub: ${postSummary.title}`, error);
    return false;
  }
}

/**
 * Publishes multiple blog post summaries to GitHub
 * @param config GitHub configuration
 * @param postSummaries Array of blog post summaries
 * @returns Number of successfully published posts
 */
export async function publishMultipleToGitHub(
  config: GitHubConfig,
  postSummaries: BlogPostSummary[],
): Promise<number> {
  console.log(`Publishing ${postSummaries.length} posts to GitHub`);

  let successCount = 0;

  // Process posts sequentially to avoid overwhelming GitHub API
  for (const postSummary of postSummaries) {
    const success = await publishToGitHub(config, postSummary);
    if (success) {
      successCount++;
    }

    // Add a small delay between requests to be nice to GitHub API
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(`Successfully published ${successCount}/${postSummaries.length} posts to GitHub`);

  return successCount;
}

/**
 * Validates GitHub configuration
 * @param config GitHub configuration
 * @returns True if valid
 */
export function validateGitHubConfig(config: Partial<GitHubConfig>): config is GitHubConfig {
  return !!(config.token && config.owner && config.repo);
}

/**
 * Creates GitHub configuration from environment variables
 * @param env Environment variables
 * @returns GitHub configuration or null if invalid
 */
export function createGitHubConfig(env: {
  GITHUB_TOKEN?: string;
  GITHUB_OWNER?: string;
  GITHUB_REPO?: string;
}): GitHubConfig | null {
  const config = {
    token: env.GITHUB_TOKEN || '',
    owner: env.GITHUB_OWNER || '',
    repo: env.GITHUB_REPO || '',
  };

  if (validateGitHubConfig(config)) {
    return config;
  }

  return null;
}
