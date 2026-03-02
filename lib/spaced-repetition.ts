// Modified SM-2 Spaced Repetition Algorithm

export interface ReviewItem {
  question_id: string;
  review_count: number;
  last_review_result?: boolean;
  interval_days: number;
}

// SM-2 interval calculation
export function calculateNextInterval(item: ReviewItem, wasCorrect: boolean): number {
  if (!wasCorrect) {
    return 1; // Reset: review tomorrow
  }

  switch (item.review_count) {
    case 0:
      return 1; // First correct review: 1 day
    case 1:
      return 3; // Second correct review: 3 days
    case 2:
      return 7; // Third correct review: 7 days
    default:
      return 21; // Fourth+ correct review: 21 days
  }
}

// Calculate the next review date, relative to an optional base date.
// Pass the user's local "today" as baseDate to avoid UTC-offset drift.
export function getNextReviewDate(item: ReviewItem, wasCorrect: boolean, baseDate: Date = new Date()): Date {
  const intervalDays = calculateNextInterval(item, wasCorrect);
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + intervalDays);
  return nextDate;
}

// Format date as YYYY-MM-DD using local timezone components.
export function formatDateForDB(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Check if an item is due for review
export function isDueForReview(nextReviewDate: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const reviewDate = new Date(nextReviewDate);
  reviewDate.setHours(0, 0, 0, 0);
  return reviewDate <= today;
}

