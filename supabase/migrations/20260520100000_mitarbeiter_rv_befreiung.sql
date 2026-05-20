alter table mitarbeiter
  add column if not exists rv_befreiung boolean not null default false;

comment on column mitarbeiter.rv_befreiung is
  'Befreiung von der Rentenversicherungspflicht (§ 6 Abs. 1b SGB VI) — nur relevant bei Minijob';
