CREATE TABLE IF NOT EXISTS sales_hub_private.lnr_accounts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),source_key text UNIQUE NOT NULL,data jsonb NOT NULL,revision integer NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS sales_hub_private.lnr_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid NOT NULL REFERENCES sales_hub_private.lnr_accounts(id),action text NOT NULL,details jsonb NOT NULL,at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS sales_hub_private.lnr_versions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid NOT NULL REFERENCES sales_hub_private.lnr_accounts(id),details jsonb NOT NULL,at timestamptz NOT NULL DEFAULT now());
ALTER TABLE sales_hub_private.lnr_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_hub_private.lnr_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_hub_private.lnr_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sales_hub_private.lnr_accounts,sales_hub_private.lnr_events,sales_hub_private.lnr_versions FROM PUBLIC,anon,authenticated;
GRANT ALL ON sales_hub_private.lnr_accounts,sales_hub_private.lnr_events,sales_hub_private.lnr_versions TO service_role;
CREATE OR REPLACE FUNCTION public.sales_hub_lnr(p_action text,p_body jsonb DEFAULT '{}',p_token text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r sales_hub_private.lnr_accounts%ROWTYPE; result jsonb; v jsonb; item text; n text; next_status text; amt numeric; vid uuid;
BEGIN
 IF current_user NOT IN ('service_role','postgres') THEN RETURN jsonb_build_object('_status',403,'error','Access denied.'); END IF;
 IF NOT EXISTS(SELECT 1 FROM sales_hub_private.sessions WHERE hash=encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex') AND expires_at>now()) THEN RETURN jsonb_build_object('_status',401,'error','Sign in to open your saved accounts.'); END IF;
 IF p_body IS NULL OR jsonb_typeof(p_body)<>'object' THEN RAISE EXCEPTION 'Invalid request.'; END IF;
 IF p_action='list' THEN
  SELECT coalesce(jsonb_agg(data||jsonb_build_object('id',id,'revision',revision) ORDER BY lower(data->>'company')),'[]') INTO result FROM sales_hub_private.lnr_accounts;RETURN result;
 END IF;
 IF p_action='create' THEN
  n:=sales_hub_private.txt(p_body,'company',200,true);
  IF EXISTS(SELECT 1 FROM sales_hub_private.lnr_accounts WHERE lower(data->>'company')=lower(n)) THEN RAISE EXCEPTION 'That company already exists.';END IF;
  INSERT INTO sales_hub_private.lnr_accounts(source_key,data) VALUES('manual-'||gen_random_uuid(),jsonb_build_object('company',n,'management','local','status','not_started','history','[]'::jsonb,'sources','[]'::jsonb,'reviewNotes','[]'::jsonb)) RETURNING * INTO r;
  INSERT INTO sales_hub_private.lnr_events(account_id,action,details) VALUES(r.id,'account_created','{}');
  RETURN r.data||jsonb_build_object('id',r.id,'revision',r.revision);
 END IF;
 SELECT * INTO r FROM sales_hub_private.lnr_accounts WHERE id=(p_body->>'id')::uuid FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('_status',404,'error','Account not found.'); END IF;
 IF p_action='history' THEN
  SELECT jsonb_build_object('events',coalesce((SELECT jsonb_agg(jsonb_build_object('action',action,'details',details,'at',at) ORDER BY at DESC) FROM sales_hub_private.lnr_events WHERE account_id=r.id),'[]'::jsonb),'versions',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'details',details,'at',at) ORDER BY at DESC) FROM sales_hub_private.lnr_versions WHERE account_id=r.id),'[]'::jsonb)) INTO result;RETURN result;
 END IF;
 IF p_action NOT IN ('save','generate') THEN RAISE EXCEPTION 'Unknown account action.'; END IF;
 IF (p_body->>'revision')::integer IS DISTINCT FROM r.revision THEN RETURN jsonb_build_object('_status',409,'error','This account changed in another window. Close it and reopen the latest record.');END IF;
 v:=r.data;
 FOREACH item IN ARRAY ARRAY['contractCompany','contactName','contactEmail','contactPhone','contactTitle','street','cityState','country','notes','availability','roomType','management','status','sentDate','signedDate','acceptBy','additionalRate'] LOOP
  IF p_body ? item THEN v:=jsonb_set(v,ARRAY[item],to_jsonb(sales_hub_private.txt(p_body,item,CASE WHEN item='notes' THEN 3000 ELSE 200 END)));END IF;
 END LOOP;
 IF coalesce(v->>'management','local') NOT IN ('local','central','review') THEN RAISE EXCEPTION 'Choose an account type.'; END IF;
 IF coalesce(v->>'availability','NLRA') NOT IN ('LRA','NLRA') THEN RAISE EXCEPTION 'Choose LRA or NLRA.'; END IF;
 FOREACH item IN ARRAY ARRAY['rate2027','proposed2027'] LOOP
  IF p_body ? item THEN
   IF p_body->item='null'::jsonb OR p_body->>item='' THEN v:=jsonb_set(v,ARRAY[item],'null');
   ELSE amt:=(p_body->>item)::numeric;IF amt<>trunc(amt) OR amt<100 OR amt>1000000 THEN RAISE EXCEPTION 'Enter a rate between $1 and $10,000.';END IF;v:=jsonb_set(v,ARRAY[item],to_jsonb(amt::integer));END IF;
  END IF;
 END LOOP;
 next_status:=coalesce(v->>'status','not_started');
 IF next_status NOT IN ('not_started','draft','sent','signed','rejected','not_needed','not_renewing') THEN RAISE EXCEPTION 'Choose a renewal status.'; END IF;
 FOREACH item IN ARRAY ARRAY['sentDate','signedDate','acceptBy'] LOOP
  IF coalesce(v->>item,'')<>'' THEN PERFORM sales_hub_private.day(v->>item,item,true);END IF;
 END LOOP;
 IF next_status='sent' AND coalesce(v->>'sentDate','')='' THEN RAISE EXCEPTION 'Enter the date the contract was sent.';END IF;
 IF next_status='signed' AND coalesce(v->>'signedDate','')='' THEN RAISE EXCEPTION 'Enter the date the contract was signed.';END IF;
 IF coalesce(v->>'sentDate','')>to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD') OR coalesce(v->>'signedDate','')>to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD') THEN RAISE EXCEPTION 'Sent and signed dates cannot be in the future.';END IF;
 IF coalesce(v->>'sentDate','')<>'' AND coalesce(v->>'signedDate','')<>'' AND v->>'sentDate'>v->>'signedDate' THEN RAISE EXCEPTION 'The signed date cannot precede the sent date.';END IF;
 IF p_action='generate' THEN
  IF v->>'management'<>'local' THEN RAISE EXCEPTION 'Local contracts are available for locally negotiated accounts. Confirm the account type first.';END IF;
  IF coalesce((v->>'rate2027')::integer,0)<100 OR coalesce(v->>'contactName','')='' THEN RAISE EXCEPTION 'Enter the 2027 rate and contact name.';END IF;
  IF coalesce(v->>'acceptBy','')='' THEN RAISE EXCEPTION 'Choose the contract return date.';END IF;
  IF next_status='not_started' THEN v:=jsonb_set(v,'{status}','"draft"');END IF;
  INSERT INTO sales_hub_private.lnr_versions(account_id,details) VALUES(r.id,v||jsonb_build_object('contractYear',2027,'templateVersion','2026-no-blackouts-v1')) RETURNING id INTO vid;
 END IF;
 UPDATE sales_hub_private.lnr_accounts SET data=v,revision=revision+1 WHERE id=r.id RETURNING * INTO r;
 INSERT INTO sales_hub_private.lnr_events(account_id,action,details) VALUES(r.id,CASE WHEN p_action='generate' THEN 'contract_generated' ELSE 'account_updated' END,jsonb_build_object('status',r.data->>'status','rate2027',r.data->'rate2027','contactName',r.data->>'contactName','sentDate',r.data->>'sentDate','signedDate',r.data->>'signedDate','versionId',vid));
 RETURN r.data||jsonb_build_object('id',r.id,'revision',r.revision,'versionId',vid);
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN jsonb_build_object('_status',400,'error','Check the rate, dates and account details.');
 WHEN OTHERS THEN RETURN jsonb_build_object('_status',400,'error',SQLERRM);
END $$;
REVOKE ALL ON FUNCTION public.sales_hub_lnr(text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sales_hub_lnr(text,jsonb,text) TO service_role;
