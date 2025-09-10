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

  // helper: check Wikipedia and count references
  async function getWikipediaReferencesNote(subject) {
    try {
      // Step 1: search for page
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        subject
      )}&srlimit=1&format=json&origin=*`;

      const searchResp = await fetch(searchUrl);
      if (!searchResp.ok) return "No page with references found for this subject.";

      const searchData = await searchResp.json();
      const firstHit = searchData?.query?.search?.[0];
      if (!firstHit) return "No page with references found for this subject.";

      const title = firstHit.title;

      // Step 2: fetch parsed content with sections
      const parseUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(
        title
      )}&prop=sections|text&format=json&origin=*`;

      const parseResp = await fetch(parseUrl);
      if (!parseResp.ok) return `The Wikipedia page for ${title} has no accessible references.`;

      const parseData = await parseResp.json();
      const html = parseData?.parse?.text?.['*'] || '';

      // Step 3: count list items in References section
      let refCount = 0;
      if (html) {
        const matches = html.match(/<li[^>]*>/g);
        refCount = matches ? matches.length : 0;
      }

      if (refCount > 0) {
        return `${title} has a Wikipedia page with ${refCount} references in the References section.`;
      } else {
        return `${title} has a Wikipedia page but no references were found.`;
      }
    } catch (err) {
      console.error("Wiki error:", err);
      return "No page with references found for this subject.";
    }
  }

  try {
    const systemPrompt = `Bust the myth or clarify the claim: "${claim}"; Instructions: - Write a concise, 2–3 sentence summary that corrects or clarifies the claim. - If the claim connects a person or invention to something unrelated, clearly say "this is not related" rather than suggesting a connection. - Don't be ambiguous. - Use simple, everyday English (avoid rigid or academic wording). - Clearly state what is factually wrong, misleading, or misunderstood and why. `;

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
        temperature: 0.01,
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

    // Get Wikipedia reference note
    const referenceNote = await getWikipediaReferencesNote(claim);

    // Save to Supabase
    const { data: insertData, error } = await supabase
      .from('fact_checks')
      .insert([{ claim, summary, reference_note: referenceNote }])
      .select('short_id')
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({ success: false, error: 'Failed to save fact-check.' });
    }

    return res.status(200).json({
      success: true,
      summary,
      referenceNote,
      shortId: insertData.short_id
    });
  } catch (error) {
    console.error("Handler error:", error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
