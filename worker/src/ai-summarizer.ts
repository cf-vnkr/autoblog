/**
 * AI Summarizer using Workers AI
 * Generates blog post summaries using Llama 3.1 8B Instruct
 */

import type { BlogPost } from './types';

const AI_MODEL = '@cf/meta/llama-3.1-8b-instruct';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Options for AI summarization
 */
interface SummarizeOptions {
  maxLength?: number;
  includeDisclaimer?: boolean;
}

/**
 * Strips HTML tags from content to get plain text
 * @param html HTML content string
 * @returns Plain text without HTML tags
 */
function stripHtml(html: string): string {
  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, ' ');
  // Replace multiple spaces with single space
  text = text.replace(/\s+/g, ' ');
  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return text.trim();
}

/**
 * Truncates text to a maximum character count while preserving word boundaries
 * @param text Text to truncate
 * @param maxChars Maximum characters
 * @returns Truncated text
 */
function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }

  // Find the last space within the limit
  const truncated = text.substring(0, maxChars);
  const lastSpace = truncated.lastIndexOf(' ');

  return lastSpace > 0 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
}

/**
 * Builds the system prompt for the AI
 * @returns System prompt string
 */
function getSystemPrompt(): string {
  return `You are a technical content summarizer for a developer blog. Your task is to create concise, informative summaries of technical blog posts. Focus on:
- Key technical details and main announcements
- Practical implications for developers
- Important facts, figures, and timelines
- Clear, professional language

Write summaries in 2-3 paragraphs. Be objective and informative.`;
}

/**
 * Builds the user prompt for summarizing a blog post
 * @param post Blog post to summarize
 * @returns User prompt string
 */
function getUserPrompt(post: BlogPost): string {
  const plainTextContent = stripHtml(post.content);
  const truncatedContent = truncateText(plainTextContent, 4000); // Limit to ~4000 chars for context

  return `Summarize the following Cloudflare blog post in 2-3 concise paragraphs. Focus on the key technical details, main announcements, and practical implications for developers.

Title: ${post.title}

Authors: ${post.authors.join(', ')}

Categories: ${post.categories.join(', ')}

Content:
${truncatedContent}

Provide a clear, technical summary that developers would find useful.`;
}

/**
 * Generates a summary for a blog post using Workers AI
 * @param ai Workers AI binding
 * @param post Blog post to summarize
 * @param options Summarization options
 * @returns Generated summary text
 */
export async function generateSummary(
  ai: Ai,
  post: BlogPost,
  options: SummarizeOptions = {},
): Promise<string> {
  const { includeDisclaimer = true } = options;

  let lastError: Error | null = null;

  // Retry logic
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`Generating summary for post: ${post.title} (attempt ${attempt}/${MAX_RETRIES})`);

      const messages = [
        { role: 'system', content: getSystemPrompt() },
        { role: 'user', content: getUserPrompt(post) },
      ];

      const response = (await ai.run(AI_MODEL as any, {
        messages,
        max_tokens: 512,
        temperature: 0.7,
      })) as any;

      // Extract the summary from the response
      let summary = '';
      if (response && typeof response === 'object' && 'response' in response) {
        summary = String(response.response);
      } else if (typeof response === 'string') {
        summary = response;
      } else {
        throw new Error('Unexpected response format from AI');
      }

      // Clean up the summary
      summary = summary.trim();

      if (!summary || summary.length < 50) {
        throw new Error('Generated summary is too short or empty');
      }

      console.log(`Successfully generated summary (${summary.length} characters)`);

      // Add disclaimer if requested
      if (includeDisclaimer) {
        const disclaimer =
          '**AI-Generated Summary**: This is an automated summary of a Cloudflare blog post created using AI. For the full details and context, please read the original post.\n\n';
        summary = disclaimer + summary;
      }

      return summary;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Attempt ${attempt} failed:`, lastError.message);

      // If not the last attempt, wait before retrying
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * attempt; // Exponential backoff
        console.log(`Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  console.error('All retry attempts failed for summary generation');
  throw new Error(
    `Failed to generate summary after ${MAX_RETRIES} attempts: ${lastError?.message}`,
  );
}

/**
 * Generates summaries for multiple blog posts
 * @param ai Workers AI binding
 * @param posts Array of blog posts to summarize
 * @param options Summarization options
 * @returns Array of summaries (same order as input posts)
 */
export async function generateSummaries(
  ai: Ai,
  posts: BlogPost[],
  options: SummarizeOptions = {},
): Promise<string[]> {
  console.log(`Generating summaries for ${posts.length} posts`);

  const summaries: string[] = [];

  // Process posts sequentially to avoid overwhelming the AI service
  for (const post of posts) {
    try {
      const summary = await generateSummary(ai, post, options);
      summaries.push(summary);
    } catch (error) {
      console.error(`Failed to generate summary for post ${post.title}:`, error);
      // Push a fallback summary
      const fallback =
        '**AI-Generated Summary**: Summary generation failed. Please read the original post for full details.';
      summaries.push(fallback);
    }
  }

  return summaries;
}

/**
 * Validates if AI binding is available
 * @param ai Workers AI binding (optional)
 * @returns True if AI is available
 */
export function isAIAvailable(ai: Ai | undefined): ai is Ai {
  return ai !== undefined;
}
