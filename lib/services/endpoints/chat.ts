interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  type: 'text' | 'image';
}

interface ChatRequest {
  messages: ChatMessage[];
}

interface ChatResponse {
  response: string;
}

export async function sendChatMessage(messages: ChatMessage[]): Promise<ChatResponse> {
  // Ensure messages have only the exact fields expected by the backend
  const formattedMessages = messages.map(msg => ({
    role: msg.role,
    content: msg.content,
    type: msg.type || 'text'  // Ensure type defaults to 'text' if missing
  }));

  const chatRequest: ChatRequest = {
    messages: formattedMessages
  };

  console.log('Sending chat request:', JSON.stringify(chatRequest, null, 2));


  const response = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(chatRequest),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Chat API error:', errorText);
    console.error('Request that caused error:', JSON.stringify(chatRequest, null, 2));
    throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
  }

  return response.json();
}
