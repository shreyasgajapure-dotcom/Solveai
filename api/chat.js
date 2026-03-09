// SolvAI — Vercel Serverless Function (Groq)
// Place at: api/chat.js

const SYSTEM = `You are SolvAI, a sharp and knowledgeable AI assistant. Be concise, direct, and genuinely helpful. Use markdown (bold, code blocks) where appropriate. Never hedge unnecessarily — give real, actionable answers. You excel at finance, coding, health, science, productivity, and career topics.`;

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let messages;
  try {
    messages = req.body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) throw new Error('Invalid messages');
  } catch {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const API_KEY = process.env.GROQ_API_KEY;
  if (!API_KEY) {
    return res.status(200).json({
      response: '⚠️ **Setup required:** Add `GROQ_API_KEY` in your Vercel dashboard under **Settings → Environment Variables**, then redeploy.',
    });
  }

  const groqMessages = [
    { role: 'system', content: SYSTEM },
    ...messages
      .filter(m => m && m.role && typeof m.content === 'string' && m.content.trim())
      .map(m => ({ role: m.role, content: m.content.trim() }))
  ];

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: groqMessages,
        temperature: 0.8,
        max_tokens: 2048,
      }),
    });

    if (!groqRes.ok) {
      const txt = await groqRes.text();
      throw new Error(`Groq API error ${groqRes.status}: ${txt.slice(0, 200)}`);
    }

    const data = await groqRes.json();
    if (data.error) throw new Error(data.error.message);

    const reply = data.choices?.[0]?.message?.content?.trim() || 'No response received. Please try again.';
    return res.status(200).json({ response: reply });

  } catch (err) {
    console.error('SolvAI error:', err.message);
    return res.status(200).json({ response: `**Error:** ${err.message}` });
  }
}
