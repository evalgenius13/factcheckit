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

  try {
    const systemPrompt = `
Bust the myth or clarify the claim: "${claim}"

Instructions:
- Write a concise, 3-sentence summary that corrects or clarifies the claim.
- Clearly state what is factually wrong, misleading, or misunderstood and why.
- Provide 2–3 sources, but ONLY return Wikipedia links (format as: title + Wikipedia URL).
- If no reliable sources are available, return a single fallback link to Wikipedia's "List of common misconceptions" page.

Format your response as:
[Myth-busting summary]

Sources:
- [Source 1 Name](Source 1 URL)
- [Source 2 Name](Source 2 URL)
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }],
        max_tokens: 500,
        temperature: 0.2,
      }),
    });

    if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';

    let summary = '';
    let sources = [];

    try {
      const parts = content.split('Sources:');
      summary = parts[0].trim();

      if (parts[1]) {
        sources = parts[1]
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.startsWith('-'))
          .map(line => {
            const match = line.match(/\[(.+?)\]\((https?:\/\/.+?)\)/);
            return match ? { title: match[1], url: match[2] } : null;
          })
          .filter(Boolean);
      }
    } catch (e) {
      console.error('Parse error:', e);
    }

    // Fallbacks
    if (!summary) {
      summary = "Unable to verify this claim at this time.";
    }
    if (!sources || sources.length === 0) {
      sources = [
        {
          title: "List of common misconceptions - Wikipedia",
          url: "https://en.wikipedia.org/wiki/List_of_common_misconceptions",
        },
      ];
    }

    return res.status(200).json({ success: true, summary, sources });
  } catch (error) {
    console.error('Fact-check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fact-check. Please try again.',
    });
  }
}
