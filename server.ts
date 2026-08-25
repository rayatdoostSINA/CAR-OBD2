import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // AI Mechanic API endpoint using Gemini API
  app.post('/api/ai-mechanic', async (req, res) => {
    try {
      const { codes, vehicle, telemetry, language } = req.body;
      const isFa = language === 'fa';

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        // Return structured offline fallback if no API key is set
        const codesStr = (codes && codes.length > 0) ? codes.join(', ') : 'P0420';
        return res.json({
          analysis: isFa
            ? `تحلیل تشخیصی آفلاین برای کدهای (${codesStr}) در خودروی ${vehicle}:\n• بررسی سلامت سنسور اکسیژن بالا و پایین دست، اطمینان از عدم نشتی منیفولد اگزوز.\n• بررسی فشار ریل سوخت، سلامت سوزن انژکتورها و عدم ورود هوای دزدی به منیفولد هوا.\n• مقادیر لایو: دمای آب ${telemetry?.ect || 90}°C و ولتاژ ${telemetry?.voltage || 14.2}V در شرایط پایدار هستند.`
            : `Offline Diagnostic Analysis for (${codesStr}) on ${vehicle}:\n• Inspect upstream and downstream O2 sensor switching voltages.\n• Check for unmetered air leaks in the intake tract and measure fuel rail delivery pressure.\n• Live parameters indicate coolant at ${telemetry?.ect || 90}°C and alternator output at ${telemetry?.voltage || 14.2}V.`
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are a master automotive diagnostic technician and OBD-II expert specializing in Asian, European, Iranian (Iran Khodro, SAIPA), and Chinese (Chery/MVM, JAC/KMC) vehicles.
The user has scanned the following DTC codes: ${JSON.stringify(codes)} on their vehicle: "${vehicle}".
Live Telemetry at time of scan:
${JSON.stringify(telemetry, null, 2)}

Provide a concise, practical, step-by-step diagnostic inspection guide in ${isFa ? 'Persian (Farsi)' : 'English'}.
Keep it directly actionable for a car owner / technician (mentioning potential causes, what live sensor values to check first, and common failure points for this specific vehicle model).`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      res.json({ analysis: response.text });
    } catch (err: unknown) {
      console.error('AI Mechanic error:', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to generate diagnosis';
      res.status(500).json({ error: errMsg });
    }
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', name: 'MultiGauge OBD Universal' });
  });

  // Vite middleware for development or static serving for production
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
    console.log(`MultiGauge OBD Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
