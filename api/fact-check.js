// api/fact-check.js
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

    // Function-calling tool schema
    const tools = [
      {
        type: 'function',
        function: {
          name: 'emit_fact_check',
          description: 'Return a myth-busting fact check in a strict schema.',
          parameters: {
            type: 'object',
            properties: {
              verdict: {
                type: 'string',
                enum: ['TRUE', 'FALSE', 'MISLEADING', 'CANNOT_VERIFY']
              },
              explanation: {
                type: 'string',
                description:
                  'Exactly 3 short sentences: (1) what they actually did, (2) why they are miscredited or how the myth arose, (3) the true fact.'
              },
              sources: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    url: { type: 'string' }
                  },
                  required: ['title', 'url'],
                  additionalProperties: false
                }
              },
              formattedResponse: {
                type: 'string',
                description:
                  '≤280 chars, start with verdict emoji, end with "- via fact-checkit.com".'
              }
            },
            required: ['verdict', 'explanation', 'sources', 'formattedResponse'],
            additionalProperties: false
          }
        }
      }
    ];

    const body = {
      model: 'gpt-4o-mini',
      temperature: 0.1,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content:
            `You are a myth-busting fact-checker.
When a person is wrongly credited, ALWAYS cover: (1) what they actually did, (2) why they are miscredited / how the myth arose, (3) the true fact.
Explain in ≤3 short sentences.
For sources: use your normal high-quality sources (patents, journals, newspapers), but when possible cite URLs found in Wikipedia reference sections (NOT the article page itself).
Your output MUST be returned via the emit_fact_check function call. Do NOT write anything outside the function arguments.`
        },
        {
          role: 'user',
          content: `Fact-check this claim: "${claim}"`
        }
      ],
      tools,
      tool_choice: { type: 'function', function: { name: 'emit_fact_check' } }
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

    // Prefer tool call args (strict schema)
    const choice = data?.choices?.[0];
    let result = null;

    if (choice?.message?.tool_calls?.length) {
      const tc = choice.message.tool_calls.find(
        (t) => t.type === 'function' && t.function?.name === 'emit_fact_check'
      );
      if (tc?.function?.arguments) {
        try {
          result = JSON.parse(tc.function.arguments);
        } catch (e) {
          // fall through to content/regex fallback
        }
      }
    }

    // Fallbacks if tool call missing (shouldn’t happen, but safe-guard)
    if (!result) {
      const content =
        choice?.message?.content ??
        choice?.delta?.content ??
        '';
      // Try to extract the first JSON object if any stray text appears
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        const maybeJson = content.slice(firstBrace, lastBrace + 1);
        try {
          result = JSON.parse(maybeJson);
        } catch (_) { /* ignore */ }
      }
    }

    // Final fallback
    if (!result || typeof result !== 'object') {
      result = {
        verdict: 'CANNOT_VERIFY',
        explanation:
          'Unable to produce a structured result. This may be a common internet myth; please consult reliable sources.',
        sources: [],
        formattedResponse:
          '🔍 Unable to verify with structured output. - via fact-checkit.com'
      };
    }

    // Enforce explanation length to 3 short sentences (safety net)
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
