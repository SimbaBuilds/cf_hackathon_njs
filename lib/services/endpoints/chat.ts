interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  type: 'text' | 'image';
}

interface ChatRequest {
  messages: ChatMessage[];
  provider?: string;
  model?: string;
}

interface ChatResponse {
  response: string;
}

export async function sendChatMessage(messages: ChatMessage[]): Promise<ChatResponse> {
  const chatRequest: ChatRequest = {
    messages: messages.map(msg => ({
      ...msg,
      type: 'text' // Default to text type since that's what we're handling
    })),
    provider: 'openai', // Using the default from Python
    model: 'gpt-4o'    // Using the default from Python
  };

  const response = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(chatRequest),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}
