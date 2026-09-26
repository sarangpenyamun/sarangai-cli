import { getConfig } from '../config';
import { CodingModel } from '../constants';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamOptions {
  model: CodingModel;
  messages: ChatMessage[];
  /**
   * Dipanggil untuk setiap potongan reasoning (delta.reasoning_content /
   * delta.reasoning). Pemanggil WAJIB tidak mencetaknya ke terminal.
   */
  onReasoningProgress?: (thoughtSnippet: string) => void;
  /** Dipanggil untuk setiap potongan jawaban resmi (delta.content). */
  onContentToken?: (token: string) => void;
  /** Signal untuk membatalkan stream (mis. saat TUI ditutup). */
  signal?: AbortSignal;
}

export async function streamChatCompletion({
  model,
  messages,
  onReasoningProgress,
  onContentToken,
  signal,
}: StreamOptions): Promise<string> {
  const config = getConfig();
  const apiKey = config.apiKey || process.env.SARANGAI_API_KEY;

  if (!apiKey) {
    throw new Error('API Key is not configured in ~/.sarangairc');
  }

  const baseUrl = config.baseUrl || 'https://sarangai.id';
  const url = `${baseUrl.replace(/\/+$/, '')}/api/gateway/v1/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model.id,
      messages,
      stream: true,
      max_tokens: model.maxTokens || 4096,
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Gateway HTTP ${response.status}`;
    try {
      const errJson = JSON.parse(errorText);
      if (errJson.error?.message) {
        errorMessage += `: ${errJson.error.message}`;
      } else if (errJson.message) {
        errorMessage += `: ${errJson.message}`;
      }
    } catch {
      if (errorText) errorMessage += `: ${errorText.slice(0, 200)}`;
    }
    throw new Error(errorMessage);
  }

  if (!response.body) {
    throw new Error('Empty response body from gateway.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let fullOutput = '';
  let fullReasoning = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith(':')) continue;

      if (line.startsWith('data:')) {
        // Bekerja untuk "data: {...}" maupun "data:{...}".
        const payload = line.slice(5).trim();

        if (payload === '[DONE]' || payload.includes('[DONE]')) {
          return fullOutput;
        }

        try {
          const parsed = JSON.parse(payload);
          const delta = parsed.choices?.[0]?.delta;

          // 1. REASONING — ditampung, tidak pernah dicetak ke layar.
          const thought = delta?.reasoning_content || delta?.reasoning || '';
          if (thought) {
            fullReasoning += thought;
            if (onReasoningProgress) {
              onReasoningProgress(thought);
            }
          }

          // 2. KONTEN RESMI — satu-satunya yang boleh tampil.
          const content = delta?.content || '';
          if (content) {
            fullOutput += content;
            if (onContentToken) {
              onContentToken(content);
            }
          }
        } catch {}
      }
    }
  }

  return fullOutput;
}
