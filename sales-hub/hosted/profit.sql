CREATE TABLE sales_hub_private.profit_models(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), data jsonb NOT NULL);
ALTER TABLE sales_hub_private.profit_models ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sales_hub_private.profit_models FROM PUBLIC,anon,authenticated;
GRANT ALL ON sales_hub_private.profit_models TO service_role;
CREATE OR REPLACE FUNCTION public.sales_hub_profit(p_action text,p_body jsonb DEFAULT '{}',p_token text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF current_user NOT IN ('service_role','postgres') THEN RETURN jsonb_build_object('_status',403,'error','Access denied.'); END IF;
 IF NOT EXISTS(SELECT 1 FROM sales_hub_private.sessions WHERE hash=encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex') AND expires_at>now()) THEN RETURN jsonb_build_object('_status',401,'error','Sign in to open event profitability.'); END IF;
 IF p_action<>'config' THEN RETURN jsonb_build_object('_status',404,'error','Page not found.'); END IF;
 RETURN (SELECT data FROM sales_hub_private.profit_models WHERE singleton);
END $$;
REVOKE ALL ON FUNCTION public.sales_hub_profit(text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sales_hub_profit(text,jsonb,text) TO service_role;
