alter table sessions
  add column if not exists auth_name text,
  add column if not exists auth_email text;
