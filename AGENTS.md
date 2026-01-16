# Agent Guidelines for Autoblog Project

This document provides guidelines for AI coding agents working in this repository.

## Project Overview

This is a Cloudflare Workers-based autoblog application that:
- Scrapes the Cloudflare blog RSS feed daily (midnight UTC)
- Generates AI summaries using Workers AI (Llama 3.1 8B Instruct)
- Publishes summaries as JSON files to GitHub
- Displays summaries on a static Astro site hosted at cfdemo.site

### Architecture
- **Worker**: Cloudflare Worker with cron trigger, Workers AI, and Workers KV
- **Site**: Astro static site with Tailwind CSS (light theme)
- **Storage**: Workers KV (processed posts), GitHub (post JSON files)
- **Deployment**: Cloudflare Pages with automatic rebuilds

See `IMPLEMENTATION_PLAN.md` for detailed architecture and implementation phases.

## Build, Lint, and Test Commands

### Installation
```bash
npm install
```

### Development
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
```

### Testing
```bash
npm test             # Run all tests
npm test -- <file>   # Run a single test file
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

### Linting & Formatting
```bash
npm run lint         # Run ESLint
npm run lint:fix     # Fix auto-fixable lint issues
npm run format       # Format code with Prettier
npm run format:check # Check formatting without changes
npm run type-check   # Run TypeScript compiler checks
```

## Code Style Guidelines

### Imports
- Use ES6 import/export syntax
- Group imports in this order:
  1. External dependencies (e.g., `react`, `express`)
  2. Internal absolute imports (e.g., `@/lib/utils`)
  3. Relative imports (e.g., `./components`)
- Sort imports alphabetically within each group
- Use named imports when possible; avoid default exports except for pages/components

```typescript
// Good
import { useState, useEffect } from 'react';
import { format } from 'date-fns';

import { db } from '@/lib/database';
import { logger } from '@/lib/logger';

import { Button } from './Button';
import type { Post } from './types';

// Avoid
import * as React from 'react';
```

### Formatting
- Use 2 spaces for indentation
- Use single quotes for strings
- Add trailing commas in multi-line objects and arrays
- Max line length: 100 characters
- Use semicolons at the end of statements

### TypeScript Types
- Always define explicit return types for functions
- Use `interface` for object types, `type` for unions/intersections
- Avoid `any`; use `unknown` if type is truly unknown
- Use `readonly` for immutable properties
- Prefer type inference for variables when obvious

```typescript
// Good
interface Post {
  readonly id: string;
  title: string;
  content: string;
  publishedAt: Date | null;
}

function createPost(data: Omit<Post, 'id'>): Post {
  return {
    id: generateId(),
    ...data,
  };
}

// Avoid
function createPost(data: any) {
  // ...
}
```

### Naming Conventions
- **Variables/Functions**: camelCase (`getUserData`, `isActive`)
- **Classes/Interfaces/Types**: PascalCase (`UserProfile`, `PostData`)
- **Constants**: UPPER_SNAKE_CASE (`API_KEY`, `MAX_RETRIES`)
- **Files**: kebab-case for utilities (`user-utils.ts`), PascalCase for components (`UserProfile.tsx`)
- **Directories**: kebab-case (`blog-posts`, `api-routes`)
- Use descriptive names; avoid abbreviations unless well-known

### Functions
- Keep functions small and focused (single responsibility)
- Use async/await over raw Promises
- Use arrow functions for callbacks and short functions
- Use function declarations for top-level named functions
- Add JSDoc comments for public APIs

```typescript
// Good
async function fetchUserPosts(userId: string): Promise<Post[]> {
  const posts = await db.posts.findMany({
    where: { authorId: userId },
  });
  return posts;
}

// For filtering/mapping
const activePosts = posts.filter((post) => post.status === 'active');
```

### Error Handling
- Always handle errors explicitly
- Use custom error classes for domain-specific errors
- Log errors with context before re-throwing
- Validate inputs at boundaries (API routes, functions)
- Use early returns for error conditions

```typescript
// Good
async function publishPost(postId: string): Promise<void> {
  if (!postId) {
    throw new ValidationError('Post ID is required');
  }

  try {
    const post = await db.posts.findUnique({ where: { id: postId } });
    
    if (!post) {
      throw new NotFoundError(`Post ${postId} not found`);
    }

    await db.posts.update({
      where: { id: postId },
      data: { status: 'published', publishedAt: new Date() },
    });
  } catch (error) {
    logger.error('Failed to publish post', { postId, error });
    throw error;
  }
}
```

### Comments
- Write self-documenting code; use comments sparingly
- Add comments for complex logic or non-obvious decisions
- Use JSDoc for public APIs and exported functions
- Keep comments up-to-date with code changes

## Testing Guidelines
- Write tests for all business logic
- Use descriptive test names: `it('should create post with valid data')`
- Follow AAA pattern: Arrange, Act, Assert
- Mock external dependencies (database, APIs)
- Aim for high coverage on critical paths

## Git Commit Guidelines
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- Keep commits atomic and focused
- Write clear, descriptive commit messages
- Reference issue numbers when applicable

## Performance Considerations
- Avoid unnecessary re-renders in React components
- Use pagination for large data sets
- Implement caching where appropriate
- Optimize database queries (use indexes, select only needed fields)
- Use lazy loading for heavy components

## Security Best Practices
- Never commit secrets or API keys
- Sanitize user inputs
- Use parameterized queries to prevent SQL injection
- Implement rate limiting on API endpoints
- Validate and sanitize all external data

---

**Note**: Update this file as the project evolves and new patterns emerge.
