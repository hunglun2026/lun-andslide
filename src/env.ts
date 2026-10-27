export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  DATASET_ID: string;
  APP_VERSION: string;
  NTFY_TOPIC?: string;
  ADMIN_TOKEN?: string;
}
