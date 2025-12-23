// engine.ts

// 1️⃣ Type definitions (from 2.2)
export interface ActivityConfig {
  name: string;
  rrPerDay: number;
  penaltyPerDay: number;
}

export interface Completion {
  date: string; // YYYY-MM-DD
  completed: boolean;
}

export interface StreakResult {
  streak: number;
  rr: number;
  earned: number;
  penalty: number;
  penaltyDays: number;
}

export function calculateStreakWithDecay(
  completions: Completion[],
  rrPerDay: number,
  penaltyPerDay: number,
  graceDays = 2
): StreakResult {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const completedDates = completions
    .filter(c => c.completed)
    .map(c => new Date(c.date))
    .filter(d => !isNaN(d.getTime()) && d <= today)
    .sort((a, b) => b.getTime() - a.getTime());

  if (completedDates.length === 0) {
    return { streak: 0, rr: 0, earned: 0, penalty: 0, penaltyDays: 0 };
  }

  const mostRecent = completedDates[0];
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysSinceLast = Math.floor(
    (today.getTime() - mostRecent.getTime()) / msPerDay
  );

  let streak = 0;
  let checkDate = new Date(mostRecent);

  for (const d of completedDates) {
    if (sameDay(d, checkDate)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (d < checkDate) {
      break;
    }
  }

  const earned = streak * rrPerDay;

  if (daysSinceLast > graceDays) {
    const penaltyDays = daysSinceLast - graceDays;
    const penalty = penaltyDays * penaltyPerDay;
    const rr = Math.max(-earned, earned - penalty);
    return { streak, rr, earned, penalty, penaltyDays };
  }

  return { streak, rr: earned, earned, penalty: 0, penaltyDays: 0 };
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
