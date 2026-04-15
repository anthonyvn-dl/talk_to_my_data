export async function getChatResponse(messages: any[]) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (!response.ok) throw new Error('Chat request failed');
  return response.json();
}

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

export async function getChatResponse(messages: { role: 'user' | 'model' | 'system', parts: { text: string }[] }[]) {
  const model = "gemini-3-flash-preview";
  
  const response = await ai.models.generateContent({
    model,
    contents: messages.map(m => ({ role: m.role, parts: m.parts })),
    config: {
      systemInstruction: `You are an expert data analyst specializing in Google Analytics and BigQuery. 
      You help users understand their data by querying GA4 and BigQuery.
      
      Use the query_google_analytics tool for GA4 data.
      Use the query_bigquery tool for BigQuery data.
      
      When you present data, you MUST provide a JSON block at the end of your response if the data can be visualized (tables, charts, etc.). 
      Even for simple lists of data, use the "table" type in the JSON block to ensure it's rendered in a clean, readable UI component.
      
      The JSON block should follow this format:
      \`\`\`json
      {
        "type": "table" | "lineChart" | "barChart" | "pieChart",
        "title": "Descriptive Title",
        "data": [
          { "label": "Jan", "value": 100, "secondary": 50 },
          ...
        ],
        "xAxis": "label",
        "yAxis": "value",
        "series": ["value", "secondary"]
      }
      \`\`\`
      CRITICAL: All values in the "data" array that are meant to be plotted on a chart MUST be numbers, not strings.
      Always explain the data clearly and suggest insights. Avoid using markdown tables if you can use the JSON visualization block instead.`,
      tools: [{ functionDeclarations: [analyticsTool, bigQueryTool] }],
    },
  });

  return response;
}
