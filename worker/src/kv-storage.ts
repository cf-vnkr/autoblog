/**
 * KV Storage utilities for tracking processed blog posts
 * Uses Workers KV to maintain state of which posts have been processed
 */

/**
 * Metadata stored for each processed post
 */
export interface ProcessedPostMetadata {
  processed: boolean;
  timestamp: string;
  title: string;
  slug: string;
  url: string;
}

/**
 * Generates KV key for a post GUID
 * @param guid Post GUID from RSS feed
 * @returns KV key string
 */
function getPostKey(guid: string): string {
  return `post:${guid}`;
}

/**
 * Checks if a post has been processed
 * @param kv KV namespace binding
 * @param guid Post GUID to check
 * @returns True if post has been processed, false otherwise
 */
export async function isPostProcessed(kv: KVNamespace, guid: string): Promise<boolean> {
  try {
    const key = getPostKey(guid);
    const value = await kv.get(key);
    return value !== null;
  } catch (error) {
    console.error(`Error checking if post ${guid} is processed:`, error);
    // Return false on error to allow processing (fail open)
    return false;
  }
}

/**
 * Marks a post as processed in KV storage
 * @param kv KV namespace binding
 * @param guid Post GUID
 * @param metadata Post metadata to store
 * @param ttl Optional TTL in seconds (default: none - store indefinitely)
 */
export async function markPostProcessed(
  kv: KVNamespace,
  guid: string,
  metadata: Omit<ProcessedPostMetadata, 'processed' | 'timestamp'>,
  ttl?: number,
): Promise<void> {
  try {
    const key = getPostKey(guid);
    const value: ProcessedPostMetadata = {
      processed: true,
      timestamp: new Date().toISOString(),
      ...metadata,
    };

    const options: KVNamespacePutOptions = {};
    if (ttl) {
      options.expirationTtl = ttl;
    }

    await kv.put(key, JSON.stringify(value), options);
    console.log(`Marked post ${guid} as processed`);
  } catch (error) {
    console.error(`Error marking post ${guid} as processed:`, error);
    throw error;
  }
}

/**
 * Gets metadata for a processed post
 * @param kv KV namespace binding
 * @param guid Post GUID
 * @returns Post metadata or null if not found
 */
export async function getProcessedPostMetadata(
  kv: KVNamespace,
  guid: string,
): Promise<ProcessedPostMetadata | null> {
  try {
    const key = getPostKey(guid);
    const value = await kv.get(key);

    if (!value) {
      return null;
    }

    return JSON.parse(value) as ProcessedPostMetadata;
  } catch (error) {
    console.error(`Error getting metadata for post ${guid}:`, error);
    return null;
  }
}

/**
 * Gets list of all processed post GUIDs
 * Note: This uses KV list which has pagination limits
 * @param kv KV namespace binding
 * @param limit Maximum number of keys to return (default: 1000)
 * @returns Array of processed post GUIDs
 */
export async function getProcessedPosts(kv: KVNamespace, limit = 1000): Promise<string[]> {
  try {
    const guids: string[] = [];
    let cursor: string | undefined;

    // KV list() returns max 1000 keys per call, so we need to paginate
    do {
      const result = await kv.list({
        prefix: 'post:',
        limit: Math.min(limit - guids.length, 1000),
        cursor,
      });

      // Extract GUIDs from keys (remove 'post:' prefix)
      const pageGuids = result.keys.map((key) => key.name.replace(/^post:/, ''));
      guids.push(...pageGuids);

      cursor = result.list_complete ? undefined : result.cursor;
    } while (cursor && guids.length < limit);

    console.log(`Retrieved ${guids.length} processed post GUIDs from KV`);
    return guids;
  } catch (error) {
    console.error('Error getting processed posts:', error);
    return [];
  }
}

/**
 * Gets count of processed posts
 * @param kv KV namespace binding
 * @returns Count of processed posts
 */
export async function getProcessedPostCount(kv: KVNamespace): Promise<number> {
  try {
    let count = 0;
    let cursor: string | undefined;

    do {
      const result = await kv.list({
        prefix: 'post:',
        limit: 1000,
        cursor,
      });

      count += result.keys.length;
      cursor = result.list_complete ? undefined : result.cursor;
    } while (cursor);

    return count;
  } catch (error) {
    console.error('Error getting processed post count:', error);
    return 0;
  }
}

/**
 * Deletes a processed post record from KV
 * Useful for reprocessing a post
 * @param kv KV namespace binding
 * @param guid Post GUID to delete
 */
export async function deleteProcessedPost(kv: KVNamespace, guid: string): Promise<void> {
  try {
    const key = getPostKey(guid);
    await kv.delete(key);
    console.log(`Deleted processed post record for ${guid}`);
  } catch (error) {
    console.error(`Error deleting processed post ${guid}:`, error);
    throw error;
  }
}

/**
 * Batch check if multiple posts have been processed
 * @param kv KV namespace binding
 * @param guids Array of post GUIDs to check
 * @returns Map of GUID to boolean (true if processed)
 */
export async function batchCheckProcessed(
  kv: KVNamespace,
  guids: string[],
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();

  // KV doesn't have native batch get, so we need to check each individually
  // We can do this in parallel for better performance
  await Promise.all(
    guids.map(async (guid) => {
      const processed = await isPostProcessed(kv, guid);
      results.set(guid, processed);
    }),
  );

  return results;
}
