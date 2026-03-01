import { NextRequest, NextResponse } from 'next/server';
import { extractTextFromPDFBuffer } from '@/lib/pdf-extract-server';
import { parsePDFQuestions } from '@/lib/claude';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const questionsFile = formData.get('questions') as File | null;
    const answersFile = formData.get('answers') as File | null;
    const explanationsFile = formData.get('explanations') as File | null;

    if (!questionsFile) {
      return NextResponse.json({ error: 'questions file required' }, { status: 400 });
    }

    const warnings: string[] = [];

    // Extract text from all three PDFs server-side in parallel
    const [questionsText, answersText, explanationsText] = await Promise.all([
      extractTextFromPDFBuffer(Buffer.from(await questionsFile.arrayBuffer())).catch(
        (e: unknown) => { warnings.push(`Questions extraction error: ${String(e)}`); return ''; }
      ),
      answersFile
        ? extractTextFromPDFBuffer(Buffer.from(await answersFile.arrayBuffer())).catch(
            (e: unknown) => { warnings.push(`Answers extraction error: ${String(e)}`); return ''; }
          )
        : Promise.resolve(''),
      explanationsFile
        ? extractTextFromPDFBuffer(Buffer.from(await explanationsFile.arrayBuffer())).catch(
            (e: unknown) => { warnings.push(`Explanations extraction error: ${String(e)}`); return ''; }
          )
        : Promise.resolve(''),
    ]);

    if (!questionsText) {
      return NextResponse.json(
        { error: 'Could not extract text from the Questions PDF. Make sure it contains selectable text (not a scanned image).' },
        { status: 422 }
      );
    }

    // Parse all three texts via Claude in parallel
    const [parsedQuestions, parsedAnswers, parsedExplanations] = await Promise.all([
      parsePDFQuestions(questionsText, 'questions').catch((e: unknown) => {
        warnings.push(`Questions parse error: ${String(e)}`);
        return [];
      }),
      answersText
        ? parsePDFQuestions(answersText, 'answers').catch((e: unknown) => {
            warnings.push(`Answers parse error: ${String(e)}`);
            return [];
          })
        : Promise.resolve([]),
      explanationsText
        ? parsePDFQuestions(explanationsText, 'explanations').catch((e: unknown) => {
            warnings.push(`Explanations parse error: ${String(e)}`);
            return [];
          })
        : Promise.resolve([]),
    ]);

    // Index answers and explanations by question_number for O(1) merge
    type ParsedItem = Record<string, unknown>;
    const answersMap = new Map<number, ParsedItem>(
      parsedAnswers.map((a) => [(a as ParsedItem).question_number as number, a as ParsedItem])
    );
    const explanationsMap = new Map<number, ParsedItem>(
      parsedExplanations.map((e) => [
        (e as ParsedItem).question_number as number,
        e as ParsedItem,
      ])
    );

    // Merge correct_answer and explanation into each question row
    const questions = parsedQuestions.map((q) => {
      const qObj = q as ParsedItem;
      const qNum = qObj.question_number as number;
      const answer = answersMap.get(qNum);
      const explanation = explanationsMap.get(qNum);
      return {
        ...qObj,
        correct_answer: (answer?.correct_answer ?? qObj.correct_answer ?? '') as string,
        explanation: (explanation?.explanation ?? qObj.explanation ?? '') as string,
        confidence: 0.8,
      };
    });

    if (questions.length === 0) {
      warnings.push(
        'No questions could be parsed. Check that the Questions PDF contains readable text.'
      );
    }

    return NextResponse.json({
      questions,
      total_parsed: questions.length,
      parse_warnings: warnings,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
