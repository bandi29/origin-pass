-- Revoke anon RPC access to tenant helper (Supabase security advisor 0028).
revoke execute on function public.originpass_product_in_user_organization(uuid) from anon;
