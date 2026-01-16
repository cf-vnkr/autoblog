/**
 * Type definitions for the autoblog worker
 */

export interface BlogPost {
  title: string;
  link: string;
  guid: string;
  pubDate: string;
  description: string;
  content: string;
  categories: string[];
  authors: string[];
}

export interface BlogPostSummary {
  slug: string;
  title: string;
  url: string;
  publishedAt: string;
  summary: string;
  authors: string[];
  categories: string[];
  guid: string;
}

export interface Env {
  // KV namespace for tracking processed posts (optional for local dev)
  PROCESSED_POSTS?: KVNamespace;
  // Workers AI binding (optional for local dev)
  AI?: Ai;
  // Environment variables
  RSS_FEED_URL: string;
  POSTS_TO_FETCH: string;
  // GitHub secrets (optional until deployment)
  GITHUB_TOKEN?: string;
  GITHUB_OWNER?: string;
  GITHUB_REPO?: string;
}
