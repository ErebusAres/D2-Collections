export interface Env {
  DB: D1Database;
  BUNGIE_API_KEY: string;
  BUNGIE_CLIENT_ID: string;
  BUNGIE_CLIENT_SECRET: string;
  OAUTH_ENCRYPTION_KEY: string;
  ALLOWED_ORIGIN: string;
  WEB_ORIGIN: string;
  GAME_DATA_URL: string;
  DEV_MEMBERSHIP_IDS: string;
  MATRIX_MEMBERSHIP_IDS: string;
}

export interface SessionRow {
  session_hash: string;
  membership_id: string;
  membership_type: number;
  display_name: string;
  bungie_name: string;
  access_token_cipher: string;
  refresh_token_cipher: string;
  access_expires_at: number;
  refresh_expires_at: number;
}

export interface RequestContext {
  requestId: string;
  url: URL;
  origin: string;
}
