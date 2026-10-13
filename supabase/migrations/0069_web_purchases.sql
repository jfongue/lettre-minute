-- Premium bought off Google Play: the web page sells the same lifetime product
-- through a merchant of record (Lemon Squeezy), and its webhook writes the
-- order here. `provider` says where a purchase came from, so a Play order and
-- a merchant order can never be mistaken for one another, and `email` keeps
-- the buyer's address for support, which the phone stores never hand over.
--
-- Nothing else changes: `my_premium` (0063) already counts every row of
-- `premium_lifetime` in a state other than `refused`, whichever provider
-- wrote it, and only the Edge functions write rows for a merchant purchase —
-- `record_purchase` stays the phone's own door.

alter table public.purchases
  add column provider text not null default 'play' check (provider in ('play', 'lemonsqueezy')),
  add column email text not null default '';
