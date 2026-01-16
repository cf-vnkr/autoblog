/**
 * Utilities for loading and managing blog post summaries
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Blog post summary schema (matches worker output)
 */
export interface BlogPost {
  slug: string;
  title: string;
  url: string;
  publishedAt: string;
  summary: string;
  authors: string[];
  categories: string[];
  guid: string;
}

/**
 * Gets all blog posts from the content/posts directory
 * @returns Array of blog posts sorted by date (newest first)
 */
export async function getAllPosts(): Promise<BlogPost[]> {
  try {
    const postsDir = join(process.cwd(), 'content', 'posts');
    const files = await readdir(postsDir);

    const posts: BlogPost[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) {
        continue;
      }

      const filePath = join(postsDir, file);
      const content = await readFile(filePath, 'utf-8');
      const post = JSON.parse(content) as BlogPost;

      // Validate required fields
      if (post.slug && post.title && post.url && post.summary) {
        posts.push(post);
      }
    }

    // Sort by date (newest first)
    return sortPostsByDate(posts);
  } catch (error) {
    console.error('Error loading posts:', error);
    return [];
  }
}

/**
 * Gets a single post by slug
 * @param slug Post slug
 * @returns Blog post or null if not found
 */
export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    const filePath = join(process.cwd(), 'content', 'posts', `${slug}.json`);
    const content = await readFile(filePath, 'utf-8');
    const post = JSON.parse(content) as BlogPost;
    return post;
  } catch (error) {
    console.error(`Error loading post ${slug}:`, error);
    return null;
  }
}

/**
 * Sorts posts by publication date (newest first)
 * @param posts Array of blog posts
 * @returns Sorted array
 */
export function sortPostsByDate(posts: BlogPost[]): BlogPost[] {
  return posts.sort((a, b) => {
    const dateA = new Date(a.publishedAt).getTime();
    const dateB = new Date(b.publishedAt).getTime();
    return dateB - dateA; // Descending order (newest first)
  });
}

/**
 * Formats a date string for display
 * @param dateString ISO date string
 * @returns Formatted date (e.g., "Jan 15, 2026")
 */
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Strips markdown formatting from text
 * @param text Text with markdown
 * @returns Plain text without markdown formatting
 */
export function stripMarkdown(text: string): string {
  return (
    text
      // Remove headers (##, ###, etc.)
      .replace(/^#+\s+/gm, '')
      // Remove bold/italic (**text**, *text*)
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      // Remove links [text](url)
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove inline code `code`
      .replace(/`([^`]+)`/g, '$1')
      // Remove list markers (-, *, 1., etc.)
      .replace(/^[\s]*[-*+]\s+/gm, '')
      .replace(/^[\s]*\d+\.\s+/gm, '')
      // Remove extra newlines
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

/**
 * Extracts a preview/excerpt from the summary
 * @param summary Full summary text
 * @param maxLength Maximum character length
 * @returns Truncated summary
 */
export function getExcerpt(summary: string, maxLength = 200): string {
  // Remove the AI disclaimer if present
  const withoutDisclaimer = summary.replace(/\*\*AI-Generated Summary\*\*:.*?\n\n/s, '');

  // Strip markdown formatting
  const plainText = stripMarkdown(withoutDisclaimer);

  if (plainText.length <= maxLength) {
    return plainText;
  }

  // Truncate at word boundary
  const truncated = plainText.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  return lastSpace > 0 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
}

/**
 * Gets unique categories from all posts
 * @param posts Array of blog posts
 * @returns Sorted array of unique categories
 */
export function getUniqueCategories(posts: BlogPost[]): string[] {
  const categories = new Set<string>();

  for (const post of posts) {
    for (const category of post.categories) {
      categories.add(category);
    }
  }

  return Array.from(categories).sort();
}

/**
 * Filters posts by category
 * @param posts Array of blog posts
 * @param category Category to filter by
 * @returns Filtered posts
 */
export function filterByCategory(posts: BlogPost[], category: string): BlogPost[] {
  return posts.filter((post) => post.categories.includes(category));
}
