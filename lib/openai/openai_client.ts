'use server';

import OpenAI from 'openai';

// Debug logging
console.log('API Key length:', process.env.OPENAI_API_KEY?.length);
console.log('API Key prefix:', process.env.OPENAI_API_KEY?.substring(0, 10));
console.log('API Key full:', process.env.OPENAI_API_KEY);

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not set in environment variables');
}

// Verify the API key format
const apiKey = process.env.OPENAI_API_KEY.trim();
if (!apiKey.startsWith('sk-proj-')) {
  throw new Error('Invalid API key format. API key should start with "sk-proj-"');
}

export async function getOpenAIClient() {
  const client = new OpenAI({
    apiKey: apiKey
  });
  
  // Test the client with a simple request
  try {
    await client.models.list();
    console.log('OpenAI client initialized successfully');
  } catch (error) {
    console.error('OpenAI client initialization failed:', error);
    throw error;
  }
  
  return client;
}
