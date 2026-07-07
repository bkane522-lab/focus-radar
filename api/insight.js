module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { entries = [], score = {} } = req.body || {};

    const summary = entries.slice(0, 40).map(e => {
      const d = new Date(e.ts);
      return `${d.toLocaleDateString('fr-FR')} ${d.getHours()}h - ${e.cat} (${e.min}min) humeur:${e.mood}${e.note ? ' note:'+e.note : ''}`;
    }).join('\n');

    const prompt = `Tu es un assistant qui analyse les habitudes de concentration d'un utilisateur pour l'app "Focus Radar".
Voici ses entrées récentes (catégorie, durée, humeur, note) :
${summary || 'Aucune entrée.'}

Score de focus du jour: ${score.score ?? 'inconnu'}/100, ${score.distractions ?? 0} distractions, ${score.deepBlocks ?? 0} blocs de travail profond.

Analyse ces données et détecte UN motif concret (horaire de distraction, lien humeur/focus, type de tâche qui distrait, etc.).
Réponds UNIQUEMENT en JSON strict, sans markdown, sans texte autour, au format exact :
{"title": "Motif détecté : ...", "body": "Phrase courte et actionnable en français, 1-2 phrases max."}`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        max_tokens: 200
      })
    });

    const data = await groqRes.json();
    let text = data?.choices?.[0]?.message?.content?.trim() || '';
    text = text.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      parsed = { title: 'Motif détecté', body: text.slice(0, 180) };
    }

    res.status(200).json(parsed);
  } catch (err) {
    res.status(200).json({
      title: 'Analyse indisponible',
      body: "L'IA n'a pas pu analyser tes données pour le moment. Réessaie plus tard."
    });
  }
};
