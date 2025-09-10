// api/fact-check.js

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

    const messages = [
      {
        role: 'system',
        content: `You are a precise myth-busting assistant. Follow the user's format EXACTLY.
Return ONLY the formatted text requested (no JSON, no extra commentary, no prefixes, no suffixes).
Ensure exactly 3 concise sentences in the summary.

SOURCES RULES:
- Always include 2–3 working source links.
- Sources must be taken from the References/External Links section of Wikipedia articles (use those outbound links, not the Wikipedia page itself).
- If no suitable Wikipedia references exist, fall back to stable links from patents, academic journals, or major newspapers.
- Never return a bare Wikipedia article URL as a source.`
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
    const content = stripOuterCodeFences(raw);

    const { summaryBlock, sourcesBlock } = splitSummaryAndSources(content);
    const summary = (summaryBlock || '').replace(/^\[|\]$/g, '').trim();
    const cleanSummary = enforceThreeSentences(summary);

    const parsedSources = parseSources(sourcesBlock).filter(s => s.url);
    let cleanSources = parsedSources.slice(0, 3);

    // --- Fallback if no sources found ---
    if (cleanSources.length === 0) {
      const wikiSlug = encodeURIComponent(claim.split(' ').slice(0, 4).join('_'));
      cleanSources = [
        {
          title: 'Source retrieval failed — see Wikipedia for more info',
          url: `https://en.wikipedia.org/wiki/${wikiSlug}`
        }
      ];
    }

    const finalSummary =
      cleanSummary ||
      'This claim is often misstated online; consult reliable sources for the correct context.';

    return res.status(200).json({
      success: true,
      summary: finalSummary,
      explanation: finalSummary, // alias for frontend
      sources: cleanSources
    });
  } catch (err) {
    console.error('Fact-check error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fact-check. Please try again.' });
  }
}

/* ---------------- helpers ---------------- */

function stripOuterCodeFences(text) {
  if (!text) return '';
  const trimmed = String(text).trim();
  if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
    return trimmed.slice(3, -3).trim();
  }
  return trimmed;
}

function splitSummaryAndSources(content) {
  if (!content) return { summaryBlock: '', sourcesBlock: '' };
  const headerRx = /\n\s*(Sources|References)\s*:?\s*\n/i;
  if (headerRx.test(content)) {
    const [summaryBlock, ...rest] = content.split(headerRx);
    const tail = rest.slice(1).join('');
    return { summaryBlock: (summaryBlock || '').trim(), sourcesBlock: tail.trim() };
  }
  const lines = content.split('\n');
  const idx = lines.findIndex((l) =>
    /\[.+\]\(https?:\/\/[^\s)]+\)/i.test(l)
  );
  if (idx !== -1) {
    return { summaryBlock: lines.slice(0, idx).join('\n'), sourcesBlock: lines.slice(idx).join('\n') };
  }
  return { summaryBlock: content.trim(), sourcesBlock: '' };
}

function parseSources(sourcesBlock) {
  const out = [];
  if (!sourcesBlock) return out;
  const lines = sourcesBlock.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    let m = line.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/i);
    if (m) {
      out.push({ title: m[1].trim(), url: m[2].trim() });
      continue;
    }
    m = line.match(/https?:\/\/[^\s)]+/i);
    if (m) {
      const url = m[0].trim();
      out.push({ title: hostFromUrl(url), url });
    }
  }
  const seen = new Set();
  return out.filter(s => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}

function hostFromUrl(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}

function enforceThreeSentences(text) {
  if (!text) return '';
  const normalized = text.replace(/\s+/g, ' ').trim();
  const parts = normalized.split(/(?<=\.)\s+/);
  return parts.length > 3 ? parts.slice(0, 3).join(' ') : normalized;
}
