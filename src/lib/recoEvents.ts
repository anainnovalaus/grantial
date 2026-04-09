export type RecoEventType =
  | 'impression'
  | 'detail_open'
  | 'like'
  | 'dislike'
  | 'favorite_add'
  | 'apply_click';

const API_URL = import.meta.env.VITE_API_URL;
const RECO_EVENTS_ENABLED = String(import.meta.env.VITE_RECO_EVENTS_ENABLED ?? 'true').toLowerCase() !== 'false';
const EVENT_COOLDOWN_DEFAULT_MS = 10000;
const EVENT_COOLDOWN_MAX_MS = 60000;
const GENERAL_DEDUPE_WINDOW_MS = 1200;
const IMPRESSION_DEDUPE_WINDOW_MS = 12000;
const EVENT_BUDGET_WINDOW_MS = 60000;
const EVENT_BUDGET_MAX_PER_WINDOW = 25;

let eventsCooldownUntil = 0;
let budgetWindowStartedAt = 0;
let sentEventsInCurrentWindow = 0;
const lastEventAtByKey = new Map<string, number>();

interface TrackRecoEventInput {
  eventType: RecoEventType;
  grantId: string | number;
  surface: string;
  position?: number;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  eventValue?: number;
}

const parseRetryAfterMs = (response: Response): number | null => {
  const retryAfter = response.headers.get('Retry-After');
  if (!retryAfter) return null;

  const asSeconds = Number(retryAfter);
  if (Number.isFinite(asSeconds) && asSeconds > 0) {
    return Math.min(asSeconds * 1000, EVENT_COOLDOWN_MAX_MS);
  }

  const asDate = new Date(retryAfter);
  if (Number.isNaN(asDate.getTime())) return null;
  const delta = asDate.getTime() - Date.now();
  if (delta <= 0) return null;
  return Math.min(delta, EVENT_COOLDOWN_MAX_MS);
};

const getEventDedupeWindowMs = (eventType: RecoEventType): number => {
  if (eventType === 'impression') return IMPRESSION_DEDUPE_WINDOW_MS;
  return GENERAL_DEDUPE_WINDOW_MS;
};

const shouldDropByBudget = (now: number): boolean => {
  if (budgetWindowStartedAt === 0 || now - budgetWindowStartedAt >= EVENT_BUDGET_WINDOW_MS) {
    budgetWindowStartedAt = now;
    sentEventsInCurrentWindow = 0;
  }

  if (sentEventsInCurrentWindow >= EVENT_BUDGET_MAX_PER_WINDOW) {
    return true;
  }

  sentEventsInCurrentWindow += 1;
  return false;
};

const pruneDedupeMapIfNeeded = (now: number): void => {
  if (lastEventAtByKey.size < 1000) return;

  const staleBefore = now - (IMPRESSION_DEDUPE_WINDOW_MS * 2);
  lastEventAtByKey.forEach((timestamp, key) => {
    if (timestamp < staleBefore) {
      lastEventAtByKey.delete(key);
    }
  });
};

export const trackRecoEvent = async ({
  eventType,
  grantId,
  surface,
  position,
  sessionId,
  metadata,
  eventValue,
}: TrackRecoEventInput): Promise<void> => {
  try {
    if (!RECO_EVENTS_ENABLED) return;
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    if (!API_URL) return;

    const now = Date.now();
    if (eventsCooldownUntil > now) return;

    const dedupeKey = `${eventType}|${surface}|${String(grantId)}|${sessionId || ''}`;
    const dedupeWindow = getEventDedupeWindowMs(eventType);
    const lastEventAt = lastEventAtByKey.get(dedupeKey) ?? 0;
    if (now - lastEventAt < dedupeWindow) return;
    if (shouldDropByBudget(now)) return;
    lastEventAtByKey.set(dedupeKey, now);
    pruneDedupeMapIfNeeded(now);

    const payload = {
      event_type: eventType,
      grant_id: grantId,
      surface,
      position,
      session_id: sessionId,
      metadata,
      event_value: eventValue,
    };

    const response = await fetch(`${API_URL}/api/reco/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });

    if (response.status === 429) {
      const waitMs = parseRetryAfterMs(response) ?? EVENT_COOLDOWN_DEFAULT_MS;
      eventsCooldownUntil = Date.now() + waitMs;
    }
  } catch {
    // Silent by design: recommendation events are best-effort telemetry.
  }
};
