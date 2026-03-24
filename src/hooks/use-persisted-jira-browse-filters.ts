import { useCallback, useEffect, useState, type SetStateAction } from 'react';

const STORAGE_PREFIX = 'neotro-jira-browse-filters';

const DEFAULTS = {
  searchText: '',
  statusFilter: 'not-done',
  pointsFilter: 'unestimated',
  /** Matches get-jira-board-issues sprintScopeFilter */
  sprintScopeFilter: 'board-open-backlog' as const,
  showFilters: false,
  hidePointedOrPointing: true,
} as const;

/** Must match STATUS_OPTIONS / POINTS_OPTIONS / SPRINT_SCOPE_OPTIONS / hidePointedOrPointing in EmbeddedTicketQueue & TicketQueuePanel */
const ALLOWED_STATUS = new Set<string>(['not-done', 'all', 'To Do', 'In Progress', 'Done']);
const ALLOWED_POINTS = new Set<string>(['any', 'unestimated', '1', '2', '3', '5', '8', '13', '21']);
const ALLOWED_SPRINT_SCOPE = new Set<string>(['board-open-backlog', 'open-backlog', 'all']);

type FiltersState = {
  searchText: string;
  statusFilter: string;
  pointsFilter: string;
  sprintScopeFilter: string;
  showFilters: boolean;
  hidePointedOrPointing: boolean;
};

function readFilters(teamId: string): FiltersState {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}:${teamId}`);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const searchText = typeof parsed.searchText === 'string' ? parsed.searchText : DEFAULTS.searchText;
    const statusFilter =
      typeof parsed.statusFilter === 'string' && ALLOWED_STATUS.has(parsed.statusFilter)
        ? parsed.statusFilter
        : DEFAULTS.statusFilter;
    const pointsFilter =
      typeof parsed.pointsFilter === 'string' && ALLOWED_POINTS.has(parsed.pointsFilter)
        ? parsed.pointsFilter
        : DEFAULTS.pointsFilter;
    const sprintScopeFilter =
      typeof parsed.sprintScopeFilter === 'string' && ALLOWED_SPRINT_SCOPE.has(parsed.sprintScopeFilter)
        ? parsed.sprintScopeFilter
        : DEFAULTS.sprintScopeFilter;
    const showFilters = typeof parsed.showFilters === 'boolean' ? parsed.showFilters : DEFAULTS.showFilters;
    const hidePointedOrPointing =
      typeof parsed.hidePointedOrPointing === 'boolean'
        ? parsed.hidePointedOrPointing
        : DEFAULTS.hidePointedOrPointing;
    return { searchText, statusFilter, pointsFilter, sprintScopeFilter, showFilters, hidePointedOrPointing };
  } catch {
    return { ...DEFAULTS };
  }
}

export function usePersistedJiraBrowseFilters(teamId: string | undefined) {
  const [filters, setFilters] = useState<FiltersState>(() =>
    teamId ? readFilters(teamId) : { ...DEFAULTS }
  );

  useEffect(() => {
    if (!teamId) return;
    try {
      localStorage.setItem(`${STORAGE_PREFIX}:${teamId}`, JSON.stringify(filters));
    } catch {
      /* quota / private mode */
    }
  }, [teamId, filters]);

  const setSearchText = useCallback((v: SetStateAction<string>) => {
    setFilters((prev) => ({ ...prev, searchText: typeof v === 'function' ? v(prev.searchText) : v }));
  }, []);

  const setStatusFilter = useCallback((v: SetStateAction<string>) => {
    setFilters((prev) => ({ ...prev, statusFilter: typeof v === 'function' ? v(prev.statusFilter) : v }));
  }, []);

  const setPointsFilter = useCallback((v: SetStateAction<string>) => {
    setFilters((prev) => ({ ...prev, pointsFilter: typeof v === 'function' ? v(prev.pointsFilter) : v }));
  }, []);

  const setSprintScopeFilter = useCallback((v: SetStateAction<string>) => {
    setFilters((prev) => ({
      ...prev,
      sprintScopeFilter: typeof v === 'function' ? v(prev.sprintScopeFilter) : v,
    }));
  }, []);

  const setShowFilters = useCallback((v: SetStateAction<boolean>) => {
    setFilters((prev) => ({ ...prev, showFilters: typeof v === 'function' ? v(prev.showFilters) : v }));
  }, []);

  const setHidePointedOrPointing = useCallback((v: SetStateAction<boolean>) => {
    setFilters((prev) => ({
      ...prev,
      hidePointedOrPointing: typeof v === 'function' ? v(prev.hidePointedOrPointing) : v,
    }));
  }, []);

  return {
    searchText: filters.searchText,
    setSearchText,
    statusFilter: filters.statusFilter,
    setStatusFilter,
    pointsFilter: filters.pointsFilter,
    setPointsFilter,
    sprintScopeFilter: filters.sprintScopeFilter,
    setSprintScopeFilter,
    showFilters: filters.showFilters,
    setShowFilters,
    hidePointedOrPointing: filters.hidePointedOrPointing,
    setHidePointedOrPointing,
  };
}
