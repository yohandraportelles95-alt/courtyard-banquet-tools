CREATE OR REPLACE FUNCTION public.sales_hub_dispatch(p_action text,p_body jsonb DEFAULT '{}'::jsonb,p_token text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 cfg sales_hub_private.settings%ROWTYPE; cert sales_hub_private.certificates%ROWTYPE;
 prior sales_hub_private.issue_requests%ROWTYPE; core jsonb; item jsonb; candidate jsonb; result jsonb;
 now_day text:=to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD');
 session_token text; token_hash text; key text; no text; no_match text[]; yr integer; seq integer;
 new_id uuid; stamp text; state text; redeemed text; staff text; confirmation text; reason text;
 added integer:=0; skipped integer:=0; seen text[]:='{}'; pass text;
BEGIN
 IF current_user NOT IN ('service_role','postgres') THEN RETURN jsonb_build_object('error','Access denied.','_status',403); END IF;
 IF p_body IS NULL OR jsonb_typeof(p_body)<>'object' THEN RAISE EXCEPTION 'Invalid request.'; END IF;
 SELECT * INTO cfg FROM sales_hub_private.settings WHERE singleton FOR UPDATE;
 IF p_action='setup' THEN
  IF cfg.password_hash IS NOT NULL OR cfg.bootstrap_hash IS NULL OR encode(extensions.digest(coalesce(p_body->>'setupToken',''),'sha256'),'hex')<>cfg.bootstrap_hash THEN RETURN jsonb_build_object('error','This setup link is invalid or already used.','_status',403); END IF;
  pass:=sales_hub_private.txt(p_body,'password',128,true);
  IF length(pass)<16 OR octet_length(pass)>72 THEN RAISE EXCEPTION 'Choose a password of 16-72 characters.'; END IF;
  UPDATE sales_hub_private.settings SET password_hash=extensions.crypt(pass,extensions.gen_salt('bf',12)),bootstrap_hash=NULL,failed_count=0,blocked_until=NULL WHERE singleton;
  INSERT INTO sales_hub_private.audit(action,details) VALUES('access_configured','{}');
  p_action:='login';
 END IF;
 IF p_action='login' THEN
  SELECT * INTO cfg FROM sales_hub_private.settings WHERE singleton;
  IF cfg.password_hash IS NULL THEN RETURN jsonb_build_object('error','Open your private setup link to choose a password first.','_status',401); END IF;
  IF cfg.blocked_until>now() THEN RETURN jsonb_build_object('error','Too many attempts. Try again in a minute.','_status',429); END IF;
  pass:=sales_hub_private.txt(p_body,'password',128,true);
  IF octet_length(pass)>72 OR extensions.crypt(pass,cfg.password_hash)<>cfg.password_hash THEN
   UPDATE sales_hub_private.settings SET failed_count=CASE WHEN failed_count>=4 THEN 0 ELSE failed_count+1 END,blocked_until=CASE WHEN failed_count>=4 THEN now()+interval '1 minute' ELSE NULL END WHERE singleton;
   RETURN jsonb_build_object('error','Incorrect password.','_status',401);
  END IF;
  UPDATE sales_hub_private.settings SET failed_count=0,blocked_until=NULL WHERE singleton;
  DELETE FROM sales_hub_private.sessions WHERE expires_at<now();
  session_token:=encode(extensions.gen_random_bytes(32),'hex');
  INSERT INTO sales_hub_private.sessions VALUES(encode(extensions.digest(session_token,'sha256'),'hex'),now()+interval '8 hours');
  RETURN jsonb_build_object('token',session_token,'expiresIn',28800);
 END IF;
 token_hash:=encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex');
 IF NOT EXISTS(SELECT 1 FROM sales_hub_private.sessions WHERE hash=token_hash AND expires_at>now()) THEN RETURN jsonb_build_object('error','Sign in to open your saved tracker.','_status',401); END IF;
 IF p_action='logout' THEN DELETE FROM sales_hub_private.sessions WHERE hash=token_hash; RETURN jsonb_build_object('ok',true); END IF;
 IF p_action='settings' THEN RETURN jsonb_build_object('ready',cfg.ready,'today',now_day,'terms',sales_hub_private.default_terms(),'corrections',cfg.corrections); END IF;
 IF p_action='list' THEN SELECT coalesce(jsonb_agg(data ORDER BY year DESC,sequence DESC),'[]'::jsonb) INTO result FROM sales_hub_private.certificates; RETURN result; END IF;
 IF p_action='import' THEN
  IF coalesce(p_body->'confirmComplete','false'::jsonb)<>'true'::jsonb THEN RAISE EXCEPTION 'Confirm that this is the complete historical certificate log.'; END IF;
  IF jsonb_typeof(p_body->'rows') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Choose a certificate log.'; END IF;
  IF jsonb_array_length(p_body->'rows') NOT BETWEEN 1 AND 5000 THEN RAISE EXCEPTION 'Import between 1 and 5,000 rows.'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_body->'rows') LOOP
   no_match:=regexp_match(btrim(coalesce(item->>'number','')),'^(\d{4})\s*[--]\s*(\d{1,6})$');
   IF no_match IS NULL OR no_match[2]::integer<1 THEN RAISE EXCEPTION 'Check certificate number %.',item->>'number'; END IF;
   yr:=no_match[1]::integer; seq:=no_match[2]::integer;no:=yr::text||'-'||lpad(seq::text,greatest(2,length(seq::text)),'0');
   IF no=ANY(seen) THEN RAISE EXCEPTION 'Duplicate certificate number % in the import.',no; END IF;seen:=array_append(seen,no);
   core:=sales_hub_private.clean(item,true); IF cfg.corrections ? no THEN core:=core||(cfg.corrections->no); END IF;state:=coalesce(item->>'state','issued');
   IF state NOT IN ('issued','redeemed','void') THEN RAISE EXCEPTION 'Check redemption status for %.',no; END IF;
   redeemed:=sales_hub_private.day(item->>'redeemedDate','redemption date',false);
   IF redeemed<>'' AND (state<>'redeemed' OR redeemed>now_day) THEN RAISE EXCEPTION 'Check redemption date for %.',no; END IF;
   candidate:=core||jsonb_build_object('number',no,'state',state,'legacy',1,'redeemedDate',coalesce(redeemed,''),'redeemedBy',sales_hub_private.txt(item,'redeemedBy',150),'confirmation',sales_hub_private.txt(item,'confirmation',150));
   SELECT * INTO cert FROM sales_hub_private.certificates WHERE year=yr AND sequence=seq;
   IF FOUND THEN
    IF cert.data-ARRAY['id','createdAt','updatedAt'] IS DISTINCT FROM candidate THEN RAISE EXCEPTION 'Certificate % already exists with different details. Nothing was imported.',no; END IF;
    skipped:=skipped+1;CONTINUE;
   END IF;
   new_id:=gen_random_uuid();stamp:=to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
   INSERT INTO sales_hub_private.certificates VALUES(new_id,yr,seq,candidate||jsonb_build_object('id',new_id,'createdAt',stamp,'updatedAt',stamp));
   INSERT INTO sales_hub_private.counters VALUES(yr,seq) ON CONFLICT(year) DO UPDATE SET last_value=greatest(sales_hub_private.counters.last_value,excluded.last_value);
   INSERT INTO sales_hub_private.audit(certificate_id,action,details) VALUES(new_id,'imported',jsonb_build_object('number',no));added:=added+1;
  END LOOP;
  UPDATE sales_hub_private.settings SET ready=true WHERE singleton;
  INSERT INTO sales_hub_private.audit(action,details) VALUES('log_verified',jsonb_build_object('added',added,'skipped',skipped));
  RETURN jsonb_build_object('added',added,'skipped',skipped);
 END IF;
 IF p_action='issue' THEN
  IF NOT cfg.ready THEN RAISE EXCEPTION 'Import and verify the existing log before issuing certificates.'; END IF;
  core:=sales_hub_private.clean(p_body,false);key:=sales_hub_private.txt(p_body,'requestKey',100,true);
  IF core->>'recipient'='' AND core->>'organization'='' THEN RAISE EXCEPTION 'Enter a recipient or organization.'; END IF;
  IF core->>'issuedDate'>now_day THEN RAISE EXCEPTION 'Issue date cannot be in the future.'; END IF;
  IF core->>'expires'<now_day THEN RAISE EXCEPTION 'A new certificate must not already be expired.'; END IF;
  SELECT * INTO prior FROM sales_hub_private.issue_requests WHERE request_key=key;
  IF FOUND THEN
   IF prior.payload IS DISTINCT FROM core THEN RAISE EXCEPTION 'This save request was already used with different details. Close and reopen the form.'; END IF;
   SELECT data INTO result FROM sales_hub_private.certificates WHERE id=prior.certificate_id;RETURN result;
  END IF;
  yr:=substring(core->>'issuedDate',1,4)::integer;
  INSERT INTO sales_hub_private.counters VALUES(yr,0) ON CONFLICT DO NOTHING;
  UPDATE sales_hub_private.counters SET last_value=last_value+1 WHERE year=yr RETURNING last_value INTO seq;
  no:=yr::text||'-'||lpad(seq::text,greatest(2,length(seq::text)),'0');new_id:=gen_random_uuid();stamp:=to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  result:=core||jsonb_build_object('id',new_id,'number',no,'state','issued','legacy',0,'redeemedDate','','redeemedBy','','confirmation','','createdAt',stamp,'updatedAt',stamp);
  INSERT INTO sales_hub_private.certificates VALUES(new_id,yr,seq,result);
  INSERT INTO sales_hub_private.issue_requests VALUES(key,new_id,core);
  INSERT INTO sales_hub_private.audit(certificate_id,action,details) VALUES(new_id,'issued',jsonb_build_object('number',no,'issuedBy',core->>'issuedBy'));
  RETURN result;
 END IF;
 IF p_action IN ('redeem','void','history') THEN
  IF coalesce(p_body->>'id','') !~ '^[0-9a-f-]{36}$' THEN RAISE EXCEPTION 'Certificate not found.'; END IF;
  SELECT * INTO cert FROM sales_hub_private.certificates WHERE id=(p_body->>'id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Certificate not found.','_status',404); END IF;
  IF p_action='history' THEN
   SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'action',action,'details',details::text,'at',at) ORDER BY at),'[]'::jsonb) INTO result FROM sales_hub_private.audit WHERE certificate_id=cert.id;RETURN result;
  END IF;
  IF cert.data->>'state'<>'issued' THEN RAISE EXCEPTION 'This certificate has already been redeemed or voided.'; END IF;
  IF p_action='redeem' THEN
   redeemed:=sales_hub_private.day(p_body->>'redeemedDate','redemption date');staff:=sales_hub_private.txt(p_body,'redeemedBy',150,true);confirmation:=sales_hub_private.txt(p_body,'confirmation',150);
   IF redeemed>now_day THEN RAISE EXCEPTION 'Redemption date cannot be in the future.'; END IF;
   IF cert.data->>'issuedDate'<>'' AND redeemed<cert.data->>'issuedDate' THEN RAISE EXCEPTION 'Redemption cannot be before the issue date.'; END IF;
   IF cert.data->>'expires'<>'' AND redeemed>cert.data->>'expires' THEN RAISE EXCEPTION 'This certificate was expired on the redemption date.'; END IF;
   core:=jsonb_build_object('state','redeemed','redeemedDate',redeemed,'redeemedBy',staff,'confirmation',confirmation);
  ELSE
   reason:=sales_hub_private.txt(p_body,'reason',1000,true);core:=jsonb_build_object('state','void');
  END IF;
  result:=cert.data||core||jsonb_build_object('updatedAt',to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  UPDATE sales_hub_private.certificates SET data=result WHERE id=cert.id;
  INSERT INTO sales_hub_private.audit(certificate_id,action,details) VALUES(cert.id,CASE WHEN p_action='void' THEN 'voided' ELSE 'redeemed' END,CASE WHEN p_action='void' THEN jsonb_build_object('reason',reason) ELSE core END);
  RETURN result;
 END IF;
 RETURN jsonb_build_object('error','Page not found.','_status',404);
EXCEPTION WHEN raise_exception THEN RETURN jsonb_build_object('error',SQLERRM,'_status',400);
 WHEN unique_violation THEN RETURN jsonb_build_object('error','A certificate number conflicts with an existing record. Nothing was saved.','_status',409);
 WHEN OTHERS THEN RETURN jsonb_build_object('error','Could not save the change. Check the imported dates and details, then try again.','_status',400);
END $$;

