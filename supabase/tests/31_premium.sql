-- 0063 : un achat Premium suit le compte qui l'a déclaré, et passe d'un
-- compte anonyme au compte nommé qui le déclare à son tour.

select tests.new_user('pa');
select tests.new_user('pb');
select tests.new_user('pan', true);

select tests.login('pa');
select tests.is(public.my_premium(), false, 'nobody owns Premium before buying');
select tests.is(public.record_purchase('premium_lifetime', 'token-pa-0001', 'GPA.1'), 'pending', 'a purchase reported is pending');
select tests.is(public.record_purchase('premium_lifetime', 'token-pa-0001', 'GPA.1'), 'pending', 'reporting it again changes nothing');
select tests.is(public.my_premium(), true, 'and counts at once');
select tests.is(public.record_purchase('premium_lifetime', 'short', ''), 'invalid', 'a malformed token is refused');
select tests.logout();

select tests.login('pb');
select tests.is(public.record_purchase('premium_lifetime', 'token-pa-0001', 'GPA.1'), 'forbidden', 'another named account cannot take a purchase');
select tests.is(public.my_premium(), false, 'nor own it');
select tests.logout();

select tests.login('pan');
select tests.is(public.record_purchase('premium_lifetime', 'token-pan-0001', 'GPA.2'), 'pending', 'an anonymous player can buy');
select tests.logout();

select tests.login('pb');
select tests.is(public.record_purchase('premium_lifetime', 'token-pan-0001', 'GPA.2'), 'pending', 'a named account takes over an anonymous purchase');
select tests.is(public.my_premium(), true, 'and owns Premium on every device');
select tests.logout();

update public.purchases set state = 'refused' where token = 'token-pa-0001';
select tests.login('pa');
select tests.is(public.my_premium(), false, 'a refused purchase stops counting');
select tests.logout();
