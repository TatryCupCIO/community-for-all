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
export const INSTALL_SQL=String.raw`BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('cfa-test-install',0));
REVOKE INSERT,UPDATE,DELETE ON public.bookings,public.booking_items,
 public.booking_payments,public.booking_tickets,public.tickets FROM PUBLIC,anon,authenticated;
DO $$ DECLARE r record;BEGIN
 FOR r IN SELECT table_name,column_name FROM information_schema.columns
 WHERE table_schema='public' AND table_name IN('bookings','booking_items','booking_payments','booking_tickets','tickets') LOOP
 EXECUTE format('REVOKE INSERT(%I),UPDATE(%I),REFERENCES(%I) ON public.%I FROM PUBLIC,anon,authenticated',
 r.column_name,r.column_name,r.column_name,r.table_name);
 END LOOP;
END $$;
CREATE TABLE IF NOT EXISTS public.cfa_test_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK(id),setup_id uuid NOT NULL DEFAULT gen_random_uuid(),
 webhook_id text,webhook_key text,notification_url text,configured_at timestamptz,
 schema_version integer NOT NULL DEFAULT 1
);
ALTER TABLE public.cfa_test_settings ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1;
ALTER TABLE public.cfa_test_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cfa_test_settings FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.cfa_test_settings TO service_role;
INSERT INTO public.cfa_test_settings(id) VALUES(true) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.cfa_test_is_member() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.cfa_test_access a JOIN auth.users u ON u.id=a.user_id
 WHERE a.user_id=auth.uid() AND u.email_confirmed_at IS NOT NULL);
$$;
REVOKE ALL ON FUNCTION public.cfa_test_is_member() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cfa_test_is_member() TO authenticated;
DROP POLICY IF EXISTS cfa_test_hidden_events ON public.events;
CREATE POLICY cfa_test_hidden_events ON public.events FOR SELECT TO authenticated
 USING(status='hidden' AND public.cfa_test_is_member());
DROP POLICY IF EXISTS cfa_test_hidden_options ON public.event_options;
CREATE POLICY cfa_test_hidden_options ON public.event_options FOR SELECT TO authenticated
 USING(enabled AND public.cfa_test_is_member() AND EXISTS(
 SELECT 1 FROM public.events e WHERE e.id=event_id AND e.status='hidden'));
DROP POLICY IF EXISTS cfa_test_hidden_photos ON storage.objects;
CREATE POLICY cfa_test_hidden_photos ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='event-photos' AND public.cfa_test_is_member() AND EXISTS(
 SELECT 1 FROM public.events e WHERE e.status='hidden' AND (
 (e.display_settings->'photos') ? name OR e.display_settings->>'ticket_logo_path'=name
 OR EXISTS(SELECT 1 FROM public.event_options o WHERE o.event_id=e.id
 AND o.enabled AND (o.booking_form_settings->'photos') ? name))));

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
REVOKE ALL ON FUNCTION public.cfa_test_ticket_points(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cfa_test_ticket_points(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.cfa_test_loyalty_summary() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_points bigint;v_events jsonb;BEGIN
 IF NOT public.cfa_test_is_member() THEN RAISE EXCEPTION 'test_access_required';END IF;
 SELECT COALESCE(sum(points),0),COALESCE(jsonb_agg(to_jsonb(e)),'[]'::jsonb)
 INTO v_points,v_events FROM public.cfa_test_ticket_points(auth.uid()) e;
 RETURN jsonb_build_object('points',v_points,'threshold',6,'events',v_events,'rewards','[]'::jsonb,
 'can_manage',false,'can_receive_alerts',false,'environment','sandbox');
END $$;
REVOKE ALL ON FUNCTION public.cfa_test_loyalty_summary() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cfa_test_loyalty_summary() TO authenticated;

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
REVOKE ALL ON FUNCTION public.cfa_test_guard_cart_item() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS cfa_test_guard_cart_item ON public.booking_items;
CREATE TRIGGER cfa_test_guard_cart_item BEFORE INSERT OR UPDATE OR DELETE ON public.booking_items
 FOR EACH ROW EXECUTE FUNCTION public.cfa_test_guard_cart_item();

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
REVOKE ALL ON FUNCTION public.cfa_test_release_cart() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS cfa_test_release_cart ON public.cfa_test_checkouts;
CREATE TRIGGER cfa_test_release_cart AFTER UPDATE OF status ON public.cfa_test_checkouts
 FOR EACH ROW EXECUTE FUNCTION public.cfa_test_release_cart();
NOTIFY pgrst, 'reload schema';
COMMIT;
SELECT public.cfa_test_is_member() IS NOT NULL
 AND NOT has_table_privilege('anon','public.cfa_test_settings','SELECT')
 AS kompletna_skuska_pripravena;
`;
