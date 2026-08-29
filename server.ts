import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { getGenAI } from './server/gemini.js';
import {
  decodeWav,
  encode16BitMonoWav,
  resampleAudioBuffer,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  processTtsAudioPayload,
} from './src/utils/audioDsp.js';
import {
  DEFAULT_PHONETIC_RULES,
  applyPhoneticReplacements,
} from './src/utils/phoneticEngine.js';
import { VOCAL_STYLES } from './src/data/styles.js';
import { SampleRate, PhoneticRule } from './src/types.js';

dotenv.config();

function formatGeminiError(error: any): { statusCode: number; message: string; retrySeconds?: number } {
  const errMsg = error?.message || String(error);
  if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota')) {
    const retryMatch = errMsg.match(/retry in ([\d\.]+)s/i) || errMsg.match(/retryDelay["']?:\s*["']?(\d+)s/i);
    const retrySec = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : 30;
    return {
      statusCode: 429,
      message: `Gemini TTS Free Tier rate limit exceeded (10 requests/minute). Please wait ${retrySec}s before generating next clip, or link a billing account in Google AI Studio for pay-as-you-go limits.`,
      retrySeconds: retrySec,
    };
  }
  return {
    statusCode: error?.status || 500,
    message: errMsg || 'Speech synthesis failed. Please verify your API key and connection.',
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON Body Parser with 50MB limit for audio payloads
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API Routes

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasApiKey: Boolean(process.env.GEMINI_API_KEY),
      timestamp: new Date().toISOString(),
    });
  });

  // Single Speaker TTS Synthesis
  app.post('/api/tts/synthesize', async (req, res) => {
    try {
      const {
        text,
        voiceName = 'Kore',
        styleDirectiveId,
        customPromptPrefix,
        sampleRate = 24000,
        phoneticRules,
      } = req.body;

      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'Text prompt is required.' });
      }

      const targetSampleRate: SampleRate = [8000, 16000, 24000].includes(Number(sampleRate))
        ? (Number(sampleRate) as SampleRate)
        : 24000;

      // 1. Apply phonetic replacements
      const rulesToApply: PhoneticRule[] = Array.isArray(phoneticRules)
        ? phoneticRules
        : DEFAULT_PHONETIC_RULES;
      const { transformedText, appliedCount, appliedRules } = applyPhoneticReplacements(
        text,
        rulesToApply
      );

      // 2. Build synthesis prompt with vocal style directive
      let promptText = transformedText;
      if (customPromptPrefix) {
        promptText = `${customPromptPrefix} ${transformedText}`;
      } else if (styleDirectiveId) {
        const style = VOCAL_STYLES.find((s) => s.id === styleDirectiveId);
        if (style && style.promptPrefix) {
          promptText = `${style.promptPrefix}${transformedText}`;
        }
      }

      // 3. Call Gemini API
      const ai = getGenAI();
      let audioBase64: string | null = null;
      let assumedSourceRate = 24000;

      // Try primary requested model gemini-2.5-flash with AUDIO modality
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ parts: [{ text: promptText }] }],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voiceName,
                },
              },
            },
          },
        });

        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData?.data) {
            audioBase64 = part.inlineData.data;
            if (part.inlineData.mimeType?.includes('rate=')) {
              const match = part.inlineData.mimeType.match(/rate=(\d+)/);
              if (match) assumedSourceRate = parseInt(match[1], 10);
            }
            break;
          }
        }
      } catch (err: any) {
        console.warn('gemini-2.5-flash audio attempt error, trying fallback model:', err?.message);
        // Fallback to gemini-3.1-flash-tts-preview if available
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-tts-preview',
          contents: [{ parts: [{ text: promptText }] }],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voiceName,
                },
              },
            },
          },
        });

        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData?.data) {
            audioBase64 = part.inlineData.data;
            break;
          }
        }
      }

      if (!audioBase64) {
        return res.status(502).json({
          error: 'No audio data was generated by the Gemini voice engine. Please check your prompt or try another voice.',
        });
      }

      // 4. Resample and format to target sample rate 16-bit PCM WAV
      const { wavBuffer, durationSeconds } = processTtsAudioPayload(
        audioBase64,
        targetSampleRate,
        assumedSourceRate
      );

      const finalBase64 = arrayBufferToBase64(wavBuffer);

      res.json({
        success: true,
        audioBase64: finalBase64,
        sampleRate: targetSampleRate,
        durationSeconds,
        fileSizeBytes: wavBuffer.byteLength,
        transformedText,
        appliedPhoneticCount: appliedCount,
        appliedRules,
        voiceName,
        styleDirectiveId,
      });
    } catch (error: any) {
      console.error('Error in /api/tts/synthesize:', error);
      const formatted = formatGeminiError(error);
      res.status(formatted.statusCode).json({
        error: formatted.message,
        retrySeconds: formatted.retrySeconds,
      });
    }
  });

  // Multi-Speaker Dialogue Synthesis
  app.post('/api/tts/dialogue', async (req, res) => {
    try {
      const {
        turns,
        sampleRate = 24000,
        phoneticRules,
      } = req.body;

      if (!Array.isArray(turns) || turns.length === 0) {
        return res.status(400).json({ error: 'Dialogue turns are required.' });
      }

      const targetSampleRate: SampleRate = [8000, 16000, 24000].includes(Number(sampleRate))
        ? (Number(sampleRate) as SampleRate)
        : 24000;

      const rulesToApply: PhoneticRule[] = Array.isArray(phoneticRules)
        ? phoneticRules
        : DEFAULT_PHONETIC_RULES;

      const ai = getGenAI();
      const turnAudioSamples: Float32Array[] = [];
      const turnDurations: number[] = [];

      // Synthesize each turn with its designated voice and style directive
      for (const turn of turns) {
        const { speaker, voiceName = 'Kore', styleDirectiveId, text } = turn;
        if (!text || !text.trim()) continue;

        // Apply phonetic transformation
        const { transformedText } = applyPhoneticReplacements(text, rulesToApply);

        let turnPrompt = transformedText;
        if (styleDirectiveId) {
          const style = VOCAL_STYLES.find((s) => s.id === styleDirectiveId);
          if (style && style.promptPrefix) {
            turnPrompt = `${style.promptPrefix}${transformedText}`;
          }
        }

        let rawTurnBase64: string | null = null;
        let sourceRate = 24000;

        try {
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [{ text: turnPrompt }] }],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: voiceName,
                  },
                },
              },
            },
          });

          const parts = response.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            if (part.inlineData?.data) {
              rawTurnBase64 = part.inlineData.data;
              if (part.inlineData.mimeType?.includes('rate=')) {
                const match = part.inlineData.mimeType.match(/rate=(\d+)/);
                if (match) sourceRate = parseInt(match[1], 10);
              }
              break;
            }
          }
        } catch (e) {
          // Try fallback
          const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-tts-preview',
            contents: [{ parts: [{ text: turnPrompt }] }],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: voiceName,
                  },
                },
              },
            },
          });
          const parts = response.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            if (part.inlineData?.data) {
              rawTurnBase64 = part.inlineData.data;
              break;
            }
          }
        }

        if (rawTurnBase64) {
          const rawBuffer = base64ToArrayBuffer(rawTurnBase64);
          let monoSamples: Float32Array;
          const headerCheck = new Uint8Array(rawBuffer.slice(0, 4));
          const isRiff =
            headerCheck[0] === 0x52 &&
            headerCheck[1] === 0x49 &&
            headerCheck[2] === 0x46 &&
            headerCheck[3] === 0x46;

          if (isRiff) {
            const decoded = decodeWav(rawBuffer);
            monoSamples = decoded.monoSamples;
            sourceRate = decoded.sampleRate;
          } else {
            const view = new DataView(rawBuffer);
            const totalSamples = Math.floor(rawBuffer.byteLength / 2);
            monoSamples = new Float32Array(totalSamples);
            for (let i = 0; i < totalSamples; i++) {
              monoSamples[i] = view.getInt16(i * 2, true) / 32768.0;
            }
          }

          // Resample to target sample rate
          const resampled = resampleAudioBuffer(monoSamples, sourceRate, targetSampleRate);
          turnAudioSamples.push(resampled);
          turnDurations.push(resampled.length / targetSampleRate);

          // Add a 200ms natural conversational pause between turns
          const pauseSamples = Math.round(targetSampleRate * 0.2);
          turnAudioSamples.push(new Float32Array(pauseSamples));
        }
      }

      if (turnAudioSamples.length === 0) {
        return res.status(502).json({ error: 'Failed to synthesize dialogue audio.' });
      }

      // Concatenate all turns
      let totalLength = 0;
      for (const s of turnAudioSamples) totalLength += s.length;

      const mergedSamples = new Float32Array(totalLength);
      let writeOffset = 0;
      for (const s of turnAudioSamples) {
        mergedSamples.set(s, writeOffset);
        writeOffset += s.length;
      }

      const wavBuffer = encode16BitMonoWav(mergedSamples, targetSampleRate);
      const audioBase64 = arrayBufferToBase64(wavBuffer);
      const durationSeconds = mergedSamples.length / targetSampleRate;

      res.json({
        success: true,
        audioBase64,
        sampleRate: targetSampleRate,
        durationSeconds,
        fileSizeBytes: wavBuffer.byteLength,
        turnDurations,
      });
    } catch (error: any) {
      console.error('Error in /api/tts/dialogue:', error);
      const formatted = formatGeminiError(error);
      res.status(formatted.statusCode).json({
        error: formatted.message,
        retrySeconds: formatted.retrySeconds,
      });
    }
  });

  // AI Script Assistant
  app.post('/api/tts/script-assist', async (req, res) => {
    try {
      const {
        action, // 'generate' | 'polish' | 'expand' | 'translate' | 'dialogue'
        prompt,
        text,
        targetLanguage = 'Spanish',
        speakerCount = 2,
        topic,
        tone = 'Natural & Engaging',
      } = req.body;

      const ai = getGenAI();

      let systemInstruction =
        'You are an expert voiceover scriptwriter, audio director, and phonetic dialogue specialist. Your scripts are optimized for natural spoken cadence, clear speech pauses, phonetic clarity, and high-impact acoustic delivery. Return clean, polished scripts without unnecessary meta-commentary.';

      let userPrompt = '';

      if (action === 'generate') {
        userPrompt = `Write a voiceover script for: "${prompt || topic}".
Tone: ${tone}.
Target length: approximately 60-120 words.
Make it sound exceptionally natural when spoken aloud, using conversational phrasing and natural pauses.`;
      } else if (action === 'polish') {
        userPrompt = `Polish this text to sound more natural, expressive, and cadence-optimized for AI Voice Synthesis (Text-To-Speech). Keep the original meaning intact but eliminate robotic run-on sentences, improve rhythm, and ensure smooth phonetic transitions:

Original Text:
"${text}"`;
      } else if (action === 'expand') {
        userPrompt = `Expand the following draft into a complete, professional, and engaging voiceover monologue or prompt (around 120-180 words):

Draft:
"${text}"`;
      } else if (action === 'translate') {
        userPrompt = `Translate the following text into natural, idiomatically fluent ${targetLanguage} optimized for spoken voice synthesis:

Text:
"${text}"`;
      } else if (action === 'dialogue') {
        systemInstruction +=
          ' Output a multi-speaker JSON structure with speakers and lines suitable for conversational TTS.';
        userPrompt = `Create a realistic ${speakerCount}-speaker dialogue about: "${prompt || topic}".
Tone: ${tone}.
Return ONLY valid JSON matching this schema:
{
  "title": "Title of Dialogue",
  "turns": [
    {
      "speaker": "Speaker 1 Name",
      "voiceName": "Puck",
      "styleDirectiveId": "natural",
      "text": "Line of speech..."
    },
    {
      "speaker": "Speaker 2 Name",
      "voiceName": "Kore",
      "styleDirectiveId": "cheerful",
      "text": "Response..."
    }
  ]
}`;
      } else {
        userPrompt = `Improve this voiceover script for audio synthesis: "${text || prompt}"`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: userPrompt,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      const generatedText = response.text || '';

      if (action === 'dialogue') {
        try {
          // Extract JSON
          const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return res.json({ success: true, dialogue: parsed });
          }
        } catch {
          // fallback to raw text
        }
      }

      res.json({
        success: true,
        resultText: generatedText.trim(),
      });
    } catch (error: any) {
      console.error('Error in /api/tts/script-assist:', error);
      res.status(500).json({ error: error?.message || 'Script assistant failed.' });
    }
  });

  // Dedicated Audio Resampling Endpoint (Converts any WAV/PCM to 8k, 16k, or 24k)
  app.post('/api/audio/resample', async (req, res) => {
    try {
      const { audioBase64, targetSampleRate = 8000 } = req.body;

      if (!audioBase64) {
        return res.status(400).json({ error: 'audioBase64 is required' });
      }

      const targetRate: SampleRate = [8000, 16000, 24000].includes(Number(targetSampleRate))
        ? (Number(targetSampleRate) as SampleRate)
        : 8000;

      const rawBuffer = base64ToArrayBuffer(audioBase64);
      const decoded = decodeWav(rawBuffer);

      // Resample mono samples
      const resampled = resampleAudioBuffer(decoded.monoSamples, decoded.sampleRate, targetRate);
      const outBuffer = encode16BitMonoWav(resampled, targetRate);
      const resampledBase64 = arrayBufferToBase64(outBuffer);

      res.json({
        success: true,
        targetSampleRate: targetRate,
        resampledBase64,
        resampledSizeBytes: outBuffer.byteLength,
        durationSeconds: resampled.length / targetRate,
        originalMetadata: {
          sampleRate: decoded.sampleRate,
          channels: decoded.channels,
          bitDepth: decoded.bitDepth,
          durationSeconds: decoded.durationSeconds,
          fileSizeBytes: rawBuffer.byteLength,
        },
      });
    } catch (error: any) {
      console.error('Error in /api/audio/resample:', error);
      res.status(500).json({
        error:
          error?.message ||
          'Audio resampling failed. Please ensure the uploaded file is a valid audio format.',
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TTS Studio Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
