export default async (request) => {
  const { answers } = await request.json();
  const apiKey = process.env.GEMINI_API_KEY;

  const prompt = `Based on these quiz answers, recommend a real album that fits this person's vibe. Be creative — pick something genuine but potentially unexpected.

Quiz answers:
1. Mood: ${answers[0]}
2. Political orientation: ${answers[1]}
3. Preferred tempo: ${answers[2]}
4. View on the Catholic Church: ${answers[3]}
5. Shoe size: ${answers[4]}
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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  const data = await response.json();

  if (!data.candidates || !data.candidates[0]) {
    return new Response(JSON.stringify({ error: 'Gemini error', details: data }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const text = data.candidates[0].content.parts[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const result = JSON.parse(jsonMatch[0]);

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = {
  path: '/api/generate-bop',
};