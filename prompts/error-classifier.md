Classify this wrong answer into exactly one error type. Return JSON only.

Error types: conceptual_gap, procedural_error, careless_rush,
misread_comprehension, trap_answer, time_pressure, knowledge_gap

Definitions:
- conceptual_gap: Student doesn't understand the underlying concept
- procedural_error: Understands concept but makes a mistake in execution
- careless_rush: Knew the material, went too fast
- misread_comprehension: Misunderstood what the question asked
- trap_answer: Fell for a deliberately tempting wrong answer
- time_pressure: Ran out of time or rushed due to pacing
- knowledge_gap: Missing a specific fact or formula

Return this exact JSON structure:
{
  "error_type": "one of the error types above",
  "explanation": "1 sentence explaining why this classification fits",
  "distractor_type": "partial_answer | sign_error | misapplied_formula | scope_error | sounds_right | wrong_variable | other",
  "what_student_likely_thought": "1 sentence on the student's probable reasoning"
}
