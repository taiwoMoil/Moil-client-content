/**
 * Data migration: legacy comments -> structured comment objects.
 *
 * Context:
 *   content_calendars.comments used to be an array of plain strings. We now
 *   store an array of objects { id, text, authorRole, createdAt } so the
 *   dashboard can show how many comments are *new* since a viewer last looked.
 *
 * Prerequisite:
 *   Run database/migrations/001_structured_comments.sql FIRST. That converts the
 *   column to JSONB (yielding a JSON array of strings) and creates the
 *   content_comment_reads table. This script then upgrades each string into a
 *   full comment object.
 *
 * What it does:
 *   - Reads every content_calendars row.
 *   - For each comment that is still a bare string, wraps it as
 *     { id, text, authorRole: 'unknown', createdAt: <row.updated_at> }.
 *   - Rows whose comments are already objects are left untouched (idempotent).
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL must be set
 *   (e.g. in .env.local). Then:
 *
 *     node scripts/migrate-comments.mjs           # apply changes
 *     node scripts/migrate-comments.mjs --dry-run # report only, no writes
 */

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'

// --- Minimal .env loader (so the script works without extra deps) ------------
for (const file of ['.env.local', '.env']) {
  if (!existsSync(file)) continue
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DRY_RUN = process.argv.includes('--dry-run')

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

const EPOCH = '1970-01-01T00:00:00.000Z'

// Returns { changed: boolean, comments: object[] }.
function upgradeComments(rawComments, fallbackTimestamp) {
  if (!Array.isArray(rawComments)) return { changed: false, comments: [] }

  let changed = false
  const comments = []

  for (const c of rawComments) {
    if (c == null) {
      changed = true
      continue
    }
    if (typeof c === 'string') {
      const text = c.trim()
      if (!text) {
        changed = true
        continue
      }
      comments.push({
        id: randomUUID(),
        text,
        authorRole: 'unknown',
        createdAt: fallbackTimestamp || EPOCH,
      })
      changed = true
      continue
    }
    if (typeof c === 'object') {
      // Already an object; ensure required keys exist.
      const text = (c.text ?? '').toString().trim()
      if (!text) {
        changed = true
        continue
      }
      const fixed = {
        id: c.id || randomUUID(),
        text,
        authorRole: c.authorRole || 'unknown',
        createdAt: c.createdAt || fallbackTimestamp || EPOCH,
      }
      if (!c.id || !c.authorRole || !c.createdAt) changed = true
      comments.push(fixed)
      continue
    }
    changed = true
  }

  return { changed, comments }
}

async function main() {
  console.log(`\nMigrating comments${DRY_RUN ? ' (DRY RUN)' : ''}...\n`)

  const pageSize = 1000
  let from = 0
  let totalRows = 0
  let updatedRows = 0

  for (;;) {
    const { data: rows, error } = await supabase
      .from('content_calendars')
      .select('id, comments, updated_at')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      console.error('Failed to read content_calendars:', error.message)
      process.exit(1)
    }
    if (!rows || rows.length === 0) break

    for (const row of rows) {
      totalRows++
      const { changed, comments } = upgradeComments(row.comments, row.updated_at)
      if (!changed) continue

      updatedRows++
      if (DRY_RUN) {
        console.log(`  would update ${row.id} -> ${comments.length} comment(s)`)
        continue
      }

      const { error: updErr } = await supabase
        .from('content_calendars')
        .update({ comments })
        .eq('id', row.id)

      if (updErr) {
        console.error(`  FAILED ${row.id}: ${updErr.message}`)
      } else {
        console.log(`  updated ${row.id} -> ${comments.length} comment(s)`)
      }
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  console.log(
    `\nDone. Scanned ${totalRows} row(s); ${DRY_RUN ? 'would update' : 'updated'} ${updatedRows}.\n`,
  )
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
