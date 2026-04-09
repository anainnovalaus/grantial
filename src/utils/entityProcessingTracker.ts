export const ENTITY_PROCESSING_TRACKER_KEY = 'grantify_entity_processing_tracker';
export const ENTITY_PROCESSING_TRACKER_EVENT = 'grantify:entity-processing-tracker-change';

export interface EntityProcessingTrackerState {
  entityId: string;
  minimized: boolean;
  openedHighMatch: boolean;
}

const isBrowser = () => typeof window !== 'undefined';

export const getEntityProcessingTrackerState = (): EntityProcessingTrackerState | null => {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(ENTITY_PROCESSING_TRACKER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<EntityProcessingTrackerState>;
    if (!parsed.entityId) return null;
    return {
      entityId: String(parsed.entityId),
      minimized: Boolean(parsed.minimized),
      openedHighMatch: Boolean(parsed.openedHighMatch),
    };
  } catch {
    return null;
  }
};

const emitTrackerEvent = () => {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(ENTITY_PROCESSING_TRACKER_EVENT));
};

export const setEntityProcessingTrackerState = (state: EntityProcessingTrackerState) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(ENTITY_PROCESSING_TRACKER_KEY, JSON.stringify(state));
  emitTrackerEvent();
};

export const updateEntityProcessingTrackerState = (partial: Partial<EntityProcessingTrackerState>) => {
  const current = getEntityProcessingTrackerState();
  if (!current) return;
  setEntityProcessingTrackerState({
    ...current,
    ...partial,
  });
};

export const clearEntityProcessingTrackerState = () => {
  if (!isBrowser()) return;
  window.localStorage.removeItem(ENTITY_PROCESSING_TRACKER_KEY);
  emitTrackerEvent();
};
