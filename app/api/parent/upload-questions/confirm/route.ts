import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { questions, source: sourceParam } = body as {
      questions: Array<Record<string, unknown>>;
      source?: string;
    };
    const source = sourceParam ?? 'uploaded_pdf';

    if (!questions || !Array.isArray(questions)) {
      return NextResponse.json({ error: 'questions array required' }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const inserted: string[] = [];
    const errors: string[] = [];
    let duplicates_skipped = 0;
    let missing_passage_skipped = 0;

    // Keywords that indicate the question references a SEPARATE passage.
    // "the text" is intentionally excluded — it fires on "Which choice completes the text"
    // which is a standard SAT inline-passage question stem, not a passage reference.
    // R&W questions containing these but lacking passage_text are excluded.
    const PASSAGE_KEYWORDS = ['the passage', 'text 1', 'text 2', 'underlined'];

    // One query to find which question_texts already exist — avoids N round-trips.
    // Also catches intra-batch duplicates by adding each processed text to the set.
    const incomingTexts = questions
      .map(q => q.question_text as string)
      .filter(Boolean);

    const { data: existingRows } = await supabase
      .from('questions')
      .select('question_text')
      .in('question_text', incomingTexts);

    const existingTexts = new Set<string>(
      (existingRows ?? []).map(r => r.question_text as string)
    );

    for (const q of questions) {
      try {
        const questionText = q.question_text as string;

        // Skip duplicates — both against the DB and within this batch
        if (existingTexts.has(questionText)) {
          duplicates_skipped++;
          continue;
        }
        existingTexts.add(questionText); // prevent intra-batch duplicates

        // Defensive coercions — classify route may not have run, or may have failed per-question
        const section = (q.section as string) === 'math' ? 'math' : 'reading_writing';

        // Skip R&W questions that reference a passage but have no passage_text.
        // These were likely mis-parsed (passage dropped during extraction).
        if (section === 'reading_writing' && !q.passage_text) {
          const lower = questionText?.toLowerCase() ?? '';
          if (PASSAGE_KEYWORDS.some(kw => lower.includes(kw))) {
            missing_passage_skipped++;
            continue;
          }
        }
        const subSkillId = (q.sub_skill_id as string | undefined)?.trim() ||
          (section === 'math' ? 'M-01' : 'RW-01');
        const rawDifficulty = Number(q.difficulty);
        const difficulty = Number.isFinite(rawDifficulty) && rawDifficulty >= 1 && rawDifficulty <= 5
          ? Math.round(rawDifficulty)
          : 3;
        // Grid-in math questions have no A/B/C/D choices — use empty object instead of null
        const answerChoices = (q.answer_choices && typeof q.answer_choices === 'object')
          ? q.answer_choices
          : {};

        // Create passage if needed
        let passageId: string | null = null;
        if (q.passage_text && typeof q.passage_text === 'string') {
          const pid = `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          await supabase.from('passages').insert({
            passage_id: pid,
            passage_text: q.passage_text,
            source,
          });
          passageId = pid;
        }

        const qid = `q_${source.replace(/\s+/g, '_')}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
        // Build tags: start from any tags set by the classify step, then add
        // has_figure if the pdf-parser flagged this question as referencing a
        // visual element that cannot be displayed.
        const baseTags = (q.tags as string[]) || [];
        const hasFigure = q.has_figure === true || q.has_figure === 'true';
        const tags = hasFigure && !baseTags.includes('has_figure')
          ? [...baseTags, 'has_figure']
          : baseTags;

        const { error } = await supabase.from('questions').insert({
          question_id: qid,
          source,
          section,
          sub_skill_id: subSkillId,
          difficulty,
          question_text: questionText,
          passage_id: passageId,
          answer_choices: answerChoices,
          correct_answer: q.correct_answer,
          distractor_analysis: (q.distractor_analysis as Record<string, string>) || null,
          is_ai_generated: false,
          tags,
        });

        if (error) {
          errors.push(`Q${q.question_number ?? qid}: ${error.message}`);
        } else {
          inserted.push(qid);
        }
      } catch (err) {
        errors.push(String(err));
      }
    }

    // Return a non-2xx status when every question failed with real errors
    // (all-duplicates or all-missing-passage is a valid outcome, not a failure).
    if (inserted.length === 0 && duplicates_skipped === 0 && missing_passage_skipped === 0 && errors.length > 0) {
      return NextResponse.json(
        { questions_added: 0, duplicates_skipped: 0, missing_passage_skipped: 0, errors: errors.length, error_details: errors },
        { status: 422 }
      );
    }

    return NextResponse.json({
      questions_added: inserted.length,
      duplicates_skipped,
      missing_passage_skipped,
      errors: errors.length,
      error_details: errors,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
