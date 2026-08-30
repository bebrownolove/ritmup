alter table daily_logs
  add column if not exists health_synced_at timestamptz;
