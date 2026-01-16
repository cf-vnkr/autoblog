/**
 * Tests for RSS Parser
 */

import { describe, it, expect } from 'vitest';
import { generateSlug, extractSlugFromUrl } from './rss-parser';

describe('RSS Parser Utilities', () => {
  describe('generateSlug', () => {
    it('should convert title to URL-friendly slug', () => {
      expect(generateSlug('Human Native is joining Cloudflare')).toBe(
        'human-native-is-joining-cloudflare',
      );
    });

    it('should handle special characters', () => {
      expect(generateSlug('What came first: the CNAME or the A record?')).toBe(
        'what-came-first-the-cname-or-the-a-record',
      );
    });

    it('should handle multiple spaces and dashes', () => {
      expect(generateSlug('A   closer  look -- at BGP')).toBe('a-closer-look-at-bgp');
    });

    it('should remove leading and trailing dashes', () => {
      expect(generateSlug('---Test Title---')).toBe('test-title');
    });
  });

  describe('extractSlugFromUrl', () => {
    it('should extract slug from Cloudflare blog URL', () => {
      expect(extractSlugFromUrl('https://blog.cloudflare.com/human-native-joins-cloudflare/')).toBe(
        'human-native-joins-cloudflare',
      );
    });

    it('should handle URLs without trailing slash', () => {
      expect(
        extractSlugFromUrl('https://blog.cloudflare.com/cname-a-record-order-dns-standards'),
      ).toBe('cname-a-record-order-dns-standards');
    });

    it('should return empty string for invalid URLs', () => {
      expect(extractSlugFromUrl('https://example.com/some-post')).toBe('');
    });
  });
});
