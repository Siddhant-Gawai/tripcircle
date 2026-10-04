-- Disable the unused number-only login API; preserve historical records.
revoke all on function public.tripcircle_number_login(text,uuid,text) from public,anon,authenticated;
revoke all on function tripcircle_private.number_login(text,uuid,text) from public,anon,authenticated;
notify pgrst,'reload schema';
