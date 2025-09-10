import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ success: false, error: 'Missing shortId' });
  }

  try {
    const { data, error } = await supabase
      .from('fact_checks')
      .select('claim, summary, reference_url')
      .eq('short_id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Fact-check not found' });
    }

    return res.status(200).json({ success: true, ...data });
  } catch (err) {
    console.error('Retrieve fact-check error:', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}
