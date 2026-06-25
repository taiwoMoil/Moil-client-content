// Structured comment model + unread helpers.
//
// Historically `content_calendars.comments` was a `TEXT[]` of plain strings,
// which gave us no way to tell which comments were *new* since a viewer last
// looked. Comments are now stored as JSONB objects carrying a timestamp and
// author, which powers the unread badge on the calendar.
//
// All read paths funnel through `normalizeComments` so the UI keeps working
// against un-migrated rows (legacy plain strings) until the data migration in
// `scripts/migrate-comments.mjs` has run.

export type CommentAuthorRole = 'team' | 'client' | 'unknown'

export interface CommentEntry {
  id: string
  text: string
  authorRole: CommentAuthorRole
  createdAt: string // ISO 8601
}

// A comment as it may appear on the wire: a modern object, or a legacy string.
export type RawComment = string | Partial<CommentEntry> | null | undefined

// Epoch fallback for legacy comments with no known timestamp. Using the epoch
// means a viewer who has ever opened the thread will have these counted as read.
const EPOCH = '1970-01-01T00:00:00.000Z'

function makeId(): string {
  // crypto.randomUUID is available in modern browsers and Node 16+.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Deterministic-enough fallback; only hit in very old runtimes.
  return `c_${Date.now().toString(36)}_${(globalThis as { __cseq?: number }).__cseq = ((globalThis as { __cseq?: number }).__cseq ?? 0) + 1}`
}

export function normalizeComment(raw: RawComment): CommentEntry | null {
  if (raw == null) return null

  if (typeof raw === 'string') {
    const text = raw.trim()
    if (!text) return null
    return { id: makeId(), text, authorRole: 'unknown', createdAt: EPOCH }
  }

  const text = (raw.text ?? '').toString().trim()
  if (!text) return null

  return {
    id: raw.id || makeId(),
    text,
    authorRole: (raw.authorRole as CommentAuthorRole) || 'unknown',
    createdAt: raw.createdAt || EPOCH,
  }
}

export function normalizeComments(raw: RawComment[] | null | undefined): CommentEntry[] {
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeComment).filter((c): c is CommentEntry => c !== null)
}

export function createComment(text: string, authorRole: CommentAuthorRole, nowISO: string): CommentEntry {
  return { id: makeId(), text: text.trim(), authorRole, createdAt: nowISO }
}

// Number of comments created strictly after the viewer last read this thread.
// A missing `lastReadAt` means the viewer has never opened it, so everything
// counts as unread.
export function countUnread(comments: RawComment[] | null | undefined, lastReadAt?: string | null): number {
  const normalized = normalizeComments(comments)
  if (!lastReadAt) return normalized.length
  const threshold = new Date(lastReadAt).getTime()
  return normalized.filter(c => new Date(c.createdAt).getTime() > threshold).length
}

// Sum of unread comments across a set of items (one calendar day), using a
// map of itemId -> lastReadAt ISO string.
export function countUnreadForItems(
  items: Array<{ id: string; comments?: RawComment[] | null }>,
  reads: Record<string, string>,
): number {
  return items.reduce((sum, it) => sum + countUnread(it.comments, reads[it.id]), 0)
}
