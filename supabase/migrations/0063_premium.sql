-- Premium bought on Google Play (one non-consumable, `premium_lifetime`). The
-- store is the authority and the phone keeps the entitlement, as for every
-- perk; this table is the copy another device finds again (`my_premium`) and
-- what the support looks at after a refund.
--
-- A purchase is `pending` when the phone reports it, then `verified` or
-- `refused` once the Edge function `premium-verify` has asked the Google Play
-- Developer API about its token, or `unverified` when the function has no
-- service account yet. Only `refused` stops counting.

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  account uuid not null references public.profiles on delete cascade,
  product text not null check (product ~ '^[a-z][a-z0-9_]{1,63}$'),
  token text not null check (length(token) between 10 and 2000),
  order_id text not null default '',
  state text not null default 'pending' check (state in ('pending', 'verified', 'unverified', 'refused')),
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  unique (token)
);

create index purchases_account on public.purchases (account);

alter table public.purchases enable row level security;

-- A player reads their own purchases; nobody writes except the functions below
-- and the Edge function, which holds the service key.
create policy purchases_own on public.purchases for select to authenticated using (account = auth.uid());

-- The phone reports a purchase the store just completed or listed again. The
-- same token twice is the same purchase: it stays with the first account that
-- reported it, and the answer is its state — unless that account was an
-- anonymous one and a named account now reports it: a player who bought before
-- signing in carries Premium to the account their other devices will find.
create function public.record_purchase(p_product text, p_token text, p_order_id text) returns text
language plpgsql security definer set search_path = public as $$
declare
  state_now text;
begin
  if auth.uid() is null then
    return 'forbidden';
  end if;
  if p_product is null or p_product !~ '^[a-z][a-z0-9_]{1,63}$' or p_token is null or length(p_token) not between 10 and 2000 then
    return 'invalid';
  end if;

  insert into public.purchases (account, product, token, order_id)
  values (auth.uid(), p_product, p_token, coalesce(p_order_id, ''))
  on conflict (token) do nothing;

  if public.is_named_account() then
    update public.purchases p set account = auth.uid()
     where p.token = p_token and p.account <> auth.uid()
       and exists (select 1 from auth.users u where u.id = p.account and u.is_anonymous);
  end if;

  select state into state_now from public.purchases where token = p_token and account = auth.uid();
  return coalesce(state_now, 'forbidden');
end;
$$;

-- Whether this account owns Premium on any device.
create function public.my_premium() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.purchases
    where account = auth.uid() and product = 'premium_lifetime' and state <> 'refused'
  );
$$;

revoke execute on function public.record_purchase(text, text, text), public.my_premium() from public, anon;
grant execute on function public.record_purchase(text, text, text), public.my_premium() to authenticated;
