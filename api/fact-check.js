// api/fact-check.js

// --- Prompt template (your spec) ---
const promptTemplate = (CLAIM) => `
Bust the myth or clarify the claim: "${CLAIM}"

Instructions:
- Write a concise, 3-sentence summary that corrects or clarifies the claim.
- Clearly state what is factually wrong, misleading, or misunderstood and why.
- List 2–3 credible sources with direct links.

Format your response as:
[Myth-busting summary]

Sources:
- [Source 1 Name](Source 1 URL)
- [Source 2 Name](Source 2 URL)
`;

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

    // Build messages using your template and a strict system nudge to keep formatting exact
    const messages = [
      {
        role: 'system',
        content:
          `You are a precise myth-busting assistant. Follow the user's format EXACTLY.
Return ONLY the formatted text requested (no JSON, no extra commentary, no prefixes, no suffixes).
Ensure exactly 3 concise sentences in the summary and list 2–3 sources in markdown list form "[Name](URL)".`
      },
      { role: 'user', content: promptTemplate(claim) }
    ];

    const body = {
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 500,
      // We want plain text (markdown) so we can parse it per the template
      messages
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
    const raw = data?.choices?.[0]?.message?.content ?? '';

    // --- Parse the model output per your required format ---
    // Strip code fences if any
    const content = raw.replace(/^\s*```[\s\S]*?\n?|\n?```$/g, '').trim();

    // Split at the "Sources:" header (case-insensitive, allow variants like "Sources" with trailing colon)
    const split = content.split(/\n\s*Sources\s*:\s*\n/i);
    const summaryBlock = split[0]?.trim() || '';
    const sourcesBlock = split[1]?.trim() || '';

    // The summary is the first paragraph (per your spec it's a single 3-sentence paragraph)
    const summary = summaryBlock
      // Remove any accidental leading/trailing brackets lines
      .replace(/^\[|\]$/g, '')
      .trim();

    // Parse markdown links like: - [Title](https://url)
    const sources = [];
    if (sourcesBlock) {
      const lines = sourcesBlock.split('\n').map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        const m = line.match(/^-+\s*\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/i);
        if (m) {
          sources.push({ title: m[1].trim(), url: m[2].trim() });
        }
      }
    }

    // Safety nets
    const cleanSummary = enforceThreeSentences(summary);
    const cleanSources = sources.slice(0, 3); // keep 2–3; if more, trim

    return res.status(200).json({
      success: true,
      summary: cleanSummary,
      sources: cleanSources
    });
  } catch (err) {
    console.error('Fact-check error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fact-check. Please try again.' });
  }
}

/**
 * Ensure at most 3 short sentences (your template requires exactly 3;
 * if the model gives more, we trim; if fewer, we return as-is).
 */
function enforceThreeSentences(text) {
  if (!text || typeof text !== 'string') return '';
  const normalized = text.replace(/\s+/g, ' ').trim();
  const parts = normalized.split(/(?<=\.)\s+/); // split by sentence-ending periods
  if (parts.length <= 3) return normalized;
  return parts.slice(0, 3).join(' ');
}
