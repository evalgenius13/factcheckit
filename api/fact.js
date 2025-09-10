import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ success: false, error: 'Missing shortId' });
  }

  try {
    const { data, error } = await supabase
      .from('fact_checks')
      .select('claim, summary')
      .eq('short_id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Fact-check not found.' });
    }

    return res.status(200).json({
      success: true,
      claim: data.claim,
      summary: data.summary
    });
  } catch (e) {
    console.error("Supabase fetch error:", e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
