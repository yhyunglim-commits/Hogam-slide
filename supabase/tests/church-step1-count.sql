-- 교회 칸을 넣은 뒤 돌려요 (시험·실제 서버 둘 다). 줄 수가 백업 때와 같고, '교회 빈칸'이 모두 0이면 맞아요.
select t 표, n 줄수, empty 교회_빈칸 from (
  select 'members' t, count(*) n, count(*) filter (where church_id is null) empty from public.members
  union all select 'songs', count(*), count(*) filter (where church_id is null) from public.songs
  union all select 'services', count(*), count(*) filter (where church_id is null) from public.services
  union all select 'team_settings', count(*), count(*) filter (where church_id is null) from public.team_settings
  union all select 'edit_log', count(*), count(*) filter (where church_id is null) from public.edit_log
  union all select 'churches', count(*), 0 from public.churches
) x;
