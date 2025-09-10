export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a myth-busting fact-checker. 
Your job is to debunk viral internet myths clearly and concisely. 

RESPONSE FORMAT (JSON):
{
  "verdict": "TRUE|FALSE|MISLEADING|CANNOT_VERIFY", 
  "explanation": "Maximum 3 short sentences. Must include: (1) what the person/thing actually did, (2) why they are often wrongly credited or the myth exists, and (3) the true fact.",
  "sources": [{"title": "Source Name", "url": "https://..."}],
  "formattedResponse": "Social media ready response"
}

RULES:
- Always explain the origin of the myth or why it persists (e.g. word confusion, viral misinformation, misattribution). 
- Keep explanations under 3 short sentences.
- Use neutral, factual tone.
- Label clearly if it is a 'common internet myth'.
- Sources: pull from Wikipedia **reference sections only** (not article text), or other primary sources like patents, academic journals, or newspapers. Always return working URLs.
- Social media response: ≤280 chars, start with emoji verdict, end with "- via fact-checkit.com".`
          },
          {
            role: 'user',
            content: `Fact-check this claim: "${claim}"`
          }
        ],
        max_tokens: 500,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(\`OpenAI API error: \${response.status}\`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    let result;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      // Fallback if AI doesn't return valid JSON
      result = {
        verdict: 'CANNOT_VERIFY',
        explanation: content.substring(0, 200),
        sources: [],
        formattedResponse: \`🔍 \${content.substring(0, 200)}... - via fact-checkit.com\`
      };
    }

    // Ensure required fields exist
    result.verdict = result.verdict || 'CANNOT_VERIFY';
    result.explanation = result.explanation || 'Unable to verify this claim.';
    result.sources = result.sources || [];
    result.formattedResponse = result.formattedResponse || \`🔍 \${result.explanation} - via fact-checkit.com\`;

    return res.status(200).json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Fact-check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fact-check. Please try again.'
    });
  }
}
