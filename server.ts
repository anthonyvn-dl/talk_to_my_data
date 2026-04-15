import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 8080;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
app.use(express.json());

// ✅ Définition des tools Gemini AVANT utilisation
const analyticsTool = {
  name: "query_analytics",
  description: "Query Google Analytics GA4 data for metrics like active users, sessions, page views, etc.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      propertyId: {
        type: Type.STRING,
        description: "The GA4 property ID (numeric, e.g. '123456789')",
      },
      metrics: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "List of GA4 metric names (e.g. ['activeUsers', 'sessions'])",
      },
      dimensions: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "List of GA4 dimension names (e.g. ['date', 'country'])",
      },
      startDate: {
        type: Type.STRING,
        description: "Start date in YYYY-MM-DD format or relative (e.g. '30daysAgo')",
      },
      endDate: {
        type: Type.STRING,
        description: "End date in YYYY-MM-DD format or 'today'",
      },
    },
    required: ["propertyId", "metrics"],
  },
};

const bigQueryTool = {
  name: "query_bigquery",
  description: "Run a SQL query on BigQuery to analyze data.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "The SQL query to run on BigQuery",
      },
      projectId: {
        type: Type.STRING,
        description: "The GCP project ID for BigQuery",
      },
    },
    required: ["query"],
  },
};

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: messages.map((m: any) => ({ role: m.role, parts: m.parts })),
      config: {
        systemInstruction: `You are a helpful data analyst assistant. You help users query and understand their Google Analytics and BigQuery data. Use the available tools to fetch real data when needed.`,
        tools: [{ functionDeclarations: [analyticsTool, bigQueryTool] }],
      },
    });
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const getRedirectUri = () => {
  const appUrl = process.env.APP_URL?.replace(/\/$/, '');
  return `${appUrl}/auth/callback`;
};

const getOAuth2Client = () => {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getRedirectUri()
  );
};

const sessions: Record<string, any> = {};

app.get('/api/auth/url', (req, res) => {
  const client = getOAuth2Client();
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/analytics.readonly',
      'https://www.googleapis.com/auth/analytics.manage.users.readonly'
    ],
    prompt: 'consent'
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
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    res.status(500).send('Authentication failed');
  }
});

app.get('/api/analytics/properties', async (req, res) => {
  const tokens = sessions['default'];
  if (!tokens) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const client = getOAuth2Client();
    client.setCredentials(tokens);
    res.json({ status: 'authenticated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
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
    const analyticsDataClient = new BetaAnalyticsDataClient({
      authClient: client as any,
    });

    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [dateRange || { startDate: '30daysAgo', endDate: 'today' }],
      dimensions: dimensions || [{ name: 'date' }],
      metrics: metrics || [{ name: 'activeUsers' }],
    });

    res.json(response);
  } catch (error: any) {
    console.error('Analytics Query Error:', error);
    const message = error.details || error.message || 'Failed to query analytics';
    res.status(error.code === 3 ? 400 : 500).json({
      error: message,
      details: error.toString()
    });
  }
});

if (process.env.NODE_ENV === 'development') {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
