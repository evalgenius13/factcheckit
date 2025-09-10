import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
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

  try {
    // ---- Pass 1 ----
    const pass1Prompt = `Bust the myth or clarify the claim: "${claim}".
Write a concise, 2–3 sentence summary that directly corrects or clarifies the claim.
Use everyday English. Be clear and firm — do not be ambiguous or vague.`;

    const pass1Resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: pass1Prompt },
          { role: 'user', content: claim }
        ],
        max_tokens: 400,
        temperature: 0.01,
      }),
    });
    const pass1Data = await pass1Resp.json();
    const pass1 = pass1Data.choices?.[0]?.message?.content?.trim() || '';

    // ---- Pass 2 ----
    const pass2Prompt = `Review this first response critically. 
Point out weaknesses, missing context, or any corrections needed.

First response:
${pass1}`;

    const pass2Resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: pass2Prompt },
          { role: 'user', content: claim }
        ],
        max_tokens: 400,
        temperature: 0.01,
      }),
    });
    const pass2Data = await pass2Resp.json();
    const pass2 = pass2Data.choices?.[0]?.message?.content?.trim() || '';

    // ---- Pass 3 (Consensus) ----
    const systemPrompt = `Bust the myth or clarify the claim: "${claim}".

Instructions:
- Use the claim, the first response, and the critique to form the final, most accurate answer.
- Write a concise, 2–3 sentence summary that directly corrects or clarifies the claim.
- Use everyday English.
- Be clear and firm — do not be ambiguous or vague.
- Clearly state what is factually wrong, misleading, or misunderstood and why.
- At the end, add one plain text reference on a new line in this format:
"Reference: [Source Name]"
Preferred sources are Wikipedia or Britannica. If the topic is not covered there, use another well-known and reputable source (e.g., CDC, WHO, NASA, major news or academic publications).
- Do not include links.

First response:
${pass1}

Critique:
${pass2}`;

    const finalResp = await fetch('https://api.openai.com/v1/chat/completions', {
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
        temperature: 0.01,
      }),
    });

    if (!finalResp.ok) {
      const errorText = await finalResp.text();
      console.error("OpenAI API error:", finalResp.status, errorText);
      throw new Error(`OpenAI API error: ${finalResp.status}`);
    }

    const data = await finalResp.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';
    if (!content) {
      return res.status(500).json({ success: false, error: 'No response from AI' });
    }

    const summary = content;

    // Save to Supabase
    const { data: insertData, error } = await supabase
      .from('fact_checks')
      .insert([{ claim, summary }])
      .select('short_id')
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({ success: false, error: 'Failed to save fact-check.' });
    }

    return res.status(200).json({
      success: true,
      summary,
      shortId: insertData.short_id
    });
  } catch (error) {
    console.error("Handler error:", error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
