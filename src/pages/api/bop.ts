// Server-side endpoint for the Bop Generator 3000.
// This runs on the server (Netlify function), so the Groq API key
// never reaches the browser. The client calls this endpoint instead
// of talking to Groq directly.
export const prerender = false;

import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  let answers: string[];
  try {
    const body = await request.json();
    answers = body.answers;
    if (!Array.isArray(answers) || answers.length !== 10) {
      throw new Error('Expected an "answers" array with 10 entries.');
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid request body.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = import.meta.env.GROQ_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Server is missing GROQ_API_KEY. Add it to your environment variables.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const prompt = `Based on these quiz answers, recommend a real album that fits this person's vibe. Be creative — pick something genuine but potentially unexpected.

Quiz answers:
1. Mood: ${answers[0]}
2. Political orientation: ${answers[1]}
3. Preferred tempo: ${answers[2]}
4. Noise or quite: ${answers[3]}
5. Mountains or beaches: ${answers[4]}
6. Personality: ${answers[5]}
7. Quantum gravity stance: ${answers[6]}
8. City or countryside: ${answers[7]}
9. Self-description: ${answers[8]}
10. Unique or generic: ${answers[9]}

Respond ONLY with a JSON object, no extra text:
{
  "albumTitle": "...",
  "artist": "...",
  "year": "...",
  "description": "2-3 sentences. Quirky, funny, slightly absurdist. Written like an oracle who takes this quiz extremely seriously."
}`;

  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
      }),
    });

    if (!groqResponse.ok) {
      const errBody = await groqResponse.text();
      console.error(`[bop] Groq API responded with ${groqResponse.status}:`, errBody);
      throw new Error(`Groq API responded with ${groqResponse.status}`);
    }

    const data = await groqResponse.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      console.error('[bop] Unexpected Groq response shape:', JSON.stringify(data));
      throw new Error('No content in model response.');
    }
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[bop] Could not find JSON in model output:', text);
      throw new Error('Could not parse album recommendation from model response.');
    }
    const result = JSON.parse(jsonMatch[0]);

    let coverUrl = '';
    try {
      const itunes = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(result.artist + ' ' + result.albumTitle)}&entity=album&limit=1`
      );
      const itunesData = await itunes.json();
      if (itunesData.results?.length > 0) {
        coverUrl = itunesData.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
      }
    } catch (e) {
      // cover art is a nice-to-have; ignore failures
    }

    return new Response(JSON.stringify({ ...result, coverUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[bop] Request failed:', e);
    return new Response(JSON.stringify({ error: 'The oracle is silent. Try again.' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
