-- ============================================================
-- 20260913005000_ai.sql — SP6 AI Agent (D-017, R-AI-*)
-- ============================================================
create table if not exists app.ai_conversation (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, title text, summary text, page_context text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists ix_aiconv_user on app.ai_conversation(user_id, updated_at desc);
create table if not exists app.ai_message (
  id bigserial primary key, conversation_id uuid not null references app.ai_conversation(id) on delete cascade,
  role text not null check (role in ('user','assistant','tool')), content text, tool_name text, tool_args jsonb, topic text,
  tokens_in int, tokens_out int, latency_ms int, error text, created_at timestamptz default now()
);
create index if not exists ix_aimsg_conv on app.ai_message(conversation_id, id);
create index if not exists ix_aimsg_topic on app.ai_message(topic, created_at desc) where role = 'user';
alter table app.ai_conversation enable row level security; alter table app.ai_message enable row level security;
drop policy if exists p_own on app.ai_conversation;
create policy p_own on app.ai_conversation for all to authenticated using (user_id = auth.uid() or app.current_role() = 'admin') with check (user_id = auth.uid());
drop policy if exists p_own on app.ai_message;
create policy p_own on app.ai_message for all to authenticated
  using (exists (select 1 from app.ai_conversation c where c.id = conversation_id and (c.user_id = auth.uid() or app.current_role() = 'admin')))
  with check (exists (select 1 from app.ai_conversation c where c.id = conversation_id and c.user_id = auth.uid()));

create or replace view analytics.v_ai_stats_daily as
select date(m.created_at) as day, coalesce(m.topic, '기타') as topic, count(*) as n
from app.ai_message m where m.role = 'user' group by 1, 2;
create or replace view analytics.v_ai_message_log as
select m.id, m.conversation_id, c.user_id, p.name as user_name, p.role as user_role, m.role, left(m.content, 300) as content, m.topic, m.tokens_in, m.tokens_out, m.latency_ms, m.error, m.created_at, c.page_context
from app.ai_message m join app.ai_conversation c on c.id = m.conversation_id left join app.profiles p on p.user_id = c.user_id;

create or replace function app.fn_ai_stats(p_days int) returns jsonb
language sql stable security definer set search_path = app, analytics, public as $$
  select jsonb_build_object(
    'total', (select count(*) from app.ai_message where role = 'user' and created_at > now() - (p_days || ' days')::interval),
    'today', (select count(*) from app.ai_message where role = 'user' and created_at >= date_trunc('day', now())),
    'users', (select count(distinct c.user_id) from app.ai_message m join app.ai_conversation c on c.id = m.conversation_id where m.role = 'user' and m.created_at > now() - (p_days || ' days')::interval),
    'errors', (select count(*) from app.ai_message where role = 'assistant' and error is not null and created_at > now() - (p_days || ' days')::interval),
    'topics', coalesce((select jsonb_agg(jsonb_build_object('topic', topic, 'n', n) order by n desc) from (select coalesce(topic, '기타') topic, count(*) n from app.ai_message where role = 'user' and created_at > now() - (p_days || ' days')::interval group by 1) t), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'n', n) order by day) from (select day, sum(n) n from analytics.v_ai_stats_daily where day > current_date - p_days group by 1) d), '[]'::jsonb),
    'top_users', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'n', n) order by n desc) from (select p.name, count(*) n from app.ai_message m join app.ai_conversation c on c.id = m.conversation_id left join app.profiles p on p.user_id = c.user_id where m.role = 'user' and m.created_at > now() - (p_days || ' days')::interval group by 1 order by 2 desc limit 10) u), '[]'::jsonb)
  ) $$;
