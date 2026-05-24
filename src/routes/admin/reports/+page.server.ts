import type { Actions, PageServerLoad } from '@sveltejs/kit';
import { getDB } from '$lib/server/db';
import {
  REPORT_STATUSES,
  listReports,
  setReportStatus,
  type ReportStatus
} from '$lib/server/reportsAdmin';

export const load: PageServerLoad = async ({ url, platform }) => {
  const db = getDB(platform);
  const rawStatus = url.searchParams.get('status') as ReportStatus | 'all' | null;
  const status: ReportStatus | 'all' =
    rawStatus && (REPORT_STATUSES.includes(rawStatus as ReportStatus) || rawStatus === 'all')
      ? rawStatus
      : 'new';
  const items = await listReports(db, status);
  // Pre-parse payloads server-side so the template stays simple.
  const parsed = items.map((r) => {
    let payload: unknown;
    try { payload = JSON.parse(r.payload); } catch { payload = { raw: r.payload }; }
    return { ...r, payload };
  });
  return { items: parsed, status };
};

export const actions: Actions = {
  setStatus: async ({ request, platform }) => {
    const db = getDB(platform);
    const form = await request.formData();
    const id = form.get('id') as string | null;
    const status = form.get('status') as ReportStatus | null;
    if (id && status && REPORT_STATUSES.includes(status)) {
      await setReportStatus(db, id, status);
    }
    return { ok: true };
  }
};
