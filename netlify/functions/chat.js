// SolvAI — Netlify Serverless Function
// Place at: netlify/functions/chat.js
// Set GEMINI_API_KEY in Netlify → Site configuration → Environment variables

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const SYSTEM = `You are SolvAI, a sharp and knowledgeable AI assistant. Be concise, direct, and genuinely helpful. Use markdown (bold, code blocks) where appropriate. Never hedge unnecessarily — give real, actionable answers. You excel at finance, coding, health, science, productivity, and career topics.`;

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Parse body
  let messages;
  try {
    const body = JSON.parse(event.body || '{}');
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) throw new Error('Invalid messages');
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  // Check API key
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        response: '⚠️ **Setup required:** Add `GEMINI_API_KEY` in your Netlify dashboard under **Site configuration → Environment variables**, then redeploy.',
      }),
    };
  }

  // Build Gemini contents array — must alternate user/model, start with user
  const contents = messages
    .filter(m => m && m.role && typeof m.content === 'string' && m.content.trim())
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content.trim() }],
    }));

  if (contents.length === 0 || contents[0].role !== 'user') {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Conversation must start with user message' }) };
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents,
          generationConfig: { temperature: 0.8, maxOutputTokens: 2048 },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
          ],
        }),
      }
    );

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${txt.slice(0, 200)}`);
    }

    const data = await res.json();

    if (data.error) throw new Error(data.error.message);

    const reply =
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      'No response received. Please try again.';

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
