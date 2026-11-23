-- 시험 프로젝트 전용: 30일 지난 휴지통만 지워지는지 봐요. 실제 서버에서는 돌리지 마세요.
do $$
declare c uuid := '00000000-0000-0000-0000-000000000002'; n int;
begin
  if (select count(*) from public.songs) > 50 then raise exception '곡이 너무 많아요. 실제 서버 같아서 멈췄어요'; end if;
  insert into public.services (church_id, id, name, text) values (c, 'old-31', '31일', '비밀'), (c, 'old-29', '29일', '비밀'), (c, 'old-0', '안 지움', '비밀') on conflict (id) do nothing;
  alter table public.services disable trigger user;
  update public.services set deleted_at = now() - interval '31 days' where id = 'old-31';
  update public.services set deleted_at = now() - interval '29 days' where id = 'old-29';
  alter table public.services enable trigger user;
  perform public.purge_old_trash();
  if exists (select 1 from public.services where id = 'old-31') then raise exception '실패: 31일 된 것이 남음'; end if;
  if exists (select 1 from public.edit_log where target_id = 'old-31' and before is not null) then raise exception '실패: 기록에 내용이 남음'; end if;
  if not exists (select 1 from public.services where id = 'old-29') then raise exception '실패: 29일 된 것이 지워짐'; end if;
  if not exists (select 1 from public.services where id = 'old-0') then raise exception '실패: 안 지운 것이 지워짐'; end if;
  if not exists (select 1 from cron.job where jobname = 'hogam-purge-trash' and active) then raise exception '실패: 날마다 도는 일이 없음'; end if;
  delete from public.services where id in ('old-29', 'old-0');
  delete from public.edit_log where target_id in ('old-31', 'old-29', 'old-0');
end $$;
select '모두 통과' 결과;
