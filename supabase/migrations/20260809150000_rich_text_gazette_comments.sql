alter table public.gazette_comments
  drop constraint if exists gazette_comments_body_check;

alter table public.gazette_comments
  alter column body drop default,
  alter column body type jsonb using jsonb_build_object(
    'type', 'doc',
    'content', jsonb_build_array(
      jsonb_build_object(
        'type', 'paragraph',
        'content', jsonb_build_array(
          jsonb_build_object('type', 'text', 'text', body)
        )
      )
    )
  );

alter table public.gazette_comments
  alter column body set default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  add constraint gazette_comments_body_check check (
    jsonb_typeof(body) = 'object'
    and body ->> 'type' = 'doc'
    and pg_column_size(body) <= 16000
  );
