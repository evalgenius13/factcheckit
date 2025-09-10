export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request for CORS
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
            content: `You are a myth-busting fact-checker. Focus on debunking common internet myths and viral misinformation with clear explanations.

RESPONSE FORMAT (JSON):
{
  "verdict": "TRUE|FALSE|MISLEADING|CANNOT_VERIFY", 
  "explanation": "Brief myth-busting explanation: What's false, what's actually true, and why this myth persists",
  "sources": [{"title": "Source Name", "url": "https://..."}],
  "formattedResponse": "Social media ready response"
}

MYTH-BUSTING FOCUS:
- Clearly state what's false about viral claims
- Provide the correct facts  
- Explain why people believe the myth (common confusion, viral misinformation, etc.)
- Identify it as a "common internet myth" when applicable

SOURCE REQUIREMENTS:
- Find original sources from Wikipedia reference sections, NOT Wikipedia itself
- Use primary sources like scientific journals, newspapers, patent offices, academic papers
- Provide working links to actual source documents
- Example: Use "IEEE Journal" not "Wikipedia page about IEEE"

FORMATTED RESPONSE RULES:
- Start with verdict emoji (✅❌⚠️🔍) 
- Keep under 280 characters for Twitter compatibility
- Include key facts only
- End with "- via fact-checkit.com"
- Be neutral and factual

EXAMPLE:
"❌ FALSE: Superman budget is $225M, not $400M. Supergirl budget not yet released. Sources: [2 links] - via fact-checkit.com"`
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
      throw new Error(`OpenAI API error: ${response.status}`);
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
        formattedResponse: `🔍 ${content.substring(0, 200)}... - via fact-checkit.com`
      };
    }

    // Ensure required fields exist
    result.verdict = result.verdict || 'CANNOT_VERIFY';
    result.explanation = result.explanation || 'Unable to verify this claim.';
    result.sources = result.sources || [];
    result.formattedResponse = result.formattedResponse || `🔍 ${result.explanation} - via fact-checkit.com`;

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
