/**
 * RSS Parser for Cloudflare Blog
 * Fetches and parses the RSS feed from blog.cloudflare.com
 */

import type { BlogPost } from './types';

interface RSSParserOptions {
  feedUrl: string;
  maxPosts?: number;
}

/**
 * Fetches and parses the Cloudflare blog RSS feed
 * @param options Parser configuration options
 * @returns Array of parsed blog posts
 */
export async function fetchBlogPosts(options: RSSParserOptions): Promise<BlogPost[]> {
  const { feedUrl, maxPosts } = options;

  try {
    // Fetch the RSS feed
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Cloudflare-Autoblog-Worker/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed: ${response.status} ${response.statusText}`);
    }

    const xmlText = await response.text();

    // Parse the XML
    const posts = parseRSSFeed(xmlText);

    // Return limited number of posts if specified
    return maxPosts ? posts.slice(0, maxPosts) : posts;
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    throw error;
  }
}

/**
 * Parses RSS XML text into an array of BlogPost objects
 * @param xmlText RSS feed XML as string
 * @returns Array of parsed blog posts
 */
function parseRSSFeed(xmlText: string): BlogPost[] {
  const posts: BlogPost[] = [];

  // Simple regex-based parsing for RSS items
  // Note: This is a lightweight approach suitable for Workers
  // For more complex XML, consider using a proper XML parser
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  const items = [...xmlText.matchAll(itemRegex)];

  for (const itemMatch of items) {
    const itemXml = itemMatch[1];

    try {
      const post = parseRSSItem(itemXml);
      posts.push(post);
    } catch (error) {
      console.error('Error parsing RSS item:', error);
      // Continue parsing other items even if one fails
    }
  }

  return posts;
}

/**
 * Parses a single RSS item into a BlogPost object
 * @param itemXml XML content of a single RSS item
 * @returns Parsed BlogPost object
 */
function parseRSSItem(itemXml: string): BlogPost {
  // Extract fields using regex patterns
  const title = extractCDATA(itemXml, 'title');
  const link = extractText(itemXml, 'link');
  const guid = extractText(itemXml, 'guid');
  const pubDate = extractText(itemXml, 'pubDate');
  const description = extractCDATA(itemXml, 'description');
  const content = extractCDATA(itemXml, 'content:encoded');
  const categories = extractMultiple(itemXml, 'category');
  const authors = extractMultiple(itemXml, 'dc:creator');

  // Validate required fields
  if (!title || !link || !guid) {
    throw new Error('Missing required fields in RSS item');
  }

  return {
    title: cleanText(title),
    link: cleanText(link),
    guid: cleanText(guid),
    pubDate: cleanText(pubDate),
    description: cleanText(description),
    content: cleanText(content),
    categories: categories.map((c) => cleanText(c)),
    authors: authors.map((a) => cleanText(a)),
  };
}

/**
 * Extracts text content from a CDATA section
 * @param xml XML string
 * @param tag Tag name to extract
 * @returns Extracted text or empty string
 */
function extractCDATA(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}><!\\[CDATA\\[(.*?)\\]\\]><\\/${tag}>`, 's');
  const match = xml.match(regex);
  return match ? match[1] : '';
}

/**
 * Extracts plain text content from an XML tag
 * @param xml XML string
 * @param tag Tag name to extract
 * @returns Extracted text or empty string
 */
function extractText(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>(.*?)<\\/${tag}>`, 's');
  const match = xml.match(regex);
  return match ? match[1] : '';
}

/**
 * Extracts multiple instances of a tag (for categories, authors, etc.)
 * @param xml XML string
 * @param tag Tag name to extract
 * @returns Array of extracted text values
 */
function extractMultiple(xml: string, tag: string): string[] {
  const results: string[] = [];
  const cdataRegex = new RegExp(`<${tag}><!\\[CDATA\\[(.*?)\\]\\]><\\/${tag}>`, 'gs');
  const textRegex = new RegExp(`<${tag}[^>]*>(.*?)<\\/${tag}>`, 'gs');

  // Try CDATA pattern first
  let matches = [...xml.matchAll(cdataRegex)];
  if (matches.length > 0) {
    return matches.map((m) => m[1]);
  }

  // Fall back to text pattern
  matches = [...xml.matchAll(textRegex)];
  return matches.map((m) => m[1]);
}

/**
 * Decodes HTML entities in text
 * @param text Text containing HTML entities
 * @returns Decoded text
 */
function decodeHTMLEntities(text: string): string {
  // Decode numeric entities (&#233; or &#xE9;)
  text = text.replace(/&#(\d+);/g, (_match, dec) => {
    return String.fromCharCode(parseInt(dec, 10));
  });
  text = text.replace(/&#x([0-9A-Fa-f]+);/g, (_match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });

  // Decode common named entities
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&nbsp;': ' ',
    '&eacute;': 'é',
    '&egrave;': 'è',
    '&ecirc;': 'ê',
    '&euml;': 'ë',
    '&agrave;': 'à',
    '&acirc;': 'â',
    '&auml;': 'ä',
    '&ocirc;': 'ô',
    '&ouml;': 'ö',
    '&icirc;': 'î',
    '&iuml;': 'ï',
    '&ccedil;': 'ç',
    '&ntilde;': 'ñ',
    '&uuml;': 'ü',
    '&ucirc;': 'û',
    '&ugrave;': 'ù',
  };

  for (const [entity, char] of Object.entries(entities)) {
    text = text.replace(new RegExp(entity, 'g'), char);
  }

  return text;
}

/**
 * Cleans extracted text by trimming whitespace and removing newlines
 * @param text Text to clean
 * @returns Cleaned text
 */
function cleanText(text: string): string {
  return decodeHTMLEntities(text.trim().replace(/\n\s*/g, ' '));
}

/**
 * Generates a URL-friendly slug from a blog post title
 * @param title Blog post title
 * @returns URL-friendly slug
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Extracts the slug from a Cloudflare blog URL
 * @param url Blog post URL
 * @returns Extracted slug or generated from URL
 */
export function extractSlugFromUrl(url: string): string {
  const match = url.match(/blog\.cloudflare\.com\/([^/]+)/);
  if (match && match[1]) {
    return match[1].replace(/\/$/, '');
  }
  return '';
}
