import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { BigQuery } from '@google-cloud/bigquery';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyticsTool, bigQueryTool } from './src/services/geminiService.js';
import { GoogleGenAI } from '@google/genai';

// ─── Init ────────────────────────────────────────────────────────────────────

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 3000;
const ai   = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.use(express.json());

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getRedirectUri = () => {
  const appUrl = process.env.APP_URL?.replace(/\/$/, '');
  return `${appUrl}/auth/callback`;
};

const getOAuth2Client = () =>
  new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getRedirectUri()
  );

// In-memory session storage — replace with a real store in production
const sessions: Record<string, any> = {};

// ─── Chat ────────────────────────────────────────────────────────────────────

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: messages.map((m: any) => ({ role: m.role, parts: m.parts })),
      config: {
        systemInstruction: `You are an expert data analyst specializing in Google Analytics and BigQuery.
You help users understand their data by querying GA4 and BigQuery.

Use the query_google_analytics tool for GA4 data.
Use the query_bigquery tool for BigQuery data.

When you present data, you MUST provide a JSON block at the end of your response if the data can be visualized.
The JSON block should follow this format:
\`\`\`json
{
  "type": "table" | "lineChart" | "barChart" | "pieChart",
  "title": "Descriptive Title",
  "data": [
    { "label": "Jan", "value": 100 }
  ],
  "xAxis": "label",
  "yAxis": "value",
  "series": ["value"]
}
\`\`\`
CRITICAL: All values in the "data" array that are meant to be plotted MUST be numbers, not strings.
Always explain the data clearly and suggest insights.`,
        tools: [{ functionDeclarations: [analyticsTool, bigQueryTool] }],
      },
    });

    res.json(response);
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

app.get('/api/auth/url', (req, res) => {
  const client = getOAuth2Client();
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/analytics.readonly',
      'https://www.googleapis.com/auth/analytics.manage.users.readonly',
    ],
    prompt: 'consent',
  });
  res.json({ url });
});

app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
  const { code } = req.query;
  try {
    const client = getOAuth2Client();
    const { tokens } = await client.getToken(code as string);
    sessions['default'] = tokens;

    res.send(`
      <html><body><script>
        if (window.opener) {
          window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
          window.close();
        } else {
          window.location.href = '/';
        }
      </script><p>Authentication successful. This window should close automatically.</p></body></html>
    `);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('Authentication failed');
  }
});

// ─── Analytics ───────────────────────────────────────────────────────────────

app.get('/api/analytics/properties', async (req, res) => {
  const tokens = sessions['default'];
  if (!tokens) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ status: 'authenticated' });
});

app.post('/api/analytics/query', async (req, res) => {
  const tokens = sessions['default'];
  if (!tokens) return res.status(401).json({ error: 'Not authenticated' });

  let { propertyId, dateRange, metrics, dimensions } = req.body;
  if (!propertyId) return res.status(400).json({ error: 'Property ID is required' });

  propertyId = propertyId.toString().replace(/^properties\//, '');

  try {
    const client = getOAuth2Client();
    client.setCredentials(tokens);

    const analyticsDataClient = new BetaAnalyticsDataClient({ authClient: client as any });
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [dateRange || { startDate: '30daysAgo', endDate: 'today' }],
      dimensions: dimensions || [{ name: 'date' }],
      metrics: metrics || [{ name: 'activeUsers' }],
    });

    res.json(response);
  } catch (error: any) {
    console.error('Analytics query error:', error);
    const message = error.details || error.message || 'Failed to query analytics';
    res.status(error.code === 3 ? 400 : 500).json({ error: message, details: error.toString() });
  }
});

// ─── BigQuery ────────────────────────────────────────────────────────────────

app.post('/api/bigquery/query', async (req, res) => {
  const { query, projectId } = req.body;
  if (!query) return res.status(400).json({ error: 'Query is required' });

  try {
    const bigquery = new BigQuery({ projectId: projectId || process.env.GCP_PROJECT_ID });
    const [rows] = await bigquery.query({ query });
    res.json({ rows });
  } catch (error: any) {
    console.error('BigQuery error:', error);
    res.status(500).json({ error: error.message, details: error.toString() });
  }
});

// ─── Static (production) ─────────────────────────────────────────────────────

if (process.env.NODE_ENV === 'development') {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist/index.html'));
  });
}

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
