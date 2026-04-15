import { GoogleGenAI, Type } from "@google/genai";
 
// Instancié au niveau module : GEMINI_API_KEY doit être défini via vite.config.ts (define)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
 
export const analyticsTool = {
  name: "query_google_analytics",
  parameters: {
    type: Type.OBJECT,
    description: "Query Google Analytics 4 data for a specific property.",
    properties: {
      propertyId: {
        type: Type.STRING,
        description: "The GA4 Property ID (e.g., '123456789').",
      },
      metrics: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Metric name, e.g., 'activeUsers', 'sessions', 'eventCount'." }
          }
        },
        description: "List of metrics to fetch.",
      },
      dimensions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Dimension name, e.g., 'date', 'city', 'deviceCategory'." }
          }
        },
        description: "List of dimensions to group by.",
      },
      dateRange: {
        type: Type.OBJECT,
        properties: {
          startDate: { type: Type.STRING, description: "Start date (e.g., '2023-01-01' or '30daysAgo')." },
          endDate: { type: Type.STRING, description: "End date (e.g., 'today')." }
        },
        description: "The date range for the report.",
      }
    },
    required: ["propertyId"],
  },
};
 
export const bigQueryTool = {
  name: "query_bigquery",
  parameters: {
    type: Type.OBJECT,
    description: "Execute a SQL query against Google BigQuery.",
    properties: {
      query: {
        type: Type.STRING,
        description: "The SQL query to execute.",
      },
      projectId: {
        type: Type.STRING,
        description: "Optional Google Cloud Project ID. If not provided, the default project will be used.",
      }
    },
    required: ["query"],
  },
};
 
export async function runAnalyticsQuery(args: any) {
  const response = await fetch('/api/analytics/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to query analytics');
  }
  return data;
}
 
export async function runBigQuery(args: any) {
  const response = await fetch('/api/bigquery/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to query BigQuery');
  }
  return data;
}
 
export async function getChatResponse(messages: any[]) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (!response.ok) throw new Error('Chat request failed');
  return response.json();
}
 
