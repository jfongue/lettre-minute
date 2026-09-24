create schema net;

create table net.http_request_queue (
  id bigserial primary key,
  url text not null,
  headers jsonb,
  body jsonb,
  created_at timestamptz not null default now()
);

create function net.http_post(
  url text,
  body jsonb default '{}'::jsonb,
  params jsonb default '{}'::jsonb,
  headers jsonb default '{"Content-Type": "application/json"}'::jsonb,
  timeout_milliseconds integer default 5000
) returns bigint
language sql as $$
  insert into net.http_request_queue (url, headers, body) values (url, headers, body) returning id;
$$;
