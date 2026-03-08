// SolvAI — Netlify Serverless Function (Groq)
// Place at: netlify/functions/chat.js
// Set GROQ_API_KEY in Netlify → Site configuration → Environment variables

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const SYSTEM = `You are SolvAI, a sharp and knowledgeable AI assistant. Be concise, direct, and genuinely helpful. Use markdown (bold, code blocks) where appropriate. Never hedge unnecessarily — give real, actionable answers. You excel at finance, coding, health, science, productivity, and career topics.`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let messages;
  try {
    const body = JSON.parse(event.body || '{}');
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) throw new Error('Invalid messages');
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  const API_KEY = process.env.GROQ_API_KEY;
  if (!API_KEY) {
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        response: '⚠️ **Setup required:** Add `GROQ_API_KEY` in your Netlify dashboard under **Site configuration → Environment variables**, then redeploy.',
      }),
    };
  }

  const groqMessages = [
    { role: 'system', content: SYSTEM },
    ...messages
      .filter(m => m && m.role && typeof m.content === 'string' && m.content.trim())
      .map(m => ({ role: m.role, content: m.content.trim() }))
  ];

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Groq API error ${res.status}: ${txt.slice(0, 200)}`);
    }

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    const reply = data.choices?.[0]?.message?.content?.trim() || 'No response received. Please try again.';

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ response: reply }) };
  } catch (err) {
    console.error('SolvAI error:', err.message);
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ response: `**Error:** ${err.message}` }),
    };
  }
};
