import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { claim } = req.body;
  if (!claim || typeof claim !== 'string' || claim.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Claim is required' });
  }
  if (claim.length > 1000) {
    return res.status(400).json({ success: false, error: 'Claim too long (max 1000 characters)' });
  }

  // helper: ask OpenAI for a Wikipedia reference link
  async function getWikipediaPage(subject) {
    try {
      const prompt = `
Return ONLY the direct Wikipedia URL ending with "#References" for the subject: "${subject}".
Rules:
- Respond ONLY with the URL (no text, no explanation).
- If no clear Wikipedia page exists, respond with "NONE".
`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: prompt }],
          max_tokens: 50,
          temperature: 0.0,
        }),
      });

      if (!response.ok) return null;

      const data = await response.json();
      const url = data.choices?.[0]?.message?.content?.trim();

      if (!url || url === 'NONE') {
        return "No sources found.";
      }

      return url;
    } catch (e) {
      console.error("Wiki resolver error:", e);
      return "No sources found.";
    }
  }

  try {
    const systemPrompt = `Bust the myth or clarify the claim: "${claim}"; Instructions: - Write a concise, 2–3 sentence summary that corrects or clarifies the claim. - If the claim connects a person or invention to something unrelated, clearly say "this is not related" rather than suggesting a connection. - Use simple, everyday English (avoid rigid or academic wording). - Clearly state what is factually wrong, misleading, or misunderstood and why. - Do not copy text directly from Wikipedia.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: claim }
        ],
        max_tokens: 400,
        temperature: 0.0,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';
    if (!content) {
      return res.status(500).json({ success: false, error: 'No response from AI' });
    }

    const summary = content;

    // Get the Wikipedia reference link
    const referenceUrl = await getWikipediaPage(claim);

    // Save to Supabase
    const { data: insertData, error } = await supabase
      .from('fact_checks')
      .insert([{ claim, summary, reference_url: referenceUrl }])
      .select('short_id')
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({ success: false, error: 'Failed to save fact-check.' });
    }

    return res.status(200).json({ success: true, summary, referenceUrl, shortId: insertData.short_id });
  } catch (error) {
    console.error("Handler error:", error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
