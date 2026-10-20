export const API_URL = ['127.0.0.1','localhost'].includes(location.hostname)
 ? new URL('api/',location.href).href
 : 'https://gflevpmkzqnxqgflyayx.supabase.co/functions/v1/sales-hub-api/';
