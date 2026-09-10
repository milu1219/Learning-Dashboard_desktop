const { learningAnalysisSchema, geminiResponseSchema } = require('../schemas/learningAnalysis');

const REQUEST_TIMEOUT_MS = 20_000;

function mockAnalysis(transcript) {
  const excerpt = transcript.trim().replace(/\s+/g, ' ').slice(0, 220);
  return {
    session_title: 'JavaScript Closures and Lexical Scope',
    session_description: 'This session explains how JavaScript closures preserve lexical scope and how to apply them in practice.',
    summary: `This learning session covers: ${excerpt}`,
    topics: [{
      name: 'Key lesson concepts',
      description: 'Review the main ideas and relationships introduced in the transcript.',
      importance: 'high'
    }],
    learning_tasks: [{
      title: 'Review the key lesson concepts',
      description: 'Write a concise set of notes and explain the main concepts in your own words.',
      type: 'review',
      priority: 'high',
      estimated_minutes: 30
    }]
  };
}

async function analyzeTranscript(transcript, { fetchImpl = fetch } = {}) {
  if (process.env.MOCK_EXTERNAL_APIS === 'true') {
    return learningAnalysisSchema.parse(mockAnalysis(transcript));
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const error = new Error('GEMINI_API_KEY is not configured.');
    error.code = 'GEMINI_NOT_CONFIGURED';
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  try {
    const response = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Analyze this learning transcript. Return only the requested structured analysis. Generate a concise, specific session_title and a one- or two-sentence session_description from the actual transcript. Never use generic titles such as "Learning Session", "Lesson", or "Key Lesson Concepts".\n\nTranscript:\n${transcript}` }] }],
          generationConfig: { responseMimeType: 'application/json', responseSchema: geminiResponseSchema }
        })
      }
    );
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      const error = new Error(`Gemini request failed (${response.status}).`);
      error.code = 'GEMINI_REQUEST_FAILED';
      error.detail = detail.slice(0, 500);
      throw error;
    }
    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      const error = new Error('Gemini returned no structured content.');
      error.code = 'GEMINI_INVALID_RESPONSE';
      throw error;
    }
    return learningAnalysisSchema.parse(JSON.parse(text));
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('Gemini request timed out.');
      timeoutError.code = 'GEMINI_TIMEOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { analyzeTranscript };
