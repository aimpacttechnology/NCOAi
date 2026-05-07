import { createClient } from '@supabase/supabase-js';

export async function requireAdmin(req: any, res: any): Promise<boolean> {
  const token = (req.headers.authorization ?? '').replace('Bearer ', '').trim();

  if (!token) {
    res.status(401).json({ error: 'Authorization token required' });
    return false;
  }

  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return false;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required for doctrine library management' });
    return false;
  }

  return true;
}
