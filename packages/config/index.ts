/**
 * NEIMAN Universal Configuration & Defaults
 * Shared across Web, Desktop, and TUI runtimes.
 */

export const NEIMAN_CONFIG = {
  APP_NAME: 'NEIMAN',
  APP_FULL_NAME: 'NEIMAN Autonomous Organization OS',
  APP_VERSION: '1.0.2',
  SETUP_PROTOCOL_VERSION: '0.2.2-zero-login',

  NETWORK: {
    DEFAULT_API_URL: 'http://localhost:8000',
    DEFAULT_WS_URL: 'ws://localhost:8000',
    DEFAULT_OLLAMA_URL: 'http://localhost:11434',
    DEFAULT_MCP_ENDPOINT: 'http://localhost:8999/sse',
    ZERO_TRUST_DEEP_LINK_SCHEME: 'neiman://',
  },

  STORAGE_KEYS: {
    AUTH: 'NEIMAN-auth',
    THEME: 'NEIMAN-theme',
    SETUP_VERSION: 'neiman_setup_completed_v022',
    WORKSPACE_LAYOUT: 'NEIMAN_WORKSPACE_LAYOUT_V2',
    COMMAND_HISTORY: 'NEIMAN_CMD_HISTORY',
    NAV_COLLAPSED: 'neiman_nav_collapsed',
    DESKTOP_CONFIG: 'neiman_desktop_cfg',
    DESKTOP_WINDOW_STATE: 'neiman_win_state',
    CONFIGURED_PROVIDER: 'neiman_configured_provider',
    SESSION_SEC_PREFIX: 'neiman_sec_',
    REPO_META_PREFIX: 'neiman_repo_',
    ACCESS_TOKEN: 'access_token',
  },

  TELEMETRY: {
    POLLING_INTERVALS: {
      REALTIME: 3_000,
      RAPID: 5_000,
      NORMAL: 8_000,
      MEDIUM: 10_000,
      SLOW: 15_000,
      BACKGROUND: 30_000,
    },
    STALE_TIMES: {
      INSTANT: 0,
      FAST: 5_000,
      NORMAL: 15_000,
      MEDIUM: 30_000,
      LONG: 60_000,
      INACTIVE_GC: 600_000,
    },
    API_CACHE_TTL_MS: 4_000,
  },

  OPERATIONAL_LIMITS: {
    MAX_VISIBLE_STREAM_EVENTS: 30,
    ORG_GRAPH_VIRTUALIZATION_LIMIT: 30,
    MAX_COMMAND_HISTORY: 8,
    DEFAULT_PAGE_SIZE: 50,
    DEFAULT_SEARCH_LIMIT: 5,
    DEFAULT_AUDIT_LIMIT: 20,
    DEFAULT_DECISION_LIMIT: 50,
    DEFAULT_RETRY_COUNT: 2,
  },

  ROUTES: {
    HOME: '/',
    AUTH: {
      LOGIN: '/auth/login',
      REGISTER: '/auth/register',
    },
    DASHBOARD: {
      HOME: '/dashboard',
      ORGANIZATIONS: '/dashboard/organizations',
      ORGANIZATION: '/dashboard/organization',
      DEPARTMENTS: '/dashboard/departments',
      AGENTS: '/dashboard/agents',
      PROJECTS: '/dashboard/projects',
      TASKS: '/dashboard/tasks',
      WORKFLOWS: '/dashboard/workflows',
      INTELLIGENCE: '/dashboard/intelligence',
      RESOURCES: '/dashboard/resources',
      MEMORY: '/dashboard/memory',
      DECISIONS: '/dashboard/decisions',
      APPROVALS: '/dashboard/approvals',
      ACTIVITY: '/dashboard/activity',
      EVOLUTION: '/dashboard/evolution',
      SIMULATION: '/dashboard/simulation',
      SETTINGS: '/dashboard/settings',
      MCP: '/dashboard/mcp',
      BLUEPRINTS: '/dashboard/blueprints',
      COUNCILS: '/dashboard/councils',
      HARVESTER: '/dashboard/harvester',
    },
  },

  AUTH: {
    DEFAULT_ADMIN_EMAIL: 'admin@neiman.ai',
    DEFAULT_ADMIN_PASSWORD: 'password123',
    SYSTEM_OWNER_ROLE: 'SYSTEM_OWNER',
    AUTONOMOUS_ADMINISTRATOR: 'Autonomous Administrator',
  },

  // Flat legacy aliases for backward compatibility across monorepo packages
  DEFAULT_API_URL: 'http://localhost:8000',
  DEFAULT_WS_URL: 'ws://localhost:8000',
  AUTH_STORAGE_KEY: 'NEIMAN-auth',
  QUERY_CACHE_TTL_MS: 4_000,
  MAX_VISIBLE_STREAM_EVENTS: 30,
  ORG_GRAPH_VIRTUALIZATION_LIMIT: 30,
  ZERO_TRUST_DEEP_LINK_SCHEME: 'neiman://',
} as const;

export function getApiBaseUrl(): string {
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof process !== 'undefined' && process.env?.NEIMAN_API_URL) {
    return process.env.NEIMAN_API_URL;
  }
  return NEIMAN_CONFIG.NETWORK.DEFAULT_API_URL;
}

export function getWsBaseUrl(): string {
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }
  if (typeof process !== 'undefined' && process.env?.NEIMAN_WS_URL) {
    return process.env.NEIMAN_WS_URL;
  }
  const apiBase = getApiBaseUrl();
  if (apiBase.startsWith('http://')) {
    return apiBase.replace('http://', 'ws://');
  }
  if (apiBase.startsWith('https://')) {
    return apiBase.replace('https://', 'wss://');
  }
  return NEIMAN_CONFIG.NETWORK.DEFAULT_WS_URL;
}

export function getOllamaBaseUrl(): string {
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_OLLAMA_URL) {
    return process.env.NEXT_PUBLIC_OLLAMA_URL;
  }
  if (typeof process !== 'undefined' && process.env?.OLLAMA_HOST) {
    return process.env.OLLAMA_HOST;
  }
  return NEIMAN_CONFIG.NETWORK.DEFAULT_OLLAMA_URL;
}

export function getMcpDefaultEndpoint(): string {
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_MCP_DEFAULT_ENDPOINT) {
    return process.env.NEXT_PUBLIC_MCP_DEFAULT_ENDPOINT;
  }
  return NEIMAN_CONFIG.NETWORK.DEFAULT_MCP_ENDPOINT;
}

export function getDevAuthBypass(): boolean {
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_NEIMAN_DEV_AUTH_BYPASS === 'true') {
    return true;
  }
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_NEXORA_DEV_AUTH_BYPASS === 'true') {
    return true;
  }
  return false;
}
