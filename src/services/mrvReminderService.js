/**
 * MRV reminders.
 *
 * Validated projects are expected to file a monitoring report every reporting
 * cadence (admin setting `mrv_reporting_days`, default 365). This service
 * derives "due soon" / "overdue" reminders purely from existing data
 * (projects + monitoring_reports) — no schema changes — and can raise a
 * deduped bell notification for overdue projects.
 */
import { getSupabase } from '@/services/supabaseClient'
import { getCurrentUserId } from '@/utils/authHelper'
import { getUserNotifications, createNotificationsForUsers } from '@/services/notificationService'

const DAY_MS = 86400000
/** Days before the due date that a reminder starts showing as "due soon". */
export const DUE_SOON_WINDOW = 30

/** Admin-configured reporting cadence in days (default 365). */
export async function getReportingCadenceDays() {
  try {
    const { getSetting } = await import('@/services/settingsService')
    return Number(await getSetting('mrv_reporting_days', 365)) || 365
  } catch {
    return 365
  }
}

/**
 * Reminders for the developer's validated projects.
 * Each: { projectId, title, category, status: 'overdue'|'due_soon',
 *         dueDate (ISO), daysUntil, hasEverReported }.
 * Only projects that are overdue or within DUE_SOON_WINDOW are returned,
 * sorted most-urgent first.
 */
export async function computeMrvReminders(userId = null, now = new Date()) {
  const supabase = getSupabase()
  if (!supabase) return []
  const uid = userId || (await getCurrentUserId())
  if (!uid) return []

  const cadence = await getReportingCadenceDays()

  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, title, category, status, user_id, created_at')
    .eq('user_id', uid)
    .eq('status', 'validated')
  if (error || !projects?.length) return []

  const projectIds = projects.map((p) => p.id)
  const { data: reports } = await supabase
    .from('monitoring_reports')
    .select('project_id, created_at, period_end, status')
    .in('project_id', projectIds)
    .order('created_at', { ascending: false })

  // Newest report per project (the list is already newest-first).
  const latestByProject = {}
  for (const r of reports || []) {
    if (!latestByProject[r.project_id]) latestByProject[r.project_id] = r
  }

  const reminders = []
  for (const p of projects) {
    const last = latestByProject[p.id]
    // Anchor the next due date off the last report's period end / creation,
    // falling back to the project's own creation date for never-reported projects.
    const anchorStr = last?.period_end || last?.created_at || p.created_at
    const anchor = anchorStr ? new Date(anchorStr) : null
    if (!anchor || isNaN(anchor.getTime())) continue

    const dueDate = new Date(anchor.getTime() + cadence * DAY_MS)
    const daysUntil = Math.floor((dueDate.getTime() - now.getTime()) / DAY_MS)

    let status = null
    if (daysUntil < 0) status = 'overdue'
    else if (daysUntil <= DUE_SOON_WINDOW) status = 'due_soon'
    if (!status) continue

    reminders.push({
      projectId: p.id,
      title: p.title || 'Untitled project',
      category: p.category || '',
      status,
      dueDate: dueDate.toISOString(),
      daysUntil,
      hasEverReported: !!last,
    })
  }

  reminders.sort((a, b) => a.daysUntil - b.daysUntil)
  return reminders
}

/**
 * Raise a bell notification for each overdue project, deduped per due-period so
 * re-visiting the page doesn't spam the bell. Best-effort; returns created rows.
 */
export async function syncMrvReminderNotifications(userId = null, now = new Date()) {
  const uid = userId || (await getCurrentUserId())
  if (!uid) return []

  let overdue = []
  try {
    const reminders = await computeMrvReminders(uid, now)
    overdue = reminders.filter((r) => r.status === 'overdue')
  } catch {
    return []
  }
  if (!overdue.length) return []

  // Skip projects already reminded for the same due period.
  let seen = new Set()
  try {
    const existing = await getUserNotifications(uid, 50)
    seen = new Set(
      (existing || [])
        .filter((n) => n.type === 'mrv_reminder')
        .map((n) => `${n.metadata?.project_id}:${n.metadata?.due_period}`),
    )
  } catch {
    // If we can't read existing notifications, fall through and risk a dup
    // rather than miss the reminder entirely.
  }

  const created = []
  for (const r of overdue) {
    const duePeriod = r.dueDate.slice(0, 10)
    if (seen.has(`${r.projectId}:${duePeriod}`)) continue
    try {
      const res = await createNotificationsForUsers([uid], {
        type: 'mrv_reminder',
        title: 'Monitoring report overdue',
        message: `"${r.title}" is overdue for a monitoring report. Submit activity data to keep issuing credits.`,
        link: '/monitoring',
        metadata: { project_id: r.projectId, due_period: duePeriod, status: r.status },
      })
      created.push(res)
    } catch {
      // best-effort
    }
  }
  return created
}
