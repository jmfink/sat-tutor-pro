import { NextRequest } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { loadPrompt, injectPromptVars, anthropic } from '@/lib/claude';
import type { StudentContextProfile, ConversationMessage } from '@/types';

const encoder = new TextEncoder();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Accept tutorMode (sent by panel) or mode (legacy fallback)
    const mode: 'socratic' | 'direct' = (body.tutorMode ?? body.mode ?? 'direct') as 'socratic' | 'direct';
    const question: Record<string, unknown> = body.question;
    const studentAnswer: string = body.studentAnswer ?? '';
    const studentProfile: StudentContextProfile = body.studentProfile;
    const conversationHistory: ConversationMessage[] = body.conversationHistory ?? [];
    const userMessage: string = body.userMessage;

    const promptFile = mode === 'socratic' ? 'tutor-socratic.md' : 'tutor-direct.md';
    const systemTemplate = loadPrompt(promptFile);
    const systemPrompt = injectPromptVars(systemTemplate, {
      student_profile_json: JSON.stringify(studentProfile || {}, null, 2),
      question_json: JSON.stringify(question || {}, null, 2),
      student_answer: studentAnswer,
    });

    const messages: Anthropic.MessageParam[] = [
      ...conversationHistory.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: userMessage },
    ];

    // Return streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const anthropicStream = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1024,
            system: systemPrompt,
            messages,
            stream: true,
          });

          for await (const event of anthropicStream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
            }
            if (event.type === 'message_stop') {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            }
          }
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
