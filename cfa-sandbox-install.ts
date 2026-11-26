// Fixed reviewed migration; public Supabase 2021 CA. No browser SQL input.
export const SUPABASE_CA=String.raw`-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----
`;
export const UPGRADE_SQL=String.raw`DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_001 BEGIN'; END $cfa_stage$;
BEGIN;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_002 SELECT pg_advisory_xact_lock hashtextextended cfa rewards install 0'; END $cfa_stage$;

SELECT pg_advisory_xact_lock(hashtextextended('cfa-rewards-install',0));
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_003 CREATE TABLE IF NOT EXISTS public.cfa_reward_claims'; END $cfa_stage$;

CREATE TABLE IF NOT EXISTS public.cfa_reward_claims (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 environment text NOT NULL CHECK(environment IN('live','sandbox')),milestone integer NOT NULL CHECK(milestone>0),required_points integer NOT NULL,
 state text NOT NULL DEFAULT 'earned' CHECK(state IN('earned','assigned','delivered','message_provided')),
 items jsonb NOT NULL DEFAULT '[]',method text CHECK(method IN('personal','message','coupon')),
 qualifying_amount numeric NOT NULL DEFAULT 0,source_bookings jsonb NOT NULL DEFAULT '[]',
 created_at timestamptz NOT NULL DEFAULT now(),assigned_at timestamptz,closed_at timestamptz,
 assigned_by uuid,closed_by uuid,owner_hidden boolean NOT NULL DEFAULT false,revision integer NOT NULL DEFAULT 0,
 coupon_id bigint REFERENCES public.discount_codes(id),UNIQUE(user_id,environment,milestone)
);
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_004 ALTER TABLE public.cfa_reward_claims ADD COLUMN IF NOT EXISTS conversation_id bigint'; END $cfa_stage$;

ALTER TABLE public.cfa_reward_claims ADD COLUMN IF NOT EXISTS conversation_id bigint;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_005 ALTER TABLE public.cfa_reward_claims ADD COLUMN IF NOT EXISTS last_message_id bigint'; END $cfa_stage$;

ALTER TABLE public.cfa_reward_claims ADD COLUMN IF NOT EXISTS last_message_id bigint;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_006 CREATE TABLE IF NOT EXISTS public.cfa_reward_audit'; END $cfa_stage$;

CREATE TABLE IF NOT EXISTS public.cfa_reward_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,claim_id uuid NOT NULL REFERENCES public.cfa_reward_claims(id) ON DELETE CASCADE,
 actor uuid,action text NOT NULL,details jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now()
);
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_007 CREATE TABLE IF NOT EXISTS public.cfa_reward_mail_jobs'; END $cfa_stage$;

CREATE TABLE IF NOT EXISTS public.cfa_reward_mail_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),secret uuid NOT NULL DEFAULT gen_random_uuid(),dedup text NOT NULL UNIQUE,
 recipient text NOT NULL,subject text NOT NULL,body text NOT NULL,claim_id uuid NOT NULL REFERENCES public.cfa_reward_claims(id) ON DELETE CASCADE,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN('pending','sending','sent')),attempts integer NOT NULL DEFAULT 0,
 locked_until timestamptz,lock_token uuid,last_dispatch timestamptz,sent_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_008 CREATE TABLE IF NOT EXISTS public.cfa_reward_coupon_uses'; END $cfa_stage$;

CREATE TABLE IF NOT EXISTS public.cfa_reward_coupon_uses (
 coupon_id bigint PRIMARY KEY REFERENCES public.discount_codes(id),booking_id bigint NOT NULL,
 test_checkout_id uuid,used_at timestamptz NOT NULL DEFAULT now()
);
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_009 CREATE TABLE IF NOT EXISTS public.cfa_reward_coupon_holds'; END $cfa_stage$;

CREATE TABLE IF NOT EXISTS public.cfa_reward_coupon_holds (
 coupon_id bigint PRIMARY KEY REFERENCES public.discount_codes(id),booking_id bigint NOT NULL,expires_at timestamptz NOT NULL
);
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_010 DO DECLARE t text BEGIN'; END $cfa_stage$;

DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['cfa_reward_claims','cfa_reward_audit','cfa_reward_mail_jobs','cfa_reward_coupon_uses','cfa_reward_coupon_holds'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
 END LOOP;
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_011 CREATE OR REPLACE FUNCTION public.cfa_reward_sources p_user uuid p_environment text'; END $cfa_stage$;

CREATE OR REPLACE FUNCTION public.cfa_reward_sources(p_user uuid,p_environment text)
RETURNS TABLE(order_id text,title text,amount numeric,points bigint,paid_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF p_environment='sandbox' THEN
 RETURN QUERY SELECT s.id::text,s.snapshot->'event'->>'title',(s.snapshot->>'total')::numeric,
 sum(GREATEST(0,(i->>'quantity')::integer-CASE WHEN jsonb_array_length(COALESCE(i->'child_ages','[]'))=(i->>'quantity')::integer
 THEN (SELECT count(*) FROM jsonb_array_elements_text(i->'child_ages') a WHERE a::integer<5) ELSE 0 END))::bigint,s.paid_at
 FROM public.cfa_test_checkouts s CROSS JOIN LATERAL jsonb_array_elements(s.snapshot->'items') i
 WHERE s.user_id=p_user AND s.status='paid' AND s.refunded_pence=0 AND s.expected_pence>0
 AND i->>'category'='ticket' AND (i->>'unit_price')::numeric>0 AND (i->>'line_total')::numeric>0
 GROUP BY s.id,s.snapshot,s.paid_at;
 ELSIF p_environment='live' THEN
 RETURN QUERY SELECT b.id::text,e.title,b.total_amount,sum(i.quantity)::bigint,COALESCE(b.updated_at,b.created_at)
 FROM public.bookings b JOIN public.events e ON e.id=b.event_id JOIN public.booking_items i ON i.booking_id=b.id
 WHERE b.user_id=p_user AND b.status IN('confirmed','completed') AND b.payment_status='paid'
 AND b.cancelled_at IS NULL AND NOT COALESCE(b.cart_expired,false) AND b.total_amount>0 AND b.amount_paid>=b.total_amount
 AND i.category='ticket' AND i.unit_price>0 AND i.line_total>0 AND i.quantity>0 GROUP BY b.id,e.title;
 ELSE RAISE EXCEPTION 'invalid_environment';END IF;
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_012 CREATE OR REPLACE FUNCTION public.cfa_reward_points p_user uuid p_environment text RE'; END $cfa_stage$;

CREATE OR REPLACE FUNCTION public.cfa_reward_points(p_user uuid,p_environment text) RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT COALESCE(sum(points),0)::bigint FROM public.cfa_reward_sources(p_user,p_environment) $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_013 CREATE OR REPLACE FUNCTION public.cfa_reward_dispatch_pending RETURNS void'; END $cfa_stage$;

CREATE OR REPLACE FUNCTION public.cfa_reward_dispatch_pending() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE j record;BEGIN
 FOR j IN SELECT id,secret FROM public.cfa_reward_mail_jobs WHERE state<>'sent' AND attempts<20
 AND (locked_until IS NULL OR locked_until<now()) AND (last_dispatch IS NULL OR last_dispatch<now()-interval '2 minutes')
 ORDER BY created_at LIMIT 20 FOR UPDATE SKIP LOCKED LOOP
  BEGIN
   PERFORM net.http_post(url:='https://btkblcngijheanyhyiow.supabase.co/functions/v1/cfa-booking-sandbox?reward-mail=1',
    headers:='{"Content-Type":"application/json"}'::jsonb,body:=jsonb_build_object('id',j.id,'token',j.secret),timeout_milliseconds:=10000);
   UPDATE public.cfa_reward_mail_jobs SET last_dispatch=now() WHERE id=j.id;
  EXCEPTION WHEN OTHERS THEN NULL;END;
 END LOOP;
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_014 CREATE OR REPLACE FUNCTION public.cfa_reward_queue_mail p_claim uuid p_kind text RETU'; END $cfa_stage$;

CREATE OR REPLACE FUNCTION public.cfa_reward_queue_mail(p_claim uuid,p_kind text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.cfa_reward_claims;u record;o record;body text;labels text;prefix text;BEGIN
 SELECT * INTO r FROM public.cfa_reward_claims WHERE id=p_claim;
 SELECT a.email,COALESCE(NULLIF(p.display_name,''),a.email) name INTO u FROM auth.users a LEFT JOIN public.user_profiles p ON p.user_id=a.id WHERE a.id=r.user_id;
 prefix:=CASE WHEN r.environment='sandbox' THEN '[TEST / SKÚŠKA] ' ELSE '' END;
 SELECT COALESCE(string_agg((x->>'en')||' / '||(x->>'sk'),E'\n'),'') INTO labels FROM jsonb_array_elements(r.items) x;
 body:=prefix||'Reward / Odmena: '||r.id||E'\nUser / Používateľ: '||u.name||E'\nEmail / E-mail: '||u.email||
 E'\nPoints required / Potrebné body: '||r.required_points||E'\nQualifying bookings total / Suma započítaných rezervácií: GBP '||r.qualifying_amount||
 E'\nStatus / Stav: '||CASE r.state WHEN 'earned' THEN 'Earned / Nárok získaný' WHEN 'assigned' THEN 'Awaiting personal collection / Čaká na osobné prevzatie' WHEN 'delivered' THEN 'Handed over in person / Odovzdané osobne' ELSE 'Provided by private message / Poskytnuté správou' END||E'\n'||labels||
 E'\nhttps://tatrycupcio.uk/?cfa-reward='||r.id||'&reward-mode='||r.environment;
 FOR o IN SELECT a.email FROM public.admin_users ad JOIN auth.users a ON a.id=ad.user_id WHERE ad.role='owner' AND a.email_confirmed_at IS NOT NULL LOOP
 INSERT INTO public.cfa_reward_mail_jobs(dedup,recipient,subject,body,claim_id) VALUES(r.id||':'||p_kind||':'||o.email,o.email,prefix||'Reward / Odmena - '||u.name,body,r.id) ON CONFLICT(dedup) DO NOTHING;
 END LOOP;
 IF p_kind='closed' AND u.email IS NOT NULL THEN
 INSERT INTO public.cfa_reward_mail_jobs(dedup,recipient,subject,body,claim_id) VALUES(r.id||':'||p_kind||':'||u.email,u.email,prefix||'Reward completed / Odmena vybavená',body,r.id) ON CONFLICT(dedup) DO NOTHING;
 END IF;
 PERFORM public.cfa_reward_dispatch_pending();
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_015 CREATE OR REPLACE FUNCTION public.cfa_reward_sync p_user uuid p_environment text RETU'; END $cfa_stage$;

CREATE OR REPLACE FUNCTION public.cfa_reward_sync(p_user uuid,p_environment text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE total bigint; m integer; r uuid; src jsonb; cash numeric;BEGIN
 IF p_user IS NULL THEN RETURN;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('cfa-reward:'||p_user||':'||p_environment,0));
 total:=public.cfa_reward_points(p_user,p_environment);
 FOR m IN SELECT generate_series(1,LEAST(total/6,1000000)::integer) LOOP
  WITH ordered AS(SELECT *,sum(points) OVER(ORDER BY paid_at,order_id) hi FROM public.cfa_reward_sources(p_user,p_environment)),matched AS(
   SELECT order_id,title,amount,points,paid_at FROM ordered WHERE hi>(m-1)*6 AND hi-points<m*6)
  SELECT COALESCE(jsonb_agg(to_jsonb(matched)),'[]'),COALESCE(sum(amount),0) INTO src,cash FROM matched;
  INSERT INTO public.cfa_reward_claims(user_id,environment,milestone,required_points,qualifying_amount,source_bookings)
   VALUES(p_user,p_environment,m,m*6,cash,src) ON CONFLICT(user_id,environment,milestone) DO NOTHING RETURNING id INTO r;
  IF r IS NOT NULL THEN
   INSERT INTO public.cfa_reward_audit(claim_id,action) VALUES(r,'earned');PERFORM public.cfa_reward_queue_mail(r,'earned');
  END IF;
 END LOOP;
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_016 CREATE OR REPLACE FUNCTION public.cfa_reward_test_changed RETURNS trigger'; END $cfa_stage$;

CREATE OR REPLACE FUNCTION public.cfa_reward_test_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 BEGIN PERFORM public.cfa_reward_sync(NEW.user_id,'sandbox');
 EXCEPTION WHEN OTHERS THEN RAISE LOG 'CFA reward sync deferred; payment retained';END;RETURN NEW;
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_017 DROP TRIGGER IF EXISTS cfa_reward_test_changed ON public.cfa_test_checkouts'; END $cfa_stage$;

DROP TRIGGER IF EXISTS cfa_reward_test_changed ON public.cfa_test_checkouts;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_018 CREATE TRIGGER cfa_reward_test_changed AFTER INSERT OR UPDATE OF status refunded_penc'; END $cfa_stage$;

CREATE TRIGGER cfa_reward_test_changed AFTER INSERT OR UPDATE OF status,refunded_pence ON public.cfa_test_checkouts
 FOR EACH ROW EXECUTE FUNCTION public.cfa_reward_test_changed();
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_019 CREATE OR REPLACE FUNCTION public.cfa_loyalty_sync_user p_user uuid RETURNS void'; END $cfa_stage$;

-- Existing live booking/item triggers call this function. Replace only the obsolete bell dispatch.
CREATE OR REPLACE FUNCTION public.cfa_loyalty_sync_user(p_user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN PERFORM public.cfa_reward_sync(p_user,'live');END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_020 CREATE OR REPLACE FUNCTION public.cfa_reward_dm p_recipient uuid p_body text RETURNS '; END $cfa_stage$;

CREATE OR REPLACE FUNCTION public.cfa_reward_dm(p_recipient uuid,p_body text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE convo bigint;mid bigint;BEGIN
 IF NOT public.cfa_is_owner() THEN RAISE EXCEPTION 'owner_required';END IF;
 IF p_recipient=auth.uid() THEN
  SELECT c.id INTO convo FROM public.private_conversations c WHERE c.created_by=auth.uid() AND c.name='My reward receipts / Moje potvrdenia odmien' AND NOT c.is_group ORDER BY c.id LIMIT 1;
  IF convo IS NULL THEN
   INSERT INTO public.private_conversations(created_by,name,is_group) VALUES(auth.uid(),'My reward receipts / Moje potvrdenia odmien',false) RETURNING id INTO convo;
   INSERT INTO public.private_conversation_members(conversation_id,user_id) VALUES(convo,auth.uid());
   INSERT INTO public.private_conversation_memberships(conversation_id,user_id,added_by) VALUES(convo,auth.uid(),auth.uid());
  END IF;
 ELSE
  PERFORM set_config('search_path','pg_catalog,public,pg_temp',true);
  convo:=public.create_private_conversation(p_recipient);
  PERFORM set_config('search_path','',true);
 END IF;
 INSERT INTO public.private_messages(sender_id,receiver_id,conversation_id,message_text) VALUES(auth.uid(),p_recipient,convo,p_body) RETURNING id INTO mid;RETURN mid;
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_021 CREATE OR REPLACE FUNCTION public.cfa_reward_list p_environment text DEFAULT live p_a'; END $cfa_stage$;

CREATE OR REPLACE FUNCTION public.cfa_reward_list(p_environment text DEFAULT 'live',p_admin boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid();a boolean;v jsonb;rec record;BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'sign_in_required';END IF;
 IF p_environment NOT IN('live','sandbox') THEN RAISE EXCEPTION 'invalid_environment';END IF;
 a:=public.cfa_is_owner();IF p_admin AND NOT a THEN RAISE EXCEPTION 'owner_required';END IF;
 IF p_environment='sandbox' AND NOT public.cfa_test_is_member() THEN RAISE EXCEPTION 'test_access_required';END IF;
 IF p_admin THEN
  FOR rec IN SELECT id FROM auth.users WHERE p_environment='live' OR EXISTS(SELECT 1 FROM public.cfa_test_access t WHERE t.user_id=auth.users.id) LOOP
   PERFORM public.cfa_reward_sync(rec.id,p_environment);
  END LOOP;
 ELSE PERFORM public.cfa_reward_sync(u,p_environment);END IF;
 SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at,x.id),'[]') INTO v FROM(
  SELECT r.*,COALESCE(NULLIF(p.display_name,''),au.email) display_name,au.email,
   public.cfa_reward_points(r.user_id,p_environment)>=r.required_points eligible,
   dc.code coupon_code,dc.discount_value coupon_percent,dc.valid_until coupon_expires,
   CASE WHEN r.environment='sandbox' THEN (SELECT t.checkout_url FROM public.cfa_test_checkouts t WHERE t.user_id=r.user_id AND (t.snapshot->>'reward_coupon_id')::bigint=r.coupon_id AND t.status IN('creating','awaiting_payment') ORDER BY t.created_at DESC LIMIT 1) END coupon_checkout_url,
   EXISTS(SELECT 1 FROM public.cfa_reward_coupon_uses cu WHERE cu.coupon_id=r.coupon_id) coupon_used,
   CASE WHEN r.closed_by IS NOT NULL THEN COALESCE((SELECT NULLIF(up.display_name,'') FROM public.user_profiles up WHERE up.user_id=r.closed_by),'Team / Tím') END closed_by_name
  FROM public.cfa_reward_claims r JOIN auth.users au ON au.id=r.user_id LEFT JOIN public.user_profiles p ON p.user_id=r.user_id
  LEFT JOIN public.discount_codes dc ON dc.id=r.coupon_id
  WHERE r.environment=p_environment AND (p_admin OR r.user_id=u) AND (NOT p_admin OR NOT r.owner_hidden)
 )x;
 PERFORM public.cfa_reward_dispatch_pending();
 RETURN jsonb_build_object('claims',v,'can_manage',a,'environment',p_environment,
  'pending_mail',CASE WHEN p_admin THEN (SELECT count(*) FROM public.cfa_reward_mail_jobs WHERE state<>'sent') ELSE 0 END);

END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_022 CREATE OR REPLACE FUNCTION public.cfa_reward_update p_claim uuid p_action text p_item'; END $cfa_stage$;

CREATE OR REPLACE FUNCTION public.cfa_reward_update(p_claim uuid,p_action text,p_items jsonb DEFAULT '[]',p_method text DEFAULT 'personal',p_percent numeric DEFAULT NULL,p_days integer DEFAULT 90,p_revision integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.cfa_reward_claims;code text;cid bigint;labels text;body text;prefix text;v_items jsonb;v_message bigint;v_conversation bigint;BEGIN
 IF auth.uid() IS NULL OR NOT public.cfa_is_owner() THEN RAISE EXCEPTION 'owner_required';END IF;
 SELECT * INTO r FROM public.cfa_reward_claims WHERE id=p_claim FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'reward_not_found';END IF;
 IF r.revision<>p_revision THEN RETURN jsonb_build_object('ok',false,'error','reward_changed');END IF;
 IF p_action='hide' THEN
  IF r.state NOT IN('delivered','message_provided') THEN RAISE EXCEPTION 'reward_not_closed';END IF;
  UPDATE public.cfa_reward_claims SET owner_hidden=true,revision=revision+1 WHERE id=r.id;
  INSERT INTO public.cfa_reward_audit(claim_id,actor,action) VALUES(r.id,auth.uid(),'hidden_from_owner');RETURN jsonb_build_object('ok',true);
 END IF;
 IF r.state IN('delivered','message_provided') THEN RETURN jsonb_build_object('ok',true,'already_closed',true);END IF;
 IF public.cfa_reward_points(r.user_id,r.environment)<r.required_points THEN RAISE EXCEPTION 'reward_not_eligible';END IF;
 prefix:=CASE WHEN r.environment='sandbox' THEN E'TEST / SKÚŠKA\n' ELSE '' END;
 IF p_action='assign' THEN
  IF r.state<>'earned' OR p_method NOT IN('personal','message','coupon') THEN RAISE EXCEPTION 'invalid_reward_action';END IF;
  IF jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)>20 THEN RAISE EXCEPTION 'invalid_reward_items';END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x WHERE jsonb_typeof(x)<>'object' OR length(COALESCE(x->>'sk',''))>500 OR length(COALESCE(x->>'en',''))>500 OR ((COALESCE(btrim(x->>'sk'),'')='')<>(COALESCE(btrim(x->>'en'),'')=''))) THEN RAISE EXCEPTION 'reward_both_languages';END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('sk',btrim(x->>'sk'),'en',btrim(x->>'en'))),'[]') INTO v_items FROM jsonb_array_elements(p_items)x WHERE COALESCE(btrim(x->>'sk'),'')<>'';
  IF p_method='coupon' THEN
   IF p_percent IS NULL OR p_percent<=0 OR p_percent>99 OR p_days NOT BETWEEN 1 AND 730 THEN RAISE EXCEPTION 'invalid_coupon';END IF;
   code:=CASE WHEN r.environment='sandbox' THEN 'TEST-R-' ELSE 'CFA-R-' END||upper(replace(gen_random_uuid()::text,'-',''));
   INSERT INTO public.discount_codes(code,description,active,scope,discount_type,discount_value,max_uses,max_uses_per_user,valid_from,valid_until,created_by)
    VALUES(code,'Reward / Odmena '||r.id,true,'booking','percent',p_percent,1,1,now(),now()+p_days*interval '1 day',auth.uid()) RETURNING id INTO cid;
  END IF;
  UPDATE public.cfa_reward_claims SET items=v_items,method=p_method,coupon_id=cid,assigned_at=now(),assigned_by=auth.uid(),
   state=CASE WHEN p_method='personal' THEN 'assigned' ELSE 'message_provided' END,
   closed_at=CASE WHEN p_method<>'personal' THEN now() END,closed_by=CASE WHEN p_method<>'personal' THEN auth.uid() END,revision=revision+1
   WHERE id=r.id RETURNING * INTO r;
  SELECT COALESCE(string_agg((x->>'en')||' / '||(x->>'sk'),E'\n'),'Reward from our team / Odmena od nášho tímu') INTO labels FROM jsonb_array_elements(r.items)x;
  body:=prefix||'Reward assigned / Odmena pridelená'||E'\n'||labels;
  IF p_method='personal' THEN body:=body||E'\nAt the next event organised by Tatry Cup Community Organisation CIO, please find our team and show this reward entitlement in the app. We will verify it before handing over your reward.\nNa najbližšom podujatí organizovanom Tatry Cup Community Organisation CIO nás osobne vyhľadajte a preukážte sa týmto nárokom v aplikácii. Pred vydaním overíme jeho platnosť.';
  ELSIF p_method='coupon' THEN body:=body||E'\nProvided by private message / Poskytnuté správou\nCoupon / Kupón: '||code||E'\nDiscount / Zľava: '||p_percent||E'%\nOne use, only for your account. Valid until / Jednorazový, iba pre váš účet. Platnosť do: '||to_char(now()+p_days*interval '1 day','DD/MM/YYYY');
  ELSE body:=body||E'\nProvided by private message / Poskytnuté správou';END IF;
 ELSIF p_action='deliver' THEN
  IF r.state<>'assigned' OR r.method<>'personal' THEN RAISE EXCEPTION 'reward_not_assigned';END IF;
  UPDATE public.cfa_reward_claims SET state='delivered',closed_at=now(),closed_by=auth.uid(),revision=revision+1 WHERE id=r.id RETURNING * INTO r;
  SELECT COALESCE(string_agg((x->>'en')||' / '||(x->>'sk'),E'\n'),'Reward from our team / Odmena od nášho tímu') INTO labels FROM jsonb_array_elements(r.items)x;
  body:=prefix||E'Handed over in person / Odovzdané osobne\n'||labels;
 ELSE RAISE EXCEPTION 'invalid_reward_action';END IF;
 body:=body||E'\nReward ID / Číslo nároku: '||r.id||E'\nRecorded / Zaznamenané: '||to_char(now() AT TIME ZONE 'Europe/London','DD/MM/YYYY HH24:MI')||' UK';
 v_message:=public.cfa_reward_dm(r.user_id,body);
 SELECT m.conversation_id INTO v_conversation FROM public.private_messages m WHERE m.id=v_message;
 UPDATE public.cfa_reward_claims SET conversation_id=v_conversation,last_message_id=v_message WHERE id=r.id;
 INSERT INTO public.cfa_reward_audit(claim_id,actor,action,details) VALUES(r.id,auth.uid(),p_action,jsonb_build_object('items',r.items,'method',r.method,'state',r.state));
 IF r.state IN('delivered','message_provided') THEN PERFORM public.cfa_reward_queue_mail(r.id,'closed');END IF;
 RETURN jsonb_build_object('ok',true);
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_023 DO BEGIN'; END $cfa_stage$;

-- One-time coupons remain bound to one account and one active checkout.
DO $$ BEGIN
 IF to_regprocedure('public.cfa_apply_discount_before_rewards(bigint,text)') IS NULL THEN
  ALTER FUNCTION public.apply_discount_code(bigint,text) RENAME TO cfa_apply_discount_before_rewards;
 END IF;
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_024 REVOKE ALL ON FUNCTION public.cfa_apply_discount_before_rewards bigint text FROM PUBL'; END $cfa_stage$;

REVOKE ALL ON FUNCTION public.cfa_apply_discount_before_rewards(bigint,text) FROM PUBLIC,anon,authenticated;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_025 CREATE OR REPLACE FUNCTION public.apply_discount_code p_booking_id bigint p_code text'; END $cfa_stage$;

CREATE OR REPLACE FUNCTION public.apply_discount_code(p_booking_id bigint,p_code text)
RETURNS TABLE(subtotal numeric,discount numeric,total numeric,message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.cfa_reward_claims;dc public.discount_codes;hold public.cfa_reward_coupon_holds;b public.bookings;BEGIN
 SELECT * INTO dc FROM public.discount_codes WHERE upper(code)=upper(trim(p_code)) LIMIT 1 FOR UPDATE;
 SELECT * INTO r FROM public.cfa_reward_claims WHERE coupon_id=dc.id;
 IF FOUND THEN
  IF auth.uid() IS NULL OR r.user_id<>auth.uid() OR r.state<>'message_provided'
    OR public.cfa_reward_points(r.user_id,r.environment)<r.required_points THEN RAISE EXCEPTION 'reward_coupon_not_for_account';END IF;
  IF EXISTS(SELECT 1 FROM public.cfa_reward_coupon_uses WHERE coupon_id=dc.id) THEN RAISE EXCEPTION 'reward_coupon_used';END IF;
  IF r.environment='sandbox' AND NOT public.cfa_test_is_member() THEN RAISE EXCEPTION 'test_access_required';END IF;
  SELECT * INTO b FROM public.bookings WHERE id=p_booking_id AND user_id=auth.uid() AND status='cart' AND NOT cart_expired;
  IF NOT FOUND THEN RAISE EXCEPTION 'cart_unavailable';END IF;
  SELECT * INTO hold FROM public.cfa_reward_coupon_holds WHERE coupon_id=dc.id FOR UPDATE;
  IF FOUND AND hold.booking_id<>b.id AND (hold.expires_at>now() OR EXISTS(SELECT 1 FROM public.cfa_test_checkouts t
     WHERE t.booking_id=hold.booking_id AND (t.snapshot->>'reward_coupon_id')::bigint=dc.id AND t.status IN('creating','awaiting_payment'))) THEN RAISE EXCEPTION 'reward_coupon_in_another_cart';END IF;
  INSERT INTO public.cfa_reward_coupon_holds(coupon_id,booking_id,expires_at) VALUES(dc.id,b.id,COALESCE(b.cart_expires_at,now()+interval '20 minutes'))
   ON CONFLICT(coupon_id) DO UPDATE SET booking_id=EXCLUDED.booking_id,expires_at=EXCLUDED.expires_at;
 END IF;
 RETURN QUERY SELECT * FROM public.cfa_apply_discount_before_rewards(p_booking_id,p_code);
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_026 REVOKE ALL ON FUNCTION public.apply_discount_code bigint text FROM PUBLIC anon'; END $cfa_stage$;

REVOKE ALL ON FUNCTION public.apply_discount_code(bigint,text) FROM PUBLIC,anon;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_027 GRANT EXECUTE ON FUNCTION public.apply_discount_code bigint text TO authenticated'; END $cfa_stage$;

GRANT EXECUTE ON FUNCTION public.apply_discount_code(bigint,text) TO authenticated;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_028 DO BEGIN'; END $cfa_stage$;

-- Preserve the complete existing checkout validation regardless of its formatting.
-- Add immutable coupon metadata through a wrapper, not SQL source substitution.
DO $$ BEGIN
 IF to_regprocedure('public.cfa_prepare_test_checkout_before_rewards(bigint,text)') IS NULL THEN
  ALTER FUNCTION public.cfa_prepare_test_checkout(bigint,text) RENAME TO cfa_prepare_test_checkout_before_rewards;
 END IF;
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_029 CREATE OR REPLACE FUNCTION public.cfa_prepare_test_checkout p_booking_id bigint p_lan'; END $cfa_stage$;

-- Keep existing grants on the original preparation function: it retains every
-- original identity/email/cart/amount check and cannot create or confirm a Square
-- payment. The only payment-link creator calls the wrapper below. Preserving its
-- ACL also preserves valid delegated grants and SQL dependencies.
CREATE OR REPLACE FUNCTION public.cfa_prepare_test_checkout(p_booking_id bigint,p_language text DEFAULT 'sk')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;checkout public.cfa_test_checkouts;coupon bigint;BEGIN
 IF NOT public.cfa_test_is_member() THEN RAISE EXCEPTION 'test_access_required';END IF;
 result:=public.cfa_prepare_test_checkout_before_rewards(p_booking_id,p_language);
 SELECT * INTO checkout FROM public.cfa_test_checkouts WHERE id=(result->>'id')::uuid FOR UPDATE;
 IF NOT FOUND OR checkout.user_id IS DISTINCT FROM auth.uid() OR checkout.booking_id IS DISTINCT FROM p_booking_id THEN RAISE EXCEPTION 'cart_unavailable';END IF;
 SELECT discount_code_id INTO coupon FROM public.bookings WHERE id=p_booking_id AND user_id=auth.uid();
 IF (checkout.snapshot->>'reward_coupon_id')::bigint IS DISTINCT FROM coupon THEN
  IF checkout.square_link_id IS NOT NULL OR checkout.status NOT IN('creating','awaiting_payment') THEN RAISE EXCEPTION 'cart_total_invalid';END IF;
 END IF;
 IF checkout.square_link_id IS NULL AND checkout.status IN('creating','awaiting_payment') THEN
  UPDATE public.cfa_test_checkouts SET snapshot=snapshot||jsonb_build_object('reward_coupon_id',coupon) WHERE id=checkout.id;
 END IF;
 RETURN result;
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_030 REVOKE ALL ON FUNCTION public.cfa_prepare_test_checkout bigint text FROM PUBLIC anon'; END $cfa_stage$;

REVOKE ALL ON FUNCTION public.cfa_prepare_test_checkout(bigint,text) FROM PUBLIC,anon;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_031 GRANT EXECUTE ON FUNCTION public.cfa_prepare_test_checkout bigint text TO authenticat'; END $cfa_stage$;

GRANT EXECUTE ON FUNCTION public.cfa_prepare_test_checkout(bigint,text) TO authenticated;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_032 CREATE OR REPLACE FUNCTION public.cfa_reward_coupon_payment RETURNS trigger'; END $cfa_stage$;

CREATE OR REPLACE FUNCTION public.cfa_reward_coupon_payment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE code_id bigint;r public.cfa_reward_claims;prior public.cfa_reward_coupon_uses;BEGIN
 IF TG_TABLE_NAME='cfa_test_checkouts' THEN
  IF NEW.status<>'paid' OR (TG_OP='UPDATE' AND OLD.status='paid') THEN RETURN NEW;END IF;
  code_id:=(NEW.snapshot->>'reward_coupon_id')::bigint;
 ELSE
  IF NEW.payment_status<>'paid' OR NEW.status NOT IN('confirmed','completed') OR NEW.amount_paid<NEW.total_amount THEN RETURN NEW;END IF;
  code_id:=NEW.discount_code_id;
 END IF;
 SELECT * INTO r FROM public.cfa_reward_claims WHERE coupon_id=code_id;
 IF NOT FOUND THEN RETURN NEW;END IF;
 IF r.user_id<>NEW.user_id OR (TG_TABLE_NAME='bookings' AND r.environment='sandbox') OR (TG_TABLE_NAME='cfa_test_checkouts' AND r.environment<>'sandbox') THEN RAISE EXCEPTION 'reward_coupon_environment';END IF;
 PERFORM 1 FROM public.discount_codes WHERE id=code_id FOR UPDATE;
 SELECT * INTO prior FROM public.cfa_reward_coupon_uses WHERE coupon_id=code_id;
 IF FOUND THEN
  IF TG_TABLE_NAME='cfa_test_checkouts' THEN
   IF prior.test_checkout_id IS DISTINCT FROM NEW.id THEN RAISE EXCEPTION 'reward_coupon_used';END IF;
  ELSE IF prior.booking_id<>NEW.id THEN RAISE EXCEPTION 'reward_coupon_used';END IF;END IF;
 ELSE
  IF TG_TABLE_NAME='cfa_test_checkouts' THEN
   INSERT INTO public.cfa_reward_coupon_uses(coupon_id,booking_id,test_checkout_id) VALUES(code_id,NEW.booking_id,NEW.id);
  ELSE INSERT INTO public.cfa_reward_coupon_uses(coupon_id,booking_id) VALUES(code_id,NEW.id);END IF;
  INSERT INTO public.cfa_reward_audit(claim_id,action) VALUES(r.id,'coupon_used');
 END IF;
 RETURN NEW;
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_033 DROP TRIGGER IF EXISTS cfa_reward_coupon_test ON public.cfa_test_checkouts'; END $cfa_stage$;

DROP TRIGGER IF EXISTS cfa_reward_coupon_test ON public.cfa_test_checkouts;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_034 CREATE TRIGGER cfa_reward_coupon_test BEFORE UPDATE OF status ON public.cfa_test_chec'; END $cfa_stage$;

CREATE TRIGGER cfa_reward_coupon_test BEFORE UPDATE OF status ON public.cfa_test_checkouts FOR EACH ROW EXECUTE FUNCTION public.cfa_reward_coupon_payment();
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_035 DROP TRIGGER IF EXISTS cfa_reward_coupon_live ON public.bookings'; END $cfa_stage$;

DROP TRIGGER IF EXISTS cfa_reward_coupon_live ON public.bookings;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_036 CREATE TRIGGER cfa_reward_coupon_live BEFORE INSERT OR UPDATE OF payment_status statu'; END $cfa_stage$;

CREATE TRIGGER cfa_reward_coupon_live BEFORE INSERT OR UPDATE OF payment_status,status ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.cfa_reward_coupon_payment();
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_037 CREATE OR REPLACE FUNCTION public.cfa_reward_claim_mail p_id uuid p_secret uuid RETUR'; END $cfa_stage$;

CREATE OR REPLACE FUNCTION public.cfa_reward_claim_mail(p_id uuid,p_secret uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE r public.cfa_reward_mail_jobs;BEGIN
 UPDATE public.cfa_reward_mail_jobs SET state='sending',attempts=attempts+1,lock_token=gen_random_uuid(),locked_until=now()+interval '2 minutes'
 WHERE id=p_id AND secret=p_secret AND state<>'sent' AND attempts<20 AND (locked_until IS NULL OR locked_until<now()) RETURNING * INTO r;
 IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('id',r.id,'lock_token',r.lock_token,'recipient',r.recipient,'subject',r.subject,'body',r.body);
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_038 CREATE OR REPLACE FUNCTION public.cfa_reward_finish_mail p_id uuid p_lock_token uuid '; END $cfa_stage$;

CREATE OR REPLACE FUNCTION public.cfa_reward_finish_mail(p_id uuid,p_lock_token uuid,p_success boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 UPDATE public.cfa_reward_mail_jobs SET state=CASE WHEN p_success THEN 'sent' ELSE 'pending' END,
 sent_at=CASE WHEN p_success THEN now() END,locked_until=CASE WHEN p_success THEN NULL ELSE now()+interval '1 minute' END
 WHERE id=p_id AND lock_token=p_lock_token AND state='sending';RETURN FOUND;
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_039 CREATE OR REPLACE FUNCTION public.cfa_reward_retry_mail RETURNS void'; END $cfa_stage$;

CREATE OR REPLACE FUNCTION public.cfa_reward_retry_mail() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT public.cfa_is_owner() THEN RAISE EXCEPTION 'owner_required';END IF;
 UPDATE public.cfa_reward_mail_jobs SET attempts=0,locked_until=NULL,last_dispatch=NULL,state='pending'
 WHERE state<>'sent' AND (locked_until IS NULL OR locked_until<now());
 PERFORM public.cfa_reward_dispatch_pending();
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_040 INSERT INTO public.cfa_reward_claims user_id environment milestone required_points st'; END $cfa_stage$;

-- Keep the earlier archive, including completed rewards, without issuing them twice.
INSERT INTO public.cfa_reward_claims(user_id,environment,milestone,required_points,state,items,assigned_by,assigned_at,closed_by,closed_at,created_at,method)
 SELECT user_id,'live',milestone,required_points,CASE WHEN redeemed_at IS NULL THEN 'assigned' ELSE 'delivered' END,
 jsonb_build_array(jsonb_build_object('sk',description_sk,'en',description_en)),created_by,created_at,redeemed_by,redeemed_at,created_at,'personal'
 FROM public.cfa_loyalty_rewards ON CONFLICT(user_id,environment,milestone) DO NOTHING;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_041 DO DECLARE r record BEGIN'; END $cfa_stage$;

-- Every entry point into the new ledger is explicit; no direct table access for clients.
DO $$ DECLARE r record;BEGIN
 FOR r IN SELECT oid::regprocedure signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'cfa_reward_%' LOOP
 RAISE NOTICE 'CFA_STAGE:S57_900 REVOKE %',r.signature;
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',r.signature);
 END LOOP;
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_042 GRANT EXECUTE ON FUNCTION public.cfa_reward_retry_mail public.cfa_reward_list text bo'; END $cfa_stage$;

GRANT EXECUTE ON FUNCTION public.cfa_reward_retry_mail(),public.cfa_reward_list(text,boolean),public.cfa_reward_update(uuid,text,jsonb,text,numeric,integer,integer) TO authenticated;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_043 GRANT EXECUTE ON FUNCTION public.cfa_reward_claim_mail uuid uuid public.cfa_reward_fi'; END $cfa_stage$;

GRANT EXECUTE ON FUNCTION public.cfa_reward_claim_mail(uuid,uuid),public.cfa_reward_finish_mail(uuid,uuid,boolean) TO service_role;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_044 CREATE OR REPLACE FUNCTION public.cfa_loyalty_assign_reward p_user uuid p_milestone i'; END $cfa_stage$;

-- Preserve pre-existing grants on the legacy sync hook as well. It only
-- synchronises authoritative earned points, returns no private data and cannot
-- assign or close a reward. New mutation APIs remain owner-only.
-- Retire legacy controls so an old cached screen cannot bypass the new audit/DM flow.
CREATE OR REPLACE FUNCTION public.cfa_loyalty_assign_reward(p_user uuid,p_milestone integer,p_sk text,p_en text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'Use the Rewards page / Použite stránku Odmeny';END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_045 CREATE OR REPLACE FUNCTION public.cfa_loyalty_redeem_reward p_user uuid p_milestone i'; END $cfa_stage$;

CREATE OR REPLACE FUNCTION public.cfa_loyalty_redeem_reward(p_user uuid,p_milestone integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'Use the Rewards page / Použite stránku Odmeny';END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_046 CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog'; END $cfa_stage$;

-- CRON_START
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_047 CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions'; END $cfa_stage$;

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_048 SELECT cron.schedule cfa reward mail retry SELECT public.cfa_reward_dispatch_pending'; END $cfa_stage$;

SELECT cron.schedule('cfa-reward-mail-retry','* * * * *','SELECT public.cfa_reward_dispatch_pending()');
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_049 UPDATE public.cfa_test_settings SET schema_version 3 WHERE id true'; END $cfa_stage$;

-- CRON_END
UPDATE public.cfa_test_settings SET schema_version=3 WHERE id=true;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_050 NOTIFY pgrst reload schema'; END $cfa_stage$;

NOTIFY pgrst,'reload schema';
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_051 COMMIT'; END $cfa_stage$;

COMMIT;`;
export const INSTALL_SQL=String.raw`DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_001 BEGIN'; END $cfa_stage$;
BEGIN;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_002 SELECT pg_advisory_xact_lock hashtextextended cfa test install 0'; END $cfa_stage$;

SELECT pg_advisory_xact_lock(hashtextextended('cfa-test-install',0));
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_003 REVOKE INSERT UPDATE DELETE ON public.bookings public.booking_items'; END $cfa_stage$;

REVOKE INSERT,UPDATE,DELETE ON public.bookings,public.booking_items,
 public.booking_payments,public.booking_tickets,public.tickets FROM PUBLIC,anon,authenticated;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_004 DO DECLARE r record BEGIN'; END $cfa_stage$;

DO $$ DECLARE r record;BEGIN
 FOR r IN SELECT table_name,column_name FROM information_schema.columns
 WHERE table_schema='public' AND table_name IN('bookings','booking_items','booking_payments','booking_tickets','tickets') LOOP
 EXECUTE format('REVOKE INSERT(%I),UPDATE(%I),REFERENCES(%I) ON public.%I FROM PUBLIC,anon,authenticated',
 r.column_name,r.column_name,r.column_name,r.table_name);
 END LOOP;
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_005 CREATE TABLE IF NOT EXISTS public.cfa_test_settings'; END $cfa_stage$;

CREATE TABLE IF NOT EXISTS public.cfa_test_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK(id),setup_id uuid NOT NULL DEFAULT gen_random_uuid(),
 webhook_id text,webhook_key text,notification_url text,configured_at timestamptz,
 schema_version integer NOT NULL DEFAULT 1
);
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_006 ALTER TABLE public.cfa_test_settings ADD COLUMN IF NOT EXISTS schema_version integer '; END $cfa_stage$;

ALTER TABLE public.cfa_test_settings ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_007 ALTER TABLE public.cfa_test_settings ENABLE ROW LEVEL SECURITY'; END $cfa_stage$;

ALTER TABLE public.cfa_test_settings ENABLE ROW LEVEL SECURITY;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_008 REVOKE ALL ON public.cfa_test_settings FROM PUBLIC anon authenticated'; END $cfa_stage$;

REVOKE ALL ON public.cfa_test_settings FROM PUBLIC,anon,authenticated;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_009 GRANT SELECT INSERT UPDATE ON public.cfa_test_settings TO service_role'; END $cfa_stage$;

GRANT SELECT,INSERT,UPDATE ON public.cfa_test_settings TO service_role;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_010 INSERT INTO public.cfa_test_settings id VALUES true ON CONFLICT DO NOTHING'; END $cfa_stage$;

INSERT INTO public.cfa_test_settings(id) VALUES(true) ON CONFLICT DO NOTHING;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_011 CREATE OR REPLACE FUNCTION public.cfa_test_is_member RETURNS boolean'; END $cfa_stage$;


CREATE OR REPLACE FUNCTION public.cfa_test_is_member() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.cfa_test_access a JOIN auth.users u ON u.id=a.user_id
 WHERE a.user_id=auth.uid() AND u.email_confirmed_at IS NOT NULL);
$$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_012 REVOKE ALL ON FUNCTION public.cfa_test_is_member FROM PUBLIC anon'; END $cfa_stage$;

REVOKE ALL ON FUNCTION public.cfa_test_is_member() FROM PUBLIC,anon;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_013 GRANT EXECUTE ON FUNCTION public.cfa_test_is_member TO authenticated'; END $cfa_stage$;

GRANT EXECUTE ON FUNCTION public.cfa_test_is_member() TO authenticated;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_014 DROP POLICY IF EXISTS cfa_test_hidden_events ON public.events'; END $cfa_stage$;

DROP POLICY IF EXISTS cfa_test_hidden_events ON public.events;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_015 CREATE POLICY cfa_test_hidden_events ON public.events FOR SELECT TO authenticated'; END $cfa_stage$;

CREATE POLICY cfa_test_hidden_events ON public.events FOR SELECT TO authenticated
 USING(status='hidden' AND public.cfa_test_is_member());
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_016 DROP POLICY IF EXISTS cfa_test_hidden_options ON public.event_options'; END $cfa_stage$;

DROP POLICY IF EXISTS cfa_test_hidden_options ON public.event_options;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_017 CREATE POLICY cfa_test_hidden_options ON public.event_options FOR SELECT TO authentic'; END $cfa_stage$;

CREATE POLICY cfa_test_hidden_options ON public.event_options FOR SELECT TO authenticated
 USING(enabled AND public.cfa_test_is_member() AND EXISTS(
 SELECT 1 FROM public.events e WHERE e.id=event_id AND e.status='hidden'));
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_018 DROP POLICY IF EXISTS cfa_test_hidden_photos ON storage.objects'; END $cfa_stage$;

DROP POLICY IF EXISTS cfa_test_hidden_photos ON storage.objects;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_019 CREATE POLICY cfa_test_hidden_photos ON storage.objects FOR SELECT TO authenticated'; END $cfa_stage$;

CREATE POLICY cfa_test_hidden_photos ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='event-photos' AND public.cfa_test_is_member() AND EXISTS(
 SELECT 1 FROM public.events e WHERE e.status='hidden' AND (
 (e.display_settings->'photos') ? name OR e.display_settings->>'ticket_logo_path'=name
 OR EXISTS(SELECT 1 FROM public.event_options o WHERE o.event_id=e.id
 AND o.enabled AND (o.booking_form_settings->'photos') ? name))));
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_020 DO DECLARE r record src text n integer 0 BEGIN'; END $cfa_stage$;


DO $$ DECLARE r record;src text;n integer:=0;BEGIN
 FOR r IN SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace
 AND proname IN('get_or_create_cart','add_item_to_cart','add_accommodation_to_cart',
 'add_camping_package_to_cart','cfa_prepare_test_checkout') LOOP
 src:=pg_get_functiondef(r.oid);
 IF position('public.cfa_test_is_member()' IN src)=0 THEN
 IF (length(src)-length(replace(src,'public.cfa_can_manage_events()','')))
 /length('public.cfa_can_manage_events()')<>1 THEN RAISE EXCEPTION 'event_guard_changed';END IF;
 src:=replace(src,'public.cfa_can_manage_events()',
 '(public.cfa_can_manage_events() OR public.cfa_test_is_member())');
 END IF;
 IF r.oid='public.cfa_prepare_test_checkout(bigint,text)'::regprocedure THEN
 src:=replace(src,'md5(v_snapshot::text)','md5((v_snapshot - ''language'')::text)');
 END IF;
 EXECUTE src;n:=n+1;
 END LOOP;
 IF n<>6 THEN RAISE EXCEPTION 'reservation_functions_missing';END IF;
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_021 CREATE OR REPLACE FUNCTION public.cfa_test_ticket_points p_user uuid'; END $cfa_stage$;


CREATE OR REPLACE FUNCTION public.cfa_test_ticket_points(p_user uuid)
RETURNS TABLE(event_id text,title_sk text,title_en text,start_date date,points bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT s.snapshot->'event'->>'id',s.snapshot->'event'->>'title',
 COALESCE(NULLIF(s.snapshot->'event'->'display_settings'->>'title_en',''),s.snapshot->'event'->>'title'),
 (s.snapshot->'event'->>'start_date')::date,
 sum(GREATEST(0,(i->>'quantity')::integer-CASE
 WHEN jsonb_array_length(COALESCE(i->'child_ages','[]'::jsonb))=(i->>'quantity')::integer
 THEN (SELECT count(*) FROM jsonb_array_elements_text(i->'child_ages') a WHERE a::integer<5)
 ELSE 0 END))::bigint
 FROM public.cfa_test_checkouts s CROSS JOIN LATERAL jsonb_array_elements(s.snapshot->'items') i
 WHERE s.user_id=p_user AND s.status='paid' AND s.refunded_pence=0 AND s.expected_pence>0
 AND i->>'category'='ticket' AND (i->>'unit_price')::numeric>0 AND (i->>'line_total')::numeric>0
 GROUP BY 1,2,3,4 ORDER BY 4,1;
$$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_022 REVOKE ALL ON FUNCTION public.cfa_test_ticket_points uuid FROM PUBLIC anon authentica'; END $cfa_stage$;

REVOKE ALL ON FUNCTION public.cfa_test_ticket_points(uuid) FROM PUBLIC,anon,authenticated;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_023 GRANT EXECUTE ON FUNCTION public.cfa_test_ticket_points uuid TO service_role'; END $cfa_stage$;

GRANT EXECUTE ON FUNCTION public.cfa_test_ticket_points(uuid) TO service_role;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_024 CREATE OR REPLACE FUNCTION public.cfa_test_loyalty_summary RETURNS jsonb'; END $cfa_stage$;

CREATE OR REPLACE FUNCTION public.cfa_test_loyalty_summary() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_points bigint;v_events jsonb;BEGIN
 IF NOT public.cfa_test_is_member() THEN RAISE EXCEPTION 'test_access_required';END IF;
 SELECT COALESCE(sum(points),0),COALESCE(jsonb_agg(to_jsonb(e)),'[]'::jsonb)
 INTO v_points,v_events FROM public.cfa_test_ticket_points(auth.uid()) e;
 RETURN jsonb_build_object('points',v_points,'threshold',6,'events',v_events,'rewards','[]'::jsonb,
 'can_manage',false,'can_receive_alerts',false,'environment','sandbox');
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_025 REVOKE ALL ON FUNCTION public.cfa_test_loyalty_summary FROM PUBLIC anon'; END $cfa_stage$;

REVOKE ALL ON FUNCTION public.cfa_test_loyalty_summary() FROM PUBLIC,anon;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_026 GRANT EXECUTE ON FUNCTION public.cfa_test_loyalty_summary TO authenticated'; END $cfa_stage$;

GRANT EXECUTE ON FUNCTION public.cfa_test_loyalty_summary() TO authenticated;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_027 CREATE OR REPLACE FUNCTION public.cfa_test_guard_cart_item RETURNS trigger'; END $cfa_stage$;


CREATE OR REPLACE FUNCTION public.cfa_test_guard_cart_item() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bookings%ROWTYPE;v_id bigint;BEGIN
 IF auth.uid() IS NULL OR NOT public.cfa_test_is_member() THEN
 IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;END IF;
 v_id:=CASE WHEN TG_OP='DELETE' THEN OLD.booking_id ELSE NEW.booking_id END;
 SELECT * INTO b FROM public.bookings WHERE id=v_id FOR UPDATE;
 IF NOT FOUND AND TG_OP='DELETE' THEN RETURN OLD;END IF;
 IF NOT FOUND OR b.user_id IS DISTINCT FROM auth.uid() OR b.status<>'cart'
 OR b.cart_expired OR b.cancelled_at IS NOT NULL OR b.payment_status<>'unpaid'
 OR (b.cart_expires_at IS NOT NULL AND b.cart_expires_at<=now()) THEN
 RAISE EXCEPTION 'cart_unavailable';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_028 REVOKE ALL ON FUNCTION public.cfa_test_guard_cart_item FROM PUBLIC anon authenticated'; END $cfa_stage$;

REVOKE ALL ON FUNCTION public.cfa_test_guard_cart_item() FROM PUBLIC,anon,authenticated;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_029 DROP TRIGGER IF EXISTS cfa_test_guard_cart_item ON public.booking_items'; END $cfa_stage$;

DROP TRIGGER IF EXISTS cfa_test_guard_cart_item ON public.booking_items;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_030 CREATE TRIGGER cfa_test_guard_cart_item BEFORE INSERT OR UPDATE OR DELETE ON public.b'; END $cfa_stage$;

CREATE TRIGGER cfa_test_guard_cart_item BEFORE INSERT OR UPDATE OR DELETE ON public.booking_items
 FOR EACH ROW EXECUTE FUNCTION public.cfa_test_guard_cart_item();
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_031 CREATE OR REPLACE FUNCTION public.cfa_test_release_cart RETURNS trigger'; END $cfa_stage$;


CREATE OR REPLACE FUNCTION public.cfa_test_release_cart() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bookings%ROWTYPE;v_items jsonb;v_saved jsonb;BEGIN
 IF NEW.status NOT IN('paid','partially_refunded','refunded') THEN RETURN NEW;END IF;
 SELECT * INTO b FROM public.bookings WHERE id=NEW.booking_id AND user_id=NEW.user_id FOR UPDATE;
 IF NOT FOUND OR b.status<>'cart' OR b.payment_status<>'unpaid' OR b.amount_paid<>0
 OR b.total_amount*100<>NEW.expected_pence THEN RETURN NEW;END IF;
 SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) INTO v_items FROM public.booking_items i WHERE i.booking_id=b.id;
 SELECT jsonb_agg(j-'name_sk'-'name_en'-'option_code'-'is_accommodation'-'admission_type' ORDER BY (j->>'id')::bigint)
 INTO v_saved FROM jsonb_array_elements(NEW.snapshot->'items') j;
 IF v_items=v_saved THEN
 UPDATE public.bookings SET status='expired',cart_expired=true,hidden_by_user=true,
 hidden_by_user_at=now(),updated_at=now()
 WHERE id=b.id;
 END IF;RETURN NEW;
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_032 REVOKE ALL ON FUNCTION public.cfa_test_release_cart FROM PUBLIC anon authenticated'; END $cfa_stage$;

REVOKE ALL ON FUNCTION public.cfa_test_release_cart() FROM PUBLIC,anon,authenticated;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_033 DROP TRIGGER IF EXISTS cfa_test_release_cart ON public.cfa_test_checkouts'; END $cfa_stage$;

DROP TRIGGER IF EXISTS cfa_test_release_cart ON public.cfa_test_checkouts;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_034 CREATE TRIGGER cfa_test_release_cart AFTER UPDATE OF status ON public.cfa_test_checko'; END $cfa_stage$;

CREATE TRIGGER cfa_test_release_cart AFTER UPDATE OF status ON public.cfa_test_checkouts
 FOR EACH ROW EXECUTE FUNCTION public.cfa_test_release_cart();
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_035 NOTIFY pgrst reload schema'; END $cfa_stage$;

NOTIFY pgrst, 'reload schema';
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_036 COMMIT'; END $cfa_stage$;

COMMIT;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S56_037 SELECT public.cfa_test_is_member IS NOT NULL'; END $cfa_stage$;

SELECT public.cfa_test_is_member() IS NOT NULL
 AND NOT has_table_privilege('anon','public.cfa_test_settings','SELECT')
 AS kompletna_skuska_pripravena;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_001 BEGIN'; END $cfa_stage$;
BEGIN;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_002 SELECT pg_advisory_xact_lock hashtextextended cfa rewards install 0'; END $cfa_stage$;

SELECT pg_advisory_xact_lock(hashtextextended('cfa-rewards-install',0));
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_003 CREATE TABLE IF NOT EXISTS public.cfa_reward_claims'; END $cfa_stage$;

CREATE TABLE IF NOT EXISTS public.cfa_reward_claims (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 environment text NOT NULL CHECK(environment IN('live','sandbox')),milestone integer NOT NULL CHECK(milestone>0),required_points integer NOT NULL,
 state text NOT NULL DEFAULT 'earned' CHECK(state IN('earned','assigned','delivered','message_provided')),
 items jsonb NOT NULL DEFAULT '[]',method text CHECK(method IN('personal','message','coupon')),
 qualifying_amount numeric NOT NULL DEFAULT 0,source_bookings jsonb NOT NULL DEFAULT '[]',
 created_at timestamptz NOT NULL DEFAULT now(),assigned_at timestamptz,closed_at timestamptz,
 assigned_by uuid,closed_by uuid,owner_hidden boolean NOT NULL DEFAULT false,revision integer NOT NULL DEFAULT 0,
 coupon_id bigint REFERENCES public.discount_codes(id),UNIQUE(user_id,environment,milestone)
);
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_004 ALTER TABLE public.cfa_reward_claims ADD COLUMN IF NOT EXISTS conversation_id bigint'; END $cfa_stage$;

ALTER TABLE public.cfa_reward_claims ADD COLUMN IF NOT EXISTS conversation_id bigint;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_005 ALTER TABLE public.cfa_reward_claims ADD COLUMN IF NOT EXISTS last_message_id bigint'; END $cfa_stage$;

ALTER TABLE public.cfa_reward_claims ADD COLUMN IF NOT EXISTS last_message_id bigint;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_006 CREATE TABLE IF NOT EXISTS public.cfa_reward_audit'; END $cfa_stage$;

CREATE TABLE IF NOT EXISTS public.cfa_reward_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,claim_id uuid NOT NULL REFERENCES public.cfa_reward_claims(id) ON DELETE CASCADE,
 actor uuid,action text NOT NULL,details jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now()
);
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_007 CREATE TABLE IF NOT EXISTS public.cfa_reward_mail_jobs'; END $cfa_stage$;

CREATE TABLE IF NOT EXISTS public.cfa_reward_mail_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),secret uuid NOT NULL DEFAULT gen_random_uuid(),dedup text NOT NULL UNIQUE,
 recipient text NOT NULL,subject text NOT NULL,body text NOT NULL,claim_id uuid NOT NULL REFERENCES public.cfa_reward_claims(id) ON DELETE CASCADE,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN('pending','sending','sent')),attempts integer NOT NULL DEFAULT 0,
 locked_until timestamptz,lock_token uuid,last_dispatch timestamptz,sent_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_008 CREATE TABLE IF NOT EXISTS public.cfa_reward_coupon_uses'; END $cfa_stage$;

CREATE TABLE IF NOT EXISTS public.cfa_reward_coupon_uses (
 coupon_id bigint PRIMARY KEY REFERENCES public.discount_codes(id),booking_id bigint NOT NULL,
 test_checkout_id uuid,used_at timestamptz NOT NULL DEFAULT now()
);
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_009 CREATE TABLE IF NOT EXISTS public.cfa_reward_coupon_holds'; END $cfa_stage$;

CREATE TABLE IF NOT EXISTS public.cfa_reward_coupon_holds (
 coupon_id bigint PRIMARY KEY REFERENCES public.discount_codes(id),booking_id bigint NOT NULL,expires_at timestamptz NOT NULL
);
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_010 DO DECLARE t text BEGIN'; END $cfa_stage$;

DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['cfa_reward_claims','cfa_reward_audit','cfa_reward_mail_jobs','cfa_reward_coupon_uses','cfa_reward_coupon_holds'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
 END LOOP;
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_011 CREATE OR REPLACE FUNCTION public.cfa_reward_sources p_user uuid p_environment text'; END $cfa_stage$;

CREATE OR REPLACE FUNCTION public.cfa_reward_sources(p_user uuid,p_environment text)
RETURNS TABLE(order_id text,title text,amount numeric,points bigint,paid_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF p_environment='sandbox' THEN
 RETURN QUERY SELECT s.id::text,s.snapshot->'event'->>'title',(s.snapshot->>'total')::numeric,
 sum(GREATEST(0,(i->>'quantity')::integer-CASE WHEN jsonb_array_length(COALESCE(i->'child_ages','[]'))=(i->>'quantity')::integer
 THEN (SELECT count(*) FROM jsonb_array_elements_text(i->'child_ages') a WHERE a::integer<5) ELSE 0 END))::bigint,s.paid_at
 FROM public.cfa_test_checkouts s CROSS JOIN LATERAL jsonb_array_elements(s.snapshot->'items') i
 WHERE s.user_id=p_user AND s.status='paid' AND s.refunded_pence=0 AND s.expected_pence>0
 AND i->>'category'='ticket' AND (i->>'unit_price')::numeric>0 AND (i->>'line_total')::numeric>0
 GROUP BY s.id,s.snapshot,s.paid_at;
 ELSIF p_environment='live' THEN
 RETURN QUERY SELECT b.id::text,e.title,b.total_amount,sum(i.quantity)::bigint,COALESCE(b.updated_at,b.created_at)
 FROM public.bookings b JOIN public.events e ON e.id=b.event_id JOIN public.booking_items i ON i.booking_id=b.id
 WHERE b.user_id=p_user AND b.status IN('confirmed','completed') AND b.payment_status='paid'
 AND b.cancelled_at IS NULL AND NOT COALESCE(b.cart_expired,false) AND b.total_amount>0 AND b.amount_paid>=b.total_amount
 AND i.category='ticket' AND i.unit_price>0 AND i.line_total>0 AND i.quantity>0 GROUP BY b.id,e.title;
 ELSE RAISE EXCEPTION 'invalid_environment';END IF;
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_012 CREATE OR REPLACE FUNCTION public.cfa_reward_points p_user uuid p_environment text RE'; END $cfa_stage$;

CREATE OR REPLACE FUNCTION public.cfa_reward_points(p_user uuid,p_environment text) RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT COALESCE(sum(points),0)::bigint FROM public.cfa_reward_sources(p_user,p_environment) $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_013 CREATE OR REPLACE FUNCTION public.cfa_reward_dispatch_pending RETURNS void'; END $cfa_stage$;

CREATE OR REPLACE FUNCTION public.cfa_reward_dispatch_pending() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE j record;BEGIN
 FOR j IN SELECT id,secret FROM public.cfa_reward_mail_jobs WHERE state<>'sent' AND attempts<20
 AND (locked_until IS NULL OR locked_until<now()) AND (last_dispatch IS NULL OR last_dispatch<now()-interval '2 minutes')
 ORDER BY created_at LIMIT 20 FOR UPDATE SKIP LOCKED LOOP
  BEGIN
   PERFORM net.http_post(url:='https://btkblcngijheanyhyiow.supabase.co/functions/v1/cfa-booking-sandbox?reward-mail=1',
    headers:='{"Content-Type":"application/json"}'::jsonb,body:=jsonb_build_object('id',j.id,'token',j.secret),timeout_milliseconds:=10000);
   UPDATE public.cfa_reward_mail_jobs SET last_dispatch=now() WHERE id=j.id;
  EXCEPTION WHEN OTHERS THEN NULL;END;
 END LOOP;
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_014 CREATE OR REPLACE FUNCTION public.cfa_reward_queue_mail p_claim uuid p_kind text RETU'; END $cfa_stage$;

CREATE OR REPLACE FUNCTION public.cfa_reward_queue_mail(p_claim uuid,p_kind text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.cfa_reward_claims;u record;o record;body text;labels text;prefix text;BEGIN
 SELECT * INTO r FROM public.cfa_reward_claims WHERE id=p_claim;
 SELECT a.email,COALESCE(NULLIF(p.display_name,''),a.email) name INTO u FROM auth.users a LEFT JOIN public.user_profiles p ON p.user_id=a.id WHERE a.id=r.user_id;
 prefix:=CASE WHEN r.environment='sandbox' THEN '[TEST / SKÚŠKA] ' ELSE '' END;
 SELECT COALESCE(string_agg((x->>'en')||' / '||(x->>'sk'),E'\n'),'') INTO labels FROM jsonb_array_elements(r.items) x;
 body:=prefix||'Reward / Odmena: '||r.id||E'\nUser / Používateľ: '||u.name||E'\nEmail / E-mail: '||u.email||
 E'\nPoints required / Potrebné body: '||r.required_points||E'\nQualifying bookings total / Suma započítaných rezervácií: GBP '||r.qualifying_amount||
 E'\nStatus / Stav: '||CASE r.state WHEN 'earned' THEN 'Earned / Nárok získaný' WHEN 'assigned' THEN 'Awaiting personal collection / Čaká na osobné prevzatie' WHEN 'delivered' THEN 'Handed over in person / Odovzdané osobne' ELSE 'Provided by private message / Poskytnuté správou' END||E'\n'||labels||
 E'\nhttps://tatrycupcio.uk/?cfa-reward='||r.id||'&reward-mode='||r.environment;
 FOR o IN SELECT a.email FROM public.admin_users ad JOIN auth.users a ON a.id=ad.user_id WHERE ad.role='owner' AND a.email_confirmed_at IS NOT NULL LOOP
 INSERT INTO public.cfa_reward_mail_jobs(dedup,recipient,subject,body,claim_id) VALUES(r.id||':'||p_kind||':'||o.email,o.email,prefix||'Reward / Odmena - '||u.name,body,r.id) ON CONFLICT(dedup) DO NOTHING;
 END LOOP;
 IF p_kind='closed' AND u.email IS NOT NULL THEN
 INSERT INTO public.cfa_reward_mail_jobs(dedup,recipient,subject,body,claim_id) VALUES(r.id||':'||p_kind||':'||u.email,u.email,prefix||'Reward completed / Odmena vybavená',body,r.id) ON CONFLICT(dedup) DO NOTHING;
 END IF;
 PERFORM public.cfa_reward_dispatch_pending();
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_015 CREATE OR REPLACE FUNCTION public.cfa_reward_sync p_user uuid p_environment text RETU'; END $cfa_stage$;

CREATE OR REPLACE FUNCTION public.cfa_reward_sync(p_user uuid,p_environment text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE total bigint; m integer; r uuid; src jsonb; cash numeric;BEGIN
 IF p_user IS NULL THEN RETURN;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('cfa-reward:'||p_user||':'||p_environment,0));
 total:=public.cfa_reward_points(p_user,p_environment);
 FOR m IN SELECT generate_series(1,LEAST(total/6,1000000)::integer) LOOP
  WITH ordered AS(SELECT *,sum(points) OVER(ORDER BY paid_at,order_id) hi FROM public.cfa_reward_sources(p_user,p_environment)),matched AS(
   SELECT order_id,title,amount,points,paid_at FROM ordered WHERE hi>(m-1)*6 AND hi-points<m*6)
  SELECT COALESCE(jsonb_agg(to_jsonb(matched)),'[]'),COALESCE(sum(amount),0) INTO src,cash FROM matched;
  INSERT INTO public.cfa_reward_claims(user_id,environment,milestone,required_points,qualifying_amount,source_bookings)
   VALUES(p_user,p_environment,m,m*6,cash,src) ON CONFLICT(user_id,environment,milestone) DO NOTHING RETURNING id INTO r;
  IF r IS NOT NULL THEN
   INSERT INTO public.cfa_reward_audit(claim_id,action) VALUES(r,'earned');PERFORM public.cfa_reward_queue_mail(r,'earned');
  END IF;
 END LOOP;
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_016 CREATE OR REPLACE FUNCTION public.cfa_reward_test_changed RETURNS trigger'; END $cfa_stage$;

CREATE OR REPLACE FUNCTION public.cfa_reward_test_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 BEGIN PERFORM public.cfa_reward_sync(NEW.user_id,'sandbox');
 EXCEPTION WHEN OTHERS THEN RAISE LOG 'CFA reward sync deferred; payment retained';END;RETURN NEW;
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_017 DROP TRIGGER IF EXISTS cfa_reward_test_changed ON public.cfa_test_checkouts'; END $cfa_stage$;

DROP TRIGGER IF EXISTS cfa_reward_test_changed ON public.cfa_test_checkouts;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_018 CREATE TRIGGER cfa_reward_test_changed AFTER INSERT OR UPDATE OF status refunded_penc'; END $cfa_stage$;

CREATE TRIGGER cfa_reward_test_changed AFTER INSERT OR UPDATE OF status,refunded_pence ON public.cfa_test_checkouts
 FOR EACH ROW EXECUTE FUNCTION public.cfa_reward_test_changed();
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_019 CREATE OR REPLACE FUNCTION public.cfa_loyalty_sync_user p_user uuid RETURNS void'; END $cfa_stage$;

-- Existing live booking/item triggers call this function. Replace only the obsolete bell dispatch.
CREATE OR REPLACE FUNCTION public.cfa_loyalty_sync_user(p_user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN PERFORM public.cfa_reward_sync(p_user,'live');END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_020 CREATE OR REPLACE FUNCTION public.cfa_reward_dm p_recipient uuid p_body text RETURNS '; END $cfa_stage$;

CREATE OR REPLACE FUNCTION public.cfa_reward_dm(p_recipient uuid,p_body text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE convo bigint;mid bigint;BEGIN
 IF NOT public.cfa_is_owner() THEN RAISE EXCEPTION 'owner_required';END IF;
 IF p_recipient=auth.uid() THEN
  SELECT c.id INTO convo FROM public.private_conversations c WHERE c.created_by=auth.uid() AND c.name='My reward receipts / Moje potvrdenia odmien' AND NOT c.is_group ORDER BY c.id LIMIT 1;
  IF convo IS NULL THEN
   INSERT INTO public.private_conversations(created_by,name,is_group) VALUES(auth.uid(),'My reward receipts / Moje potvrdenia odmien',false) RETURNING id INTO convo;
   INSERT INTO public.private_conversation_members(conversation_id,user_id) VALUES(convo,auth.uid());
   INSERT INTO public.private_conversation_memberships(conversation_id,user_id,added_by) VALUES(convo,auth.uid(),auth.uid());
  END IF;
 ELSE
  PERFORM set_config('search_path','pg_catalog,public,pg_temp',true);
  convo:=public.create_private_conversation(p_recipient);
  PERFORM set_config('search_path','',true);
 END IF;
 INSERT INTO public.private_messages(sender_id,receiver_id,conversation_id,message_text) VALUES(auth.uid(),p_recipient,convo,p_body) RETURNING id INTO mid;RETURN mid;
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_021 CREATE OR REPLACE FUNCTION public.cfa_reward_list p_environment text DEFAULT live p_a'; END $cfa_stage$;

CREATE OR REPLACE FUNCTION public.cfa_reward_list(p_environment text DEFAULT 'live',p_admin boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid();a boolean;v jsonb;rec record;BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'sign_in_required';END IF;
 IF p_environment NOT IN('live','sandbox') THEN RAISE EXCEPTION 'invalid_environment';END IF;
 a:=public.cfa_is_owner();IF p_admin AND NOT a THEN RAISE EXCEPTION 'owner_required';END IF;
 IF p_environment='sandbox' AND NOT public.cfa_test_is_member() THEN RAISE EXCEPTION 'test_access_required';END IF;
 IF p_admin THEN
  FOR rec IN SELECT id FROM auth.users WHERE p_environment='live' OR EXISTS(SELECT 1 FROM public.cfa_test_access t WHERE t.user_id=auth.users.id) LOOP
   PERFORM public.cfa_reward_sync(rec.id,p_environment);
  END LOOP;
 ELSE PERFORM public.cfa_reward_sync(u,p_environment);END IF;
 SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at,x.id),'[]') INTO v FROM(
  SELECT r.*,COALESCE(NULLIF(p.display_name,''),au.email) display_name,au.email,
   public.cfa_reward_points(r.user_id,p_environment)>=r.required_points eligible,
   dc.code coupon_code,dc.discount_value coupon_percent,dc.valid_until coupon_expires,
   CASE WHEN r.environment='sandbox' THEN (SELECT t.checkout_url FROM public.cfa_test_checkouts t WHERE t.user_id=r.user_id AND (t.snapshot->>'reward_coupon_id')::bigint=r.coupon_id AND t.status IN('creating','awaiting_payment') ORDER BY t.created_at DESC LIMIT 1) END coupon_checkout_url,
   EXISTS(SELECT 1 FROM public.cfa_reward_coupon_uses cu WHERE cu.coupon_id=r.coupon_id) coupon_used,
   CASE WHEN r.closed_by IS NOT NULL THEN COALESCE((SELECT NULLIF(up.display_name,'') FROM public.user_profiles up WHERE up.user_id=r.closed_by),'Team / Tím') END closed_by_name
  FROM public.cfa_reward_claims r JOIN auth.users au ON au.id=r.user_id LEFT JOIN public.user_profiles p ON p.user_id=r.user_id
  LEFT JOIN public.discount_codes dc ON dc.id=r.coupon_id
  WHERE r.environment=p_environment AND (p_admin OR r.user_id=u) AND (NOT p_admin OR NOT r.owner_hidden)
 )x;
 PERFORM public.cfa_reward_dispatch_pending();
 RETURN jsonb_build_object('claims',v,'can_manage',a,'environment',p_environment,
  'pending_mail',CASE WHEN p_admin THEN (SELECT count(*) FROM public.cfa_reward_mail_jobs WHERE state<>'sent') ELSE 0 END);

END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_022 CREATE OR REPLACE FUNCTION public.cfa_reward_update p_claim uuid p_action text p_item'; END $cfa_stage$;

CREATE OR REPLACE FUNCTION public.cfa_reward_update(p_claim uuid,p_action text,p_items jsonb DEFAULT '[]',p_method text DEFAULT 'personal',p_percent numeric DEFAULT NULL,p_days integer DEFAULT 90,p_revision integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.cfa_reward_claims;code text;cid bigint;labels text;body text;prefix text;v_items jsonb;v_message bigint;v_conversation bigint;BEGIN
 IF auth.uid() IS NULL OR NOT public.cfa_is_owner() THEN RAISE EXCEPTION 'owner_required';END IF;
 SELECT * INTO r FROM public.cfa_reward_claims WHERE id=p_claim FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'reward_not_found';END IF;
 IF r.revision<>p_revision THEN RETURN jsonb_build_object('ok',false,'error','reward_changed');END IF;
 IF p_action='hide' THEN
  IF r.state NOT IN('delivered','message_provided') THEN RAISE EXCEPTION 'reward_not_closed';END IF;
  UPDATE public.cfa_reward_claims SET owner_hidden=true,revision=revision+1 WHERE id=r.id;
  INSERT INTO public.cfa_reward_audit(claim_id,actor,action) VALUES(r.id,auth.uid(),'hidden_from_owner');RETURN jsonb_build_object('ok',true);
 END IF;
 IF r.state IN('delivered','message_provided') THEN RETURN jsonb_build_object('ok',true,'already_closed',true);END IF;
 IF public.cfa_reward_points(r.user_id,r.environment)<r.required_points THEN RAISE EXCEPTION 'reward_not_eligible';END IF;
 prefix:=CASE WHEN r.environment='sandbox' THEN E'TEST / SKÚŠKA\n' ELSE '' END;
 IF p_action='assign' THEN
  IF r.state<>'earned' OR p_method NOT IN('personal','message','coupon') THEN RAISE EXCEPTION 'invalid_reward_action';END IF;
  IF jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)>20 THEN RAISE EXCEPTION 'invalid_reward_items';END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x WHERE jsonb_typeof(x)<>'object' OR length(COALESCE(x->>'sk',''))>500 OR length(COALESCE(x->>'en',''))>500 OR ((COALESCE(btrim(x->>'sk'),'')='')<>(COALESCE(btrim(x->>'en'),'')=''))) THEN RAISE EXCEPTION 'reward_both_languages';END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('sk',btrim(x->>'sk'),'en',btrim(x->>'en'))),'[]') INTO v_items FROM jsonb_array_elements(p_items)x WHERE COALESCE(btrim(x->>'sk'),'')<>'';
  IF p_method='coupon' THEN
   IF p_percent IS NULL OR p_percent<=0 OR p_percent>99 OR p_days NOT BETWEEN 1 AND 730 THEN RAISE EXCEPTION 'invalid_coupon';END IF;
   code:=CASE WHEN r.environment='sandbox' THEN 'TEST-R-' ELSE 'CFA-R-' END||upper(replace(gen_random_uuid()::text,'-',''));
   INSERT INTO public.discount_codes(code,description,active,scope,discount_type,discount_value,max_uses,max_uses_per_user,valid_from,valid_until,created_by)
    VALUES(code,'Reward / Odmena '||r.id,true,'booking','percent',p_percent,1,1,now(),now()+p_days*interval '1 day',auth.uid()) RETURNING id INTO cid;
  END IF;
  UPDATE public.cfa_reward_claims SET items=v_items,method=p_method,coupon_id=cid,assigned_at=now(),assigned_by=auth.uid(),
   state=CASE WHEN p_method='personal' THEN 'assigned' ELSE 'message_provided' END,
   closed_at=CASE WHEN p_method<>'personal' THEN now() END,closed_by=CASE WHEN p_method<>'personal' THEN auth.uid() END,revision=revision+1
   WHERE id=r.id RETURNING * INTO r;
  SELECT COALESCE(string_agg((x->>'en')||' / '||(x->>'sk'),E'\n'),'Reward from our team / Odmena od nášho tímu') INTO labels FROM jsonb_array_elements(r.items)x;
  body:=prefix||'Reward assigned / Odmena pridelená'||E'\n'||labels;
  IF p_method='personal' THEN body:=body||E'\nAt the next event organised by Tatry Cup Community Organisation CIO, please find our team and show this reward entitlement in the app. We will verify it before handing over your reward.\nNa najbližšom podujatí organizovanom Tatry Cup Community Organisation CIO nás osobne vyhľadajte a preukážte sa týmto nárokom v aplikácii. Pred vydaním overíme jeho platnosť.';
  ELSIF p_method='coupon' THEN body:=body||E'\nProvided by private message / Poskytnuté správou\nCoupon / Kupón: '||code||E'\nDiscount / Zľava: '||p_percent||E'%\nOne use, only for your account. Valid until / Jednorazový, iba pre váš účet. Platnosť do: '||to_char(now()+p_days*interval '1 day','DD/MM/YYYY');
  ELSE body:=body||E'\nProvided by private message / Poskytnuté správou';END IF;
 ELSIF p_action='deliver' THEN
  IF r.state<>'assigned' OR r.method<>'personal' THEN RAISE EXCEPTION 'reward_not_assigned';END IF;
  UPDATE public.cfa_reward_claims SET state='delivered',closed_at=now(),closed_by=auth.uid(),revision=revision+1 WHERE id=r.id RETURNING * INTO r;
  SELECT COALESCE(string_agg((x->>'en')||' / '||(x->>'sk'),E'\n'),'Reward from our team / Odmena od nášho tímu') INTO labels FROM jsonb_array_elements(r.items)x;
  body:=prefix||E'Handed over in person / Odovzdané osobne\n'||labels;
 ELSE RAISE EXCEPTION 'invalid_reward_action';END IF;
 body:=body||E'\nReward ID / Číslo nároku: '||r.id||E'\nRecorded / Zaznamenané: '||to_char(now() AT TIME ZONE 'Europe/London','DD/MM/YYYY HH24:MI')||' UK';
 v_message:=public.cfa_reward_dm(r.user_id,body);
 SELECT m.conversation_id INTO v_conversation FROM public.private_messages m WHERE m.id=v_message;
 UPDATE public.cfa_reward_claims SET conversation_id=v_conversation,last_message_id=v_message WHERE id=r.id;
 INSERT INTO public.cfa_reward_audit(claim_id,actor,action,details) VALUES(r.id,auth.uid(),p_action,jsonb_build_object('items',r.items,'method',r.method,'state',r.state));
 IF r.state IN('delivered','message_provided') THEN PERFORM public.cfa_reward_queue_mail(r.id,'closed');END IF;
 RETURN jsonb_build_object('ok',true);
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_023 DO BEGIN'; END $cfa_stage$;

-- One-time coupons remain bound to one account and one active checkout.
DO $$ BEGIN
 IF to_regprocedure('public.cfa_apply_discount_before_rewards(bigint,text)') IS NULL THEN
  ALTER FUNCTION public.apply_discount_code(bigint,text) RENAME TO cfa_apply_discount_before_rewards;
 END IF;
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_024 REVOKE ALL ON FUNCTION public.cfa_apply_discount_before_rewards bigint text FROM PUBL'; END $cfa_stage$;

REVOKE ALL ON FUNCTION public.cfa_apply_discount_before_rewards(bigint,text) FROM PUBLIC,anon,authenticated;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_025 CREATE OR REPLACE FUNCTION public.apply_discount_code p_booking_id bigint p_code text'; END $cfa_stage$;

CREATE OR REPLACE FUNCTION public.apply_discount_code(p_booking_id bigint,p_code text)
RETURNS TABLE(subtotal numeric,discount numeric,total numeric,message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.cfa_reward_claims;dc public.discount_codes;hold public.cfa_reward_coupon_holds;b public.bookings;BEGIN
 SELECT * INTO dc FROM public.discount_codes WHERE upper(code)=upper(trim(p_code)) LIMIT 1 FOR UPDATE;
 SELECT * INTO r FROM public.cfa_reward_claims WHERE coupon_id=dc.id;
 IF FOUND THEN
  IF auth.uid() IS NULL OR r.user_id<>auth.uid() OR r.state<>'message_provided'
    OR public.cfa_reward_points(r.user_id,r.environment)<r.required_points THEN RAISE EXCEPTION 'reward_coupon_not_for_account';END IF;
  IF EXISTS(SELECT 1 FROM public.cfa_reward_coupon_uses WHERE coupon_id=dc.id) THEN RAISE EXCEPTION 'reward_coupon_used';END IF;
  IF r.environment='sandbox' AND NOT public.cfa_test_is_member() THEN RAISE EXCEPTION 'test_access_required';END IF;
  SELECT * INTO b FROM public.bookings WHERE id=p_booking_id AND user_id=auth.uid() AND status='cart' AND NOT cart_expired;
  IF NOT FOUND THEN RAISE EXCEPTION 'cart_unavailable';END IF;
  SELECT * INTO hold FROM public.cfa_reward_coupon_holds WHERE coupon_id=dc.id FOR UPDATE;
  IF FOUND AND hold.booking_id<>b.id AND (hold.expires_at>now() OR EXISTS(SELECT 1 FROM public.cfa_test_checkouts t
     WHERE t.booking_id=hold.booking_id AND (t.snapshot->>'reward_coupon_id')::bigint=dc.id AND t.status IN('creating','awaiting_payment'))) THEN RAISE EXCEPTION 'reward_coupon_in_another_cart';END IF;
  INSERT INTO public.cfa_reward_coupon_holds(coupon_id,booking_id,expires_at) VALUES(dc.id,b.id,COALESCE(b.cart_expires_at,now()+interval '20 minutes'))
   ON CONFLICT(coupon_id) DO UPDATE SET booking_id=EXCLUDED.booking_id,expires_at=EXCLUDED.expires_at;
 END IF;
 RETURN QUERY SELECT * FROM public.cfa_apply_discount_before_rewards(p_booking_id,p_code);
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_026 REVOKE ALL ON FUNCTION public.apply_discount_code bigint text FROM PUBLIC anon'; END $cfa_stage$;

REVOKE ALL ON FUNCTION public.apply_discount_code(bigint,text) FROM PUBLIC,anon;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_027 GRANT EXECUTE ON FUNCTION public.apply_discount_code bigint text TO authenticated'; END $cfa_stage$;

GRANT EXECUTE ON FUNCTION public.apply_discount_code(bigint,text) TO authenticated;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_028 DO BEGIN'; END $cfa_stage$;

-- Preserve the complete existing checkout validation regardless of its formatting.
-- Add immutable coupon metadata through a wrapper, not SQL source substitution.
DO $$ BEGIN
 IF to_regprocedure('public.cfa_prepare_test_checkout_before_rewards(bigint,text)') IS NULL THEN
  ALTER FUNCTION public.cfa_prepare_test_checkout(bigint,text) RENAME TO cfa_prepare_test_checkout_before_rewards;
 END IF;
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_029 CREATE OR REPLACE FUNCTION public.cfa_prepare_test_checkout p_booking_id bigint p_lan'; END $cfa_stage$;

-- Keep existing grants on the original preparation function: it retains every
-- original identity/email/cart/amount check and cannot create or confirm a Square
-- payment. The only payment-link creator calls the wrapper below. Preserving its
-- ACL also preserves valid delegated grants and SQL dependencies.
CREATE OR REPLACE FUNCTION public.cfa_prepare_test_checkout(p_booking_id bigint,p_language text DEFAULT 'sk')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;checkout public.cfa_test_checkouts;coupon bigint;BEGIN
 IF NOT public.cfa_test_is_member() THEN RAISE EXCEPTION 'test_access_required';END IF;
 result:=public.cfa_prepare_test_checkout_before_rewards(p_booking_id,p_language);
 SELECT * INTO checkout FROM public.cfa_test_checkouts WHERE id=(result->>'id')::uuid FOR UPDATE;
 IF NOT FOUND OR checkout.user_id IS DISTINCT FROM auth.uid() OR checkout.booking_id IS DISTINCT FROM p_booking_id THEN RAISE EXCEPTION 'cart_unavailable';END IF;
 SELECT discount_code_id INTO coupon FROM public.bookings WHERE id=p_booking_id AND user_id=auth.uid();
 IF (checkout.snapshot->>'reward_coupon_id')::bigint IS DISTINCT FROM coupon THEN
  IF checkout.square_link_id IS NOT NULL OR checkout.status NOT IN('creating','awaiting_payment') THEN RAISE EXCEPTION 'cart_total_invalid';END IF;
 END IF;
 IF checkout.square_link_id IS NULL AND checkout.status IN('creating','awaiting_payment') THEN
  UPDATE public.cfa_test_checkouts SET snapshot=snapshot||jsonb_build_object('reward_coupon_id',coupon) WHERE id=checkout.id;
 END IF;
 RETURN result;
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_030 REVOKE ALL ON FUNCTION public.cfa_prepare_test_checkout bigint text FROM PUBLIC anon'; END $cfa_stage$;

REVOKE ALL ON FUNCTION public.cfa_prepare_test_checkout(bigint,text) FROM PUBLIC,anon;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_031 GRANT EXECUTE ON FUNCTION public.cfa_prepare_test_checkout bigint text TO authenticat'; END $cfa_stage$;

GRANT EXECUTE ON FUNCTION public.cfa_prepare_test_checkout(bigint,text) TO authenticated;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_032 CREATE OR REPLACE FUNCTION public.cfa_reward_coupon_payment RETURNS trigger'; END $cfa_stage$;

CREATE OR REPLACE FUNCTION public.cfa_reward_coupon_payment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE code_id bigint;r public.cfa_reward_claims;prior public.cfa_reward_coupon_uses;BEGIN
 IF TG_TABLE_NAME='cfa_test_checkouts' THEN
  IF NEW.status<>'paid' OR (TG_OP='UPDATE' AND OLD.status='paid') THEN RETURN NEW;END IF;
  code_id:=(NEW.snapshot->>'reward_coupon_id')::bigint;
 ELSE
  IF NEW.payment_status<>'paid' OR NEW.status NOT IN('confirmed','completed') OR NEW.amount_paid<NEW.total_amount THEN RETURN NEW;END IF;
  code_id:=NEW.discount_code_id;
 END IF;
 SELECT * INTO r FROM public.cfa_reward_claims WHERE coupon_id=code_id;
 IF NOT FOUND THEN RETURN NEW;END IF;
 IF r.user_id<>NEW.user_id OR (TG_TABLE_NAME='bookings' AND r.environment='sandbox') OR (TG_TABLE_NAME='cfa_test_checkouts' AND r.environment<>'sandbox') THEN RAISE EXCEPTION 'reward_coupon_environment';END IF;
 PERFORM 1 FROM public.discount_codes WHERE id=code_id FOR UPDATE;
 SELECT * INTO prior FROM public.cfa_reward_coupon_uses WHERE coupon_id=code_id;
 IF FOUND THEN
  IF TG_TABLE_NAME='cfa_test_checkouts' THEN
   IF prior.test_checkout_id IS DISTINCT FROM NEW.id THEN RAISE EXCEPTION 'reward_coupon_used';END IF;
  ELSE IF prior.booking_id<>NEW.id THEN RAISE EXCEPTION 'reward_coupon_used';END IF;END IF;
 ELSE
  IF TG_TABLE_NAME='cfa_test_checkouts' THEN
   INSERT INTO public.cfa_reward_coupon_uses(coupon_id,booking_id,test_checkout_id) VALUES(code_id,NEW.booking_id,NEW.id);
  ELSE INSERT INTO public.cfa_reward_coupon_uses(coupon_id,booking_id) VALUES(code_id,NEW.id);END IF;
  INSERT INTO public.cfa_reward_audit(claim_id,action) VALUES(r.id,'coupon_used');
 END IF;
 RETURN NEW;
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_033 DROP TRIGGER IF EXISTS cfa_reward_coupon_test ON public.cfa_test_checkouts'; END $cfa_stage$;

DROP TRIGGER IF EXISTS cfa_reward_coupon_test ON public.cfa_test_checkouts;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_034 CREATE TRIGGER cfa_reward_coupon_test BEFORE UPDATE OF status ON public.cfa_test_chec'; END $cfa_stage$;

CREATE TRIGGER cfa_reward_coupon_test BEFORE UPDATE OF status ON public.cfa_test_checkouts FOR EACH ROW EXECUTE FUNCTION public.cfa_reward_coupon_payment();
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_035 DROP TRIGGER IF EXISTS cfa_reward_coupon_live ON public.bookings'; END $cfa_stage$;

DROP TRIGGER IF EXISTS cfa_reward_coupon_live ON public.bookings;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_036 CREATE TRIGGER cfa_reward_coupon_live BEFORE INSERT OR UPDATE OF payment_status statu'; END $cfa_stage$;

CREATE TRIGGER cfa_reward_coupon_live BEFORE INSERT OR UPDATE OF payment_status,status ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.cfa_reward_coupon_payment();
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_037 CREATE OR REPLACE FUNCTION public.cfa_reward_claim_mail p_id uuid p_secret uuid RETUR'; END $cfa_stage$;

CREATE OR REPLACE FUNCTION public.cfa_reward_claim_mail(p_id uuid,p_secret uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE r public.cfa_reward_mail_jobs;BEGIN
 UPDATE public.cfa_reward_mail_jobs SET state='sending',attempts=attempts+1,lock_token=gen_random_uuid(),locked_until=now()+interval '2 minutes'
 WHERE id=p_id AND secret=p_secret AND state<>'sent' AND attempts<20 AND (locked_until IS NULL OR locked_until<now()) RETURNING * INTO r;
 IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('id',r.id,'lock_token',r.lock_token,'recipient',r.recipient,'subject',r.subject,'body',r.body);
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_038 CREATE OR REPLACE FUNCTION public.cfa_reward_finish_mail p_id uuid p_lock_token uuid '; END $cfa_stage$;

CREATE OR REPLACE FUNCTION public.cfa_reward_finish_mail(p_id uuid,p_lock_token uuid,p_success boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 UPDATE public.cfa_reward_mail_jobs SET state=CASE WHEN p_success THEN 'sent' ELSE 'pending' END,
 sent_at=CASE WHEN p_success THEN now() END,locked_until=CASE WHEN p_success THEN NULL ELSE now()+interval '1 minute' END
 WHERE id=p_id AND lock_token=p_lock_token AND state='sending';RETURN FOUND;
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_039 CREATE OR REPLACE FUNCTION public.cfa_reward_retry_mail RETURNS void'; END $cfa_stage$;

CREATE OR REPLACE FUNCTION public.cfa_reward_retry_mail() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT public.cfa_is_owner() THEN RAISE EXCEPTION 'owner_required';END IF;
 UPDATE public.cfa_reward_mail_jobs SET attempts=0,locked_until=NULL,last_dispatch=NULL,state='pending'
 WHERE state<>'sent' AND (locked_until IS NULL OR locked_until<now());
 PERFORM public.cfa_reward_dispatch_pending();
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_040 INSERT INTO public.cfa_reward_claims user_id environment milestone required_points st'; END $cfa_stage$;

-- Keep the earlier archive, including completed rewards, without issuing them twice.
INSERT INTO public.cfa_reward_claims(user_id,environment,milestone,required_points,state,items,assigned_by,assigned_at,closed_by,closed_at,created_at,method)
 SELECT user_id,'live',milestone,required_points,CASE WHEN redeemed_at IS NULL THEN 'assigned' ELSE 'delivered' END,
 jsonb_build_array(jsonb_build_object('sk',description_sk,'en',description_en)),created_by,created_at,redeemed_by,redeemed_at,created_at,'personal'
 FROM public.cfa_loyalty_rewards ON CONFLICT(user_id,environment,milestone) DO NOTHING;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_041 DO DECLARE r record BEGIN'; END $cfa_stage$;

-- Every entry point into the new ledger is explicit; no direct table access for clients.
DO $$ DECLARE r record;BEGIN
 FOR r IN SELECT oid::regprocedure signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'cfa_reward_%' LOOP
 RAISE NOTICE 'CFA_STAGE:S57_900 REVOKE %',r.signature;
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',r.signature);
 END LOOP;
END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_042 GRANT EXECUTE ON FUNCTION public.cfa_reward_retry_mail public.cfa_reward_list text bo'; END $cfa_stage$;

GRANT EXECUTE ON FUNCTION public.cfa_reward_retry_mail(),public.cfa_reward_list(text,boolean),public.cfa_reward_update(uuid,text,jsonb,text,numeric,integer,integer) TO authenticated;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_043 GRANT EXECUTE ON FUNCTION public.cfa_reward_claim_mail uuid uuid public.cfa_reward_fi'; END $cfa_stage$;

GRANT EXECUTE ON FUNCTION public.cfa_reward_claim_mail(uuid,uuid),public.cfa_reward_finish_mail(uuid,uuid,boolean) TO service_role;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_044 CREATE OR REPLACE FUNCTION public.cfa_loyalty_assign_reward p_user uuid p_milestone i'; END $cfa_stage$;

-- Preserve pre-existing grants on the legacy sync hook as well. It only
-- synchronises authoritative earned points, returns no private data and cannot
-- assign or close a reward. New mutation APIs remain owner-only.
-- Retire legacy controls so an old cached screen cannot bypass the new audit/DM flow.
CREATE OR REPLACE FUNCTION public.cfa_loyalty_assign_reward(p_user uuid,p_milestone integer,p_sk text,p_en text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'Use the Rewards page / Použite stránku Odmeny';END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_045 CREATE OR REPLACE FUNCTION public.cfa_loyalty_redeem_reward p_user uuid p_milestone i'; END $cfa_stage$;

CREATE OR REPLACE FUNCTION public.cfa_loyalty_redeem_reward(p_user uuid,p_milestone integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'Use the Rewards page / Použite stránku Odmeny';END $$;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_046 CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog'; END $cfa_stage$;

-- CRON_START
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_047 CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions'; END $cfa_stage$;

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_048 SELECT cron.schedule cfa reward mail retry SELECT public.cfa_reward_dispatch_pending'; END $cfa_stage$;

SELECT cron.schedule('cfa-reward-mail-retry','* * * * *','SELECT public.cfa_reward_dispatch_pending()');
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_049 UPDATE public.cfa_test_settings SET schema_version 3 WHERE id true'; END $cfa_stage$;

-- CRON_END
UPDATE public.cfa_test_settings SET schema_version=3 WHERE id=true;
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_050 NOTIFY pgrst reload schema'; END $cfa_stage$;

NOTIFY pgrst,'reload schema';
DO $cfa_stage$ BEGIN RAISE NOTICE 'CFA_STAGE:S57_051 COMMIT'; END $cfa_stage$;

COMMIT;`;
