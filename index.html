// api/fact-check.js

// --- Your prompt template (unchanged) ---
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

    // Messages using your exact template + strict formatting nudge
    const messages = [
      {
        role: 'system',
        content:
          `You are a precise myth-busting assistant. Follow the user's format EXACTLY.
Return ONLY the formatted text requested (no JSON, no extra commentary, no prefixes, no suffixes).
Ensure exactly 3 concise sentences in the summary and list 2–3 sources in markdown list form "- [Name](URL)".`
      },
      { role: 'user', content: promptTemplate(claim) }
    ];

    const body = {
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 500,
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
    const content = stripCodeFences(raw).trim();

    // Find the "Sources:" divider (case-insensitive; tolerate spaces/colon)
    const { summaryBlock, sourcesBlock } = splitSummaryAndSources(content);

    // Summary should be a single paragraph (we enforce ≤3 sentences)
    const summary = (summaryBlock || '').replace(/^\[|\]$/g, '').trim();
    const cleanSummary = enforceThreeSentences(summary);

    // Parse sources (markdown links, or fallback to raw URLs)
    const parsedSources = parseSources(sourcesBlock);
    const cleanSources = parsedSources.slice(0, 3);

    // If model totally ignored the format, keep things non-empty
    const finalSummary =
      cleanSummary ||
      'This claim is frequently misstated online; consult credible sources for the correct context.';

    return res.status(200).json({
      success: true,
      summary: finalSummary,
      explanation: finalSummary, // 👈 alias for your existing frontend
      sources: cleanSources
    });
  } catch (err) {
    console.error('Fact-check error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fact-check. Please try again.' });
  }
}

/* ---------------------------- helpers ---------------------------- */

function stripCodeFences(text) {
  if (!text) return '';
  // Remove leading/trailing triple backtick blocks if present
  return text.replace(/^\s*```[\s\S]*?\n?|\n?```$/g, '');
}

function splitSummaryAndSources(content) {
  if (!content) return { summaryBlock: '', sourcesBlock: '' };

  // Try to split on a standalone "Sources:" line (case-insensitive)
  const rx = /\n\s*Sources\s*:?\s*\n/i;
  if (rx.test(content)) {
    const [summaryBlock, ...rest] = content.split(rx);
    return { summaryBlock, sourcesBlock: rest.join('\n').trim() };
  }

  // Fallback: try to detect the first markdown link list line as start of sources
  const lines = content.split('\n');
  const idx = lines.findIndex((l) => /^\s*(?:[-*]|\d+\.)\s*\[.+\]\(https?:\/\/[^\s)]+\)/i.test(l));
  if (idx !== -1) {
    const summaryBlock = lines.slice(0, idx).join('\n');
    const sourcesBlock = lines.slice(idx).join('\n');
    return { summaryBlock, sourcesBlock };
  }

  // No divider found
  return { summaryBlock: content, sourcesBlock: '' };
}

function parseSources(sourcesBlock) {
  const out = [];
  if (!sourcesBlock) return out;

  const lines = sourcesBlock.split('\n').map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    // 1) Proper markdown list with link: - [Title](https://url)
    let m = line.match(/^(?:[-*]|\d+\.)\s*\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/i);
    if (m) {
      out.push({ title: m[1].trim(), url: m[2].trim() });
      continue;
    }

    // 2) Inline markdown link with no leading list bullet: [Title](https://url)
    m = line.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/i);
    if (m) {
      out.push({ title: m[1].trim(), url: m[2].trim() });
      continue;
    }

    // 3) Raw URL present somewhere on the line -> use hostname as title
    m = line.match(/https?:\/\/[^\s)]+/i);
    if (m) {
      const url = m[0].trim();
      const title = line.replace(url, '').trim() || hostFromUrl(url);
      out.push({ title: title || hostFromUrl(url), url });
      continue;
    }

    // 4) Last resort: treat the entire line as a title with no URL (skip anchor creation in UI)
    if (line) {
      out.push({ title: line, url: '' });
    }
  }

  // Deduplicate by URL (if present)
  const seen = new Set();
  return out.filter((s) => {
    const key = s.url || `title:${s.title.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hostFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Ensure at most 3 short sentences (your template requires exactly 3; if more, we trim).
 */
function enforceThreeSentences(text) {
  if (!text || typeof text !== 'string') return '';
  const normalized = text.replace(/\s+/g, ' ').trim();
  // Split on sentence-ending periods followed by space; simple & effective for short copy
  const parts = normalized.split(/(?<=\.)\s+/);
  if (parts.length <= 3) return normalized;
  return parts.slice(0, 3).join(' ');
}
