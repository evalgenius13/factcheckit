export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { claim } = req.body || {};
    if (!claim || typeof claim !== 'string' || !claim.trim()) {
      return res.status(400).json({ success: false, error: 'Claim is required' });
    }
    if (claim.length > 1000) {
      return res.status(400).json({ success: false, error: 'Claim too long (max 1000 characters)' });
    }

    const body = {
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' }, // ⬅️ force pure JSON content
      temperature: 0,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: `You are a myth-busting fact-checker.
Return a single JSON object only (no extra text).

EXPLANATION MUST BE EXACTLY 3 SHORT SENTENCES IN THIS ORDER:
1) What the person/thing actually did.
2) Why they are often wrongly credited (how the internet myth arose).
3) The true fact.

JSON SHAPE:
{
  "verdict": "TRUE|FALSE|MISLEADING|CANNOT_VERIFY",
  "explanation": "3 short sentences as above.",
  "sources": [{"title": "Source Name", "url": "https://..."}],
  "formattedResponse": "≤280 chars, starts with verdict emoji, ends with '- via fact-checkit.com'"
}

SOURCES: use your normal high-quality sources (patents, journals, newspapers);
when possible, cite URLs found in a Wikipedia article’s reference list (not the article itself).`
        },
        {
          role: 'user',
          content: `Fact-check this claim: "${claim}"`
        }
      ]
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`OpenAI API error: ${response.status} ${text}`);
    }

    const data = await response.json();

    // With response_format: json_object, content is a JSON string/object
    let content = data?.choices?.[0]?.message?.content;
    let result = null;

    if (typeof content === 'string') {
      try { result = JSON.parse(content); } catch { /* fall through */ }
    } else if (content && typeof content === 'object') {
      result = content;
    }

    if (!result || typeof result !== 'object') {
      // Last-resort fallback (should rarely trigger)
      result = {
        verdict: 'CANNOT_VERIFY',
        explanation:
          'Unable to produce a structured result. This may be a common internet myth; please consult reliable sources.',
        sources: [],
        formattedResponse:
          '🔍 Unable to verify with structured output. - via fact-checkit.com'
      };
    }

    // Safety net: trim explanation to 3 sentences max
    if (typeof result.explanation === 'string') {
      const parts = result.explanation
        .replace(/\s+/g, ' ')
        .trim()
        .split(/(?<=\.)\s+/);
      if (parts.length > 3) {
        result.explanation = parts.slice(0, 3).join(' ');
      }
    }

    // Normalize/ensure fields
    result.verdict = result.verdict || 'CANNOT_VERIFY';
    if (!Array.isArray(result.sources)) result.sources = [];
    if (typeof result.formattedResponse !== 'string' || !result.formattedResponse.trim()) {
      result.formattedResponse = `🔍 ${result.explanation || 'Fact-check complete.'} - via fact-checkit.com`;
    }

    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('Fact-check error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fact-check. Please try again.' });
  }
}
