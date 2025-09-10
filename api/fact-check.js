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
    const systemPrompt = `Bust the myth or clarify the claim: "${claim}"; Instructions: 
    - Write a concise, 2–3 sentence summary that corrects or clarifies the claim. 
    - If the claim connects a person or invention to something unrelated, clearly say "this is not related".
    -At the end of every answer, you must include one sentence that begins with the exact words: 
"According to [Source], …"

    - Replace [Source] with the name of the most reliable reference (e.g., Wikipedia, Britannica, a major news outlet).
    - Always include this sentence on a new line at the end of your output. Never omit it.
    - Use everyday English. 
    - Do not inckude links. 
    - Do not give ambiguous information.
    - Clearly state what is factually wrong, misleading, or misunderstood and why.`;

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

    // Generate a random shortId (for share links)
    const shortId = Math.random().toString(36).substring(2, 8);

    return res.status(200).json({
      success: true,
      summary,
      shortId
    });
  } catch (error) {
    console.error("Handler error:", error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
