import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { SUB_SKILLS } from '@/lib/constants';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { questions } = body as { questions: Array<Record<string, unknown>> };

    if (!questions || !Array.isArray(questions)) {
      return NextResponse.json({ error: 'questions array required' }, { status: 400 });
    }

    const subSkillList = SUB_SKILLS.map(s => `${s.id}: ${s.name} (${s.section})`).join('\n');

    const classified = await Promise.all(
      questions.map(async (q) => {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 256,
          system: `Classify this SAT question. Return JSON only with:
{
  "sub_skill_id": "one of the sub-skill IDs listed",
  "difficulty": 1-5,
  "section": "math" or "reading_writing",
  "passage_type": null or "literary_fiction|social_science|natural_science|humanities"
}

Available sub-skills:
${subSkillList}`,
          messages: [{
            role: 'user',
            content: `Question: ${JSON.stringify(q)}`,
          }],
        });

        const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) return { ...q, classification_error: 'no JSON' };

        try {
          const classification = JSON.parse(match[0]);
          return { ...q, ...classification };
        } catch {
          return { ...q, classification_error: 'parse failed' };
        }
      })
    );

    return NextResponse.json({ classified, count: classified.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
