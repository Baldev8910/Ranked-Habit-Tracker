import {
  App,
  Plugin,
  Notice,
  TFile,
  ItemView,
  WorkspaceLeaf,
  PluginSettingTab,
  Setting,
  debounce,
  Modal
} from "obsidian";


const VIEW_TYPE_RANK = "Track-rank-view";

/* ======================
   ENGINE (INLINE)
====================== */

interface Completion {
  date: string; // YYYY-MM-DD
  completed: boolean;
}

interface StreakResult {
  streak: number;
  rr: number;
  earned: number;
  penalty: number;
  penaltyDays: number;
}

interface CustomHabitConfig {
  id: string;
  name: string;
  folder: string;
  field: string;
  rrPerDay: number;
  penaltyPerDay: number;
  enabled: boolean;
  trackingMode?: 'daily' | 'weekly';  // ADD THIS
  rrPerWeek?: number;                  // ADD THIS
}

interface ActivitySnapshot {
  activityId: string;
  disabledDate: string;
  frozenRR: number;
  frozenStreak: number;
}

interface ActivityConfig {
  name: string;
  folder: string;
  field: string;
  rrPerDay: number;
  penaltyPerDay: number;
  trackingMode?: 'daily' | 'weekly'; // ADD THIS
  rrPerWeek?: number; // ADD THIS
}

interface TrackRankSettings {
  enabledActivities: Record<string, boolean>;
  customHabits: CustomHabitConfig[];

  rankGraceRR: number;
  rankGraceDays: number;
  rankBelowSince: string | null; // YYYY-MM-DD

  activitySnapshots: Record<string, ActivitySnapshot>;

  snapshots: RankSnapshot[];
}

interface RankSnapshot {
  timestamp: string;        // ISO
  totalRR: number;
  liveRR: number;
  historicalRR: number;
  rank: string;
  perActivity: {
    name: string;
    rr: number;
    streak: number;
  }[];
}

const DEFAULT_SETTINGS: TrackRankSettings = {
  enabledActivities: {},
  customHabits: [],
  rankGraceRR: 20,
  rankGraceDays: 3,
  rankBelowSince: null,
  activitySnapshots: {},
  snapshots: [],
};

function todayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function calculateLiveStreakWithDecay(
  completions: Completion[],
  rrPerDay: number,
  penaltyPerDay: number,
  asOf: Date = new Date()
): StreakResult {
  // --- DataviewJS parity ---
  const today = new Date(asOf);
  today.setHours(0,0,0,0);

  const completedDates = completions
    .filter(c => c.completed)
    .map(c => {
      const d = new Date(c.date);
      d.setHours(0, 0, 0, 0);
      return d;
    })
    .filter(d => !isNaN(d.getTime()) && d <= today)
    .sort((a, b) => b.getTime() - a.getTime());

  // Never started → no penalty
  if (completedDates.length === 0) {
    return {
      streak: 0,
      rr: 0,
      earned: 0,
      penalty: 0,
      penaltyDays: 0
    };
  }

  const mostRecent = completedDates[0];

  // Calendar-day diff (moment-equivalent)
  const daysSinceLastCompletion =
    Math.floor(
      (today.getTime() - mostRecent.getTime()) /
      (24 * 60 * 60 * 1000)
    );

  // Broken streak → penalties apply
  if (daysSinceLastCompletion > 2) {
    let baseStreak = 0;
    let checkDate = new Date(mostRecent);

    for (const date of completedDates) {
      if (date.getTime() === checkDate.getTime()) {
        baseStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (date < checkDate) {
        break;
      }
    }

    const earned = baseStreak * rrPerDay;
    const penaltyDays = daysSinceLastCompletion - 2;
    const penalty = penaltyDays * penaltyPerDay;
    const rr = Math.max(0, earned - penalty);

    return { streak: baseStreak, rr, earned, penalty, penaltyDays };
  }

  // Active streak
  let streak = 0;
  let checkDate = new Date(mostRecent);

  for (const date of completedDates) {
    if (date.getTime() === checkDate.getTime()) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (date < checkDate) {
      break;
    }
  }

  const earned = streak * rrPerDay;
  return { streak, rr: earned, earned, penalty: 0, penaltyDays: 0 };
}

function calculateWeeklyStreak(
  completions: Completion[],
  rrPerWeek: number,
  asOf: Date = new Date()
): StreakResult {
  const today = new Date(asOf);
  today.setHours(0, 0, 0, 0);

  const completedDates = completions
    .filter(c => c.completed)
    .map(c => {
      const d = new Date(c.date);
      d.setHours(0, 0, 0, 0);
      return d;
    })
    .filter(d => !isNaN(d.getTime()) && d <= today)
    .sort((a, b) => b.getTime() - a.getTime());

  if (completedDates.length === 0) {
    return { streak: 0, rr: 0, earned: 0, penalty: 0, penaltyDays: 0 };
  }

  // Get ISO week number
  function getWeek(date: Date): { year: number; week: number } {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return { year: d.getFullYear(), week: weekNo };
  }

  // Group completions by week
  const weekMap = new Map<string, boolean>();
  completedDates.forEach(date => {
    const { year, week } = getWeek(date);
    weekMap.set(`${year}-W${week}`, true);
  });

  // Check current week
  const currentWeek = getWeek(today);
  
  // Calculate streak (consecutive weeks)
  let streak = 0;
  let checkWeek = currentWeek;
  
  while (true) {
    const weekKey = `${checkWeek.year}-W${checkWeek.week}`;
    if (weekMap.has(weekKey)) {
      streak++;
      // Move to previous week
      const prevWeekDate = new Date(checkWeek.year, 0, 1 + (checkWeek.week - 2) * 7);
      checkWeek = getWeek(prevWeekDate);
    } else {
      break;
    }
  }

  const earned = streak * rrPerWeek;
  return { streak, rr: earned, earned, penalty: 0, penaltyDays: 0 };
}

function getProgressBarColor(
  rankName: string,
  inGrace: boolean
) {
  if (inGrace) return "#EF4444"; // red always wins

  const tier = rankName.split(" ")[0];
  return RANK_TIER_COLORS[tier] ?? "#6B7280";
}

function getCompletionsFromFolder(
  app: App,
  folderPath: string,
  fieldName: string
): Completion[] {
  const files = app.vault.getMarkdownFiles();

  return files
    .filter((file: TFile) => file.path.startsWith(folderPath))
    .map((file: TFile) => {
      const cache = app.metadataCache.getFileCache(file);
      const frontmatter = cache?.frontmatter;

      if (!frontmatter || typeof frontmatter[fieldName] !== "boolean") {
        return null;
      }

      const date = file.basename; // YYYY-MM-DD

      return {
        date,
        completed: frontmatter[fieldName] === true
      };
    })
    .filter((c: Completion | null): c is Completion => c !== null);
}

async function generateRankAnalysisNote(
  app: App,
  days: number
) {
  const end = new Date();
  end.setHours(0, 0, 0, 0);

  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);

  const files = app.vault.getMarkdownFiles();

  const stats: Record<string, number> = {};
  ACTIVITIES.forEach(a => stats[a.name] = 0);

  const dailyCounts: Record<string, number> = {};

  for (const file of files) {
    const name = file.basename; // YYYY-MM-DD
    const date = new Date(name);
    if (isNaN(date.getTime())) continue;

    date.setHours(0, 0, 0, 0);
    if (date < start || date > end) continue;

    const cache = app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter;
    if (!fm) continue;

    dailyCounts[name] ??= 0;

    for (const a of ACTIVITIES) {
      if (file.path.startsWith(a.folder) && fm[a.field] === true) {
        stats[a.name]++;
        dailyCounts[name]++;
      }
    }
  }

  const lines: string[] = [];

  lines.push(`# Rank analysis — last ${days} days`);
  lines.push(``);
  lines.push(`**Period:** ${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)}`);
  lines.push(``);

  lines.push(`## Per-activity summary`);
  lines.push(`<table class="rank-analysis">`);
  lines.push(`<tr><th>Activity</th><th>Days Done</th><th>Heat</th></tr>`);

  Object.entries(stats).forEach(([name, count]) => {
    const heat =
      count === 0 ? "" :
      count < days * 0.25 ? "h1" :
      count < days * 0.5  ? "h2" :
      count < days * 0.75 ? "h3" : "h4";

    lines.push(
      `<tr>
        <td>${name}</td>
        <td>${count}</td>
        <td>
          <div class="rank-heatmap">
            ${Array.from({ length: Math.min(count, days) })
              .map(() => `<div class="${heat}"></div>`)
              .join("")}
          </div>
        </td>
      </tr>`
    );
  });

  lines.push(`</table>`);
  lines.push(``);

  lines.push(`## Daily activity heatmap`);
  lines.push(`<div class="rank-heatmap">`);

  // Sort dates chronologically for better visualization
  const sortedDates = Object.keys(dailyCounts).sort();

  sortedDates.forEach((date) => {
    const count = dailyCounts[date];
    const heat =
      count === 0 ? "" :
      count < 3 ? "h1" :
      count < 6 ? "h2" :
      count < 9 ? "h3" : "h4";

    lines.push(
      `<div class="${heat}" title="${date}: ${count} activities"></div>`
    );
  });

  lines.push(`</div>`);

  const content = lines.join("\n");

  const folder = "Data analysis";
  if (!app.vault.getAbstractFileByPath(folder)) {
    await app.vault.createFolder(folder);
  }

  const filename = `${folder}/Rank analysis ${end.toISOString().slice(0, 10)}.md`;

  // Check if file exist
  let file = app.vault.getAbstractFileByPath(filename);

  if (file instanceof TFile) {
    // File exists, modify it
    await app.vault.modify(file, content);
    // Open the existing file
    await app.workspace.getLeaf(true).openFile(file);
  } else {
    // File doesn't exist, create it
    const newFile = await app.vault.create(filename, content);
    // Open the new file
    await app.workspace.getLeaf(true).openFile(newFile);
  }}

const VIEW_TYPE_STATS = "Track-rank-stats";

const ACTIVITIES: ActivityConfig[] = [
  {
    name: "Journal",
    folder: "01 Daily Journal",
    field: "DJournal",
    rrPerDay: 1,
    penaltyPerDay: 2
  },
  {
    name: "Workout",
    folder: "02 Workout",
    field: "Workout",
    rrPerDay: 1,
    penaltyPerDay: 2
  },
  {
    name: "Guitar",
    folder: "03 Guitar Practice",
    field: "Guitar",
    rrPerDay: 1,
    penaltyPerDay: 2
  },
  {
    name: "Python",
    folder: "04 Learning Python",
    field: "Python",
    rrPerDay: 1,
    penaltyPerDay: 2
  },
  {
    name: "Cardio",
    folder: "05 Cycling",
    field: "Cardio",
    rrPerDay: 1,
    penaltyPerDay: 2
  },
  {
    name: "Reading",
    folder: "06 Readings",
    field: "Reading",
    rrPerDay: 1,
    penaltyPerDay: 2
  },
  {
    name: "No Fap",
    folder: "01 Daily Journal",
    field: "MasturbationAvoided",
    rrPerDay: 5,        
    penaltyPerDay: 5    
  },
  {
    name: "GTG",
    folder: "01 Daily Journal",
    field: "GTG",
    rrPerDay: 1,
    penaltyPerDay: 2
  },
  {
    name: "Study",
    folder: "01 Daily Journal",
    field: "Study",
    rrPerDay: 1,
    penaltyPerDay: 2
  },
  {
    name: "Research",
    folder: "01 Daily Journal",
    field: "Research",
    rrPerDay: 1,
    penaltyPerDay: 2,
    trackingMode: 'weekly', // ADD THIS
    rrPerWeek: 7 // ADD THIS - gives 7 RR per week completed
  },
  {
    name: "Gaming",
    folder: "01 Daily Journal",
    field: "Gaming",
    rrPerDay: 1,
    penaltyPerDay: 2
  },
  {
    name: "Water Plants",
    folder: "01 Daily Journal",
    field: "waterPlants",
    rrPerDay: 1,
    penaltyPerDay: 2
  },
  {
    name: "Medicine",
    folder: "01 Daily Journal",
    field: "Medicine",
    rrPerDay: 1,
    penaltyPerDay: 2
  }
];

function computeAllActivityRR(
  app: App,
  settings: TrackRankSettings
) {
  let historicalRR = 0;
  let liveRR = 0;

  const breakdown: {
    name: string;
    streak: number;
    rr: number;
    penaltyDays: number;
  }[] = [];

  const allActivities = [
    ...ACTIVITIES
      .filter(a => settings.enabledActivities[a.name] ?? true)
      .map(a => ({
        name: a.name,
        folder: a.folder,
        field: a.field,
        rrPerDay: a.rrPerDay,
        penaltyPerDay: a.penaltyPerDay,
        trackingMode: a.trackingMode,
        rrPerWeek: a.rrPerWeek
      })),
    ...settings.customHabits.filter(h => h.enabled)
  ];

  // LOOP THROUGH EACH ACTIVITY
  for (const activity of allActivities) {
    const completions = getCompletionsFromFolder(
      app,
      activity.folder,
      activity.field
    );

    let result: StreakResult;

    if (completions.length === 0) {
      result = {
        streak: 0,
        rr: 0,
        earned: 0,
        penalty: 0,
        penaltyDays: 0
      };
    } else {
      // Check if weekly tracking
      if (activity.trackingMode === 'weekly' && activity.rrPerWeek) {
        result = calculateWeeklyStreak(
          completions,
          activity.rrPerWeek
        );
      } else {
        result = calculateLiveStreakWithDecay(
          completions,
          activity.rrPerDay,
          activity.penaltyPerDay
        );
      }
    }

    // ---- Historical RR (immutable) ----
    const completedDates = completions
      .filter(c => c.completed)
      .map(c => new Date(c.date))
      .sort((a, b) => b.getTime() - a.getTime());

    let historicalCount = 0;

    // For WEEKLY tracking, historical calculation is different
    if (activity.trackingMode === 'weekly') {
      // All completed dates that are NOT part of the current streak weeks
      // For simplicity with weekly: historical = total completions - current streak weeks
      // This is approximate but works for the use case
      historicalCount = Math.max(0, completedDates.length - result.streak);
      historicalRR += historicalCount * (activity.rrPerWeek || 0);
    } else {
      // DAILY tracking logic (original)
      if (completedDates.length > 0 && result.streak > 0) {
        const streakStartDate = new Date(completedDates[0]);
        streakStartDate.setDate(streakStartDate.getDate() - result.streak + 1);
        
        // Count only completions before the streak period
        historicalCount = completedDates.filter(
          d => d < streakStartDate
        ).length;
      } else {
        // No active streak, all completed days are historical
        historicalCount = completedDates.length;
      }
      historicalRR += historicalCount * activity.rrPerDay;
    }

    liveRR += result.rr;

    breakdown.push({
      name: activity.name,
      streak: result.streak,
      rr: result.rr,
      penaltyDays: result.penaltyDays
    });
  }

  // ---- ADD FROZEN RR FROM DISABLED ACTIVITIES ----
  for (const [activityId, snapshot] of Object.entries(settings.activitySnapshots)) {
    // Check if this activity is currently disabled
    const isDisabled = 
      !allActivities.some(a => ('id' in a ? a.id : a.name) === activityId);
    
    if (isDisabled) {
      // Add the frozen RR to historical
      historicalRR += snapshot.frozenRR;
      
      // Add to breakdown for display
      breakdown.push({
        name: activityId,
        streak: 0,
        rr: snapshot.frozenRR,
        penaltyDays: 0
      });
    }
  }

  const totalRR = historicalRR + liveRR;
  return {
    totalRR,
    breakdown,
    penalties: breakdown.filter(b => b.rr < 0)
  };
}

interface Rank {
  name: string;
  rrRequired: number;
}

const RANKS: Rank[] = [
  {name: "Unranked", rrRequired: 0},

  { name: "Iron I", rrRequired: 50 },
  { name: "Iron II", rrRequired: 100 },
  { name: "Iron III", rrRequired: 150 },

  { name: "Bronze I", rrRequired: 200 },
  { name: "Bronze II", rrRequired: 250 },
  { name: "Bronze III", rrRequired: 300 },

  { name: "Silver I", rrRequired: 350 },
  { name: "Silver II", rrRequired: 400 },
  { name: "Silver III", rrRequired: 450 },

  { name: "Gold I", rrRequired: 500 },
  { name: "Gold II", rrRequired: 550 },
  { name: "Gold III", rrRequired: 650 },

  { name: "Platinum I", rrRequired: 700 },
  { name: "Platinum II", rrRequired: 750 },
  { name: "Platinum III", rrRequired: 800 },

  { name: "Diamond I", rrRequired: 850 },
  { name: "Diamond II", rrRequired: 900 },
  { name: "Diamond III", rrRequired: 950 },

  { name: "Ascendant I", rrRequired: 1000 },
  { name: "Ascendant II", rrRequired: 1050 },
  { name: "Ascendant III", rrRequired: 1100 },

  { name: "Immortal I", rrRequired: 1150 },
  { name: "Immortal II", rrRequired: 1200 },
  { name: "Immortal III", rrRequired: 1250 },

  { name: "Radiant", rrRequired: 1300 }
];

const RANK_TIER_COLORS: Record<string, string> = {
  Unranked: "#F5F2F2",
  Iron: "#6B7280",
  Bronze: "#CD7F32",
  Silver: "#9CA3AF",
  Gold: "#F59E0B",
  Platinum: "#22D3EE",
  Diamond: "#60A5FA",
  Ascendant: "#22C55E",
  Immortal: "#EF4444",
  Radiant: "#F472B6"
};

const RANK_ICONS: Record<string, string> = {
  "Unranked": "Unranked",

  "Iron I": "Iron_1_Rank",
  "Iron II": "Iron_2_Rank",
  "Iron III": "Iron_3_Rank",

  "Bronze I": "Bronze_1_Rank",
  "Bronze II": "Bronze_2_Rank",
  "Bronze III": "Bronze_3_Rank",

  "Silver I": "Silver_1_Rank",
  "Silver II": "Silver_2_Rank",
  "Silver III": "Silver_3_Rank",

  "Gold I": "Gold_1_Rank",
  "Gold II": "Gold_2_Rank",
  "Gold III": "Gold_3_Rank",

  "Platinum I": "Platinum_1_Rank",
  "Platinum II": "Platinum_2_Rank",
  "Platinum III": "Platinum_3_Rank",

  "Diamond I": "Diamond_1_Rank",
  "Diamond II": "Diamond_2_Rank",
  "Diamond III": "Diamond_3_Rank",

  "Ascendant I": "Ascendant_1_Rank",
  "Ascendant II": "Ascendant_2_Rank",
  "Ascendant III": "Ascendant_3_Rank",

  "Immortal I": "Immortal_1_Rank",
  "Immortal II": "Immortal_2_Rank",
  "Immortal III": "Immortal_3_Rank",

  "Radiant": "Radiant_Rank"
};

function resolveRankRaw(totalRR: number) {
  let currentIndex = 0;

  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (totalRR >= RANKS[i].rrRequired) {
      currentIndex = i;
      break;
    }
  }

  const currentRank = RANKS[currentIndex];
  const nextRank = currentIndex < RANKS.length - 1
    ? RANKS[currentIndex + 1]
    : null;

  const prevRank = currentIndex > 0
    ? RANKS[currentIndex - 1]
    : null;

  // 🧱 DEMOTION FLOOR
  const floorRR = prevRank ? prevRank.rrRequired : 0;

  // Clamp RR so you don’t freefall
  const effectiveRR = Math.max(totalRR, floorRR);

  let progress = 100;
  let rrNeeded = 0;

  if (nextRank) {
    const range = nextRank.rrRequired - currentRank.rrRequired;
    const earned = effectiveRR - currentRank.rrRequired;
    progress = Math.max(0, Math.min(100, (earned / range) * 100));
    rrNeeded = nextRank.rrRequired - effectiveRR;
  }

  return {
    currentRank: currentRank.name,
    nextRank: nextRank?.name ?? null,
    progress,
    rrNeeded,
    demoted: effectiveRR < totalRR
  };
}

function resolveRankWithGrace(
  totalRR: number,
  settings: TrackRankSettings
) {
  const raw = resolveRankRaw(totalRR);

  const currentIndex = RANKS.findIndex(
    r => r.name === raw.currentRank
  );

  const floorRank = RANKS[Math.max(0, currentIndex)];
  const floorRR = floorRank.rrRequired;

  // Above floor → reset grace
  if (totalRR >= floorRR) {
    settings.rankBelowSince = null;
    return {
      ...raw,
      demotionWarning: null
    };
  }

  // Start grace window
  if (!settings.rankBelowSince) {
    settings.rankBelowSince = todayISO();
  }

  const daysBelow =
    Math.floor(
      (Date.now() -
        new Date(settings.rankBelowSince).getTime()) /
        (24 * 60 * 60 * 1000)
    );

  const daysLeft = settings.rankGraceDays - daysBelow;

  // Grace active → freeze rank
  if (
    daysBelow < settings.rankGraceDays &&
    totalRR >= floorRR - settings.rankGraceRR
  ) {
    return {
      ...raw,
      currentRank: floorRank.name,
      demotionWarning: {
        daysLeft,
        targetRR: floorRR,
      inGrace: true
      }
    };
  }

  // Grace expired → real demotion
  settings.rankBelowSince = null;
  return {
    ...resolveRankRaw(totalRR),
    demotionWarning: null
  };
}

function buildSnapshot(
  app: App,
  settings: TrackRankSettings
) {
  const { totalRR, breakdown } = computeAllActivityRR(app, settings);

  // Derive live vs historical from breakdown
  const liveRR = breakdown.reduce((s, b) => s + b.rr, 0);
  const historicalRR = totalRR - liveRR;

  const rankInfo = resolveRankWithGrace(totalRR, settings);

  return {
    timestamp: new Date().toISOString(),
    totalRR,
    liveRR,
    historicalRR,
    rank: rankInfo.currentRank,
    perActivity: breakdown.map(b => ({
      name: b.name,
      rr: b.rr,
      streak: b.streak
    }))
  };
}

class TrackRankView extends ItemView {
  plugin: TrackHabitRankPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: TrackHabitRankPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_RANK;
  }

  getDisplayText(): string {
    return "Track rank";
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  render() {
    const content = this.contentEl;
    content.empty();

    const { totalRR, penalties } = computeAllActivityRR(
      this.app,
      this.plugin.settings
    );

    const rankInfo = resolveRankWithGrace(
      totalRR,
      this.plugin.settings
    );

    const barColor = getProgressBarColor(
      rankInfo.currentRank,
      rankInfo.demotionWarning?.inGrace ?? false
    );

    const iconName = RANK_ICONS[rankInfo.currentRank];

    const wrapper = content.createDiv({
      attr: {
        style: `
          max-width: 420px;
          margin: 0 auto;
          padding: 24px;
          text-align: center;
        `
      }
    });

    wrapper.createEl("div", {
      text: "Competitive rank",
      attr: {
        style: `
          font-size: 0.75em;
          letter-spacing: 0.25em;
          opacity: 0.6;
          margin-bottom: 20px;
        `
      }
    });

    if (iconName) {
      wrapper.createEl("img", {
        attr: {
          src: this.app.vault.adapter.getResourcePath(
            `.obsidian/plugins/ranked-habit-tracker/assets/ranks/${iconName}.png`
          ),
          style: `
            width: 140px;
            height: 140px;
            margin-bottom: 12px;
            filter: drop-shadow(0 0 24px rgba(255,255,255,0.35));
          `
        }
      });
    }

    wrapper.createEl("div", {
      text: rankInfo.currentRank,
      attr: {
        style: `
          font-size: 2.2em;
          font-weight: 700;
          margin-bottom: 6px;
        `
      }
    });

    wrapper.createEl("div", {
      text: `${totalRR} RR`,
      attr: {
        style: `
          font-size: 1.1em;
          opacity: 0.85;
          margin-bottom: 12px;
        `
      }
    });

    if (rankInfo.demotionWarning?.inGrace) {
      wrapper.createEl("div", {
        text: "Rank under pressure",
        attr: {
          style: `
            margin-bottom: 10px;
            font-size: 0.75em;
            color: #ef4444;
            opacity: 0.85;
          `
        }
      });
    }

    const bar = wrapper.createDiv({
      attr: {
        style: `
          width: 100%;
          height: 10px;
          background: var(--background-modifier-border);
          border-radius: 6px;
          overflow: hidden;
          margin-bottom: 6px;
        `
      }
    });

    bar.createDiv({
      attr: {
        style: `
          width: ${rankInfo.progress}%;
          height: 100%;
          background: ${barColor};
          transition: width 0.3s ease, background 0.3s ease;
        `
      }
    });

    if (rankInfo.nextRank) {
      wrapper.createEl("div", {
        text: `${rankInfo.rrNeeded} RR needed`,
        attr: {
          style: `
            font-size: 0.75em;
            opacity: 0.6;
            text-align: right;
            margin-bottom: 14px;
          `
        }
      });
    }

    if (rankInfo.demotionWarning) {
      const warn = rankInfo.demotionWarning;

      const warningBox = wrapper.createDiv({
        attr: {
          style: `
            margin: 16px 0;
            padding: 10px 12px;
            border-radius: 8px;
            background: rgba(239,68,68,0.12);
            border: 1px solid rgba(239,68,68,0.4);
            color: #ef4444;
            font-size: 0.85em;
            font-weight: 600;
          `
        }
      });

      warningBox.setText(
        `⚠ Demotion risk — ${warn.daysLeft} day${warn.daysLeft === 1 ? "" : "s"} left to recover`
      );
    }

    if (penalties.length > 0) {
      const box = wrapper.createDiv({
        attr: {
          style: `
            margin-top: 20px;
            padding: 12px;
            border-radius: 8px;
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            text-align: left;
          `
        }
      });

      box.createEl("div", {
        text: "Penalties active",
        attr: {
          style: `
            font-weight: 600;
            margin-bottom: 6px;
            font-size: 0.9em;
            color: #ef4444;
          `
        }
      });

      penalties.forEach(p => {
        box.createEl("div", {
          text: `${p.name}: ${p.rr} RR`,
          attr: {
            style: `
              font-size: 0.8em;
              opacity: 0.85;
            `
          }
        });
      });
    }
  }
}

class TrackRankSettingTab extends PluginSettingTab {
  plugin: TrackHabitRankPlugin;

  constructor(app: App, plugin: TrackHabitRankPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    /* ======================
       DEFAULT ACTIVITIES
    ====================== */

    new Setting(containerEl)
      .setName("Track rank configuration")
      .setHeading();

    ACTIVITIES.forEach(activity => {
      new Setting(containerEl)
        .setName(activity.name)
        .setDesc(`Enable ${activity.name} in RR calculation`)
        .addToggle(toggle =>
          toggle
            .setValue(
              this.plugin.settings.enabledActivities[activity.name] ?? true
            )
            .onChange(async value => {
              const currentlyEnabled = this.plugin.settings.enabledActivities[activity.name] ?? true;
              const aboutToDisable = currentlyEnabled && !value;
              
              // Save snapshot before disabling
              if (aboutToDisable) {
                const completions = getCompletionsFromFolder(
                  this.app,
                  activity.folder,
                  activity.field
                );
                
                // Use appropriate calculation based on tracking mode
                let result: StreakResult;
                if (activity.trackingMode === 'weekly' && activity.rrPerWeek) {
                  result = calculateWeeklyStreak(
                    completions,
                    activity.rrPerWeek
                  );
                } else {
                  result = calculateLiveStreakWithDecay(
                    completions,
                    activity.rrPerDay,
                    activity.penaltyPerDay
                  );
                }
                
                const completedDates = completions
                  .filter(c => c.completed)
                  .map(c => new Date(c.date))
                  .sort((a, b) => b.getTime() - a.getTime());
                
                let historicalCount = 0;
                let historicalRR = 0;
                
                if (activity.trackingMode === 'weekly') {
                  historicalCount = Math.max(0, completedDates.length - result.streak);
                  historicalRR = historicalCount * (activity.rrPerWeek || 0);
                } else {
                  if (completedDates.length > 0 && result.streak > 0) {
                    const streakStartDate = new Date(completedDates[0]);
                    streakStartDate.setDate(streakStartDate.getDate() - result.streak + 1);
                    historicalCount = completedDates.filter(d => d < streakStartDate).length;
                  } else {
                    historicalCount = completedDates.length;
                  }
                  historicalRR = historicalCount * activity.rrPerDay;
                }
                
                const totalRR = historicalRR + result.rr;
                
                this.plugin.settings.activitySnapshots[activity.name] = {
                  activityId: activity.name,
                  disabledDate: todayISO(),
                  frozenRR: totalRR,
                  frozenStreak: result.streak
                };
              }
              
              if (!aboutToDisable && value) {
                delete this.plugin.settings.activitySnapshots[activity.name];
              }
              
              this.plugin.settings.enabledActivities[activity.name] = value;
              await this.plugin.saveSettings();
              this.plugin.refreshRankView();
            })
        );
    });

    /* ======================
       CUSTOM HABITS
    ====================== */

    new Setting(containerEl)
      .setName("Custom habits")
      .setHeading();

    new Setting(containerEl)
      .setName("Add custom habit")
      .setDesc("Track any checkbox-based habit")
      .addButton(btn =>
        btn
          .setButtonText("Add habit")
          .setCta()
          .onClick(async () => {
            this.plugin.settings.customHabits.push({
              id: crypto.randomUUID(),
              name: "New habit",
              folder: "",
              field: "",
              rrPerDay: 1,
              penaltyPerDay: 2,
              enabled: true
            });

            await this.plugin.saveSettings();
            this.display();  // re-render settings
          })
      );

      this.plugin.settings.customHabits.forEach((habit, index) => {
        const box = containerEl.createDiv({
          attr: {
            style: `
              margin-top: 12px;
              padding: 12px;
              border-radius: 8px;
              border: 1px solid var(--background-modifier-border);
            `
          }
        });

        // Enable toggle
        new Setting(box)
          .setName("Enabled")
          .addToggle(t =>
            t
              .setValue(habit.enabled)
              .onChange(async v => {
                const currentlyEnabled = habit.enabled;
                const aboutToDisable = currentlyEnabled && !v;
                
                // Save snapshot before disabling
                if (aboutToDisable) {
                  const completions = getCompletionsFromFolder(
                    this.app,
                    habit.folder,
                    habit.field
                  );
                  
                  // Use appropriate calculation based on tracking mode
                  let result: StreakResult;
                  if (habit.trackingMode === 'weekly' && habit.rrPerWeek) {
                    result = calculateWeeklyStreak(
                      completions,
                      habit.rrPerWeek
                    );
                  } else {
                    result = calculateLiveStreakWithDecay(
                      completions,
                      habit.rrPerDay,
                      habit.penaltyPerDay
                    );
                  }
                  
                  const completedDates = completions
                    .filter(c => c.completed)
                    .map(c => new Date(c.date))
                    .sort((a, b) => b.getTime() - a.getTime());
                  
                  let historicalCount = 0;
                  let historicalRR = 0;
                  
                  if (habit.trackingMode === 'weekly') {
                    historicalCount = Math.max(0, completedDates.length - result.streak);
                    historicalRR = historicalCount * (habit.rrPerWeek || 0);
                  } else {
                    if (completedDates.length > 0 && result.streak > 0) {
                      const streakStartDate = new Date(completedDates[0]);
                      streakStartDate.setDate(streakStartDate.getDate() - result.streak + 1);
                      historicalCount = completedDates.filter(d => d < streakStartDate).length;
                    } else {
                      historicalCount = completedDates.length;
                    }
                    historicalRR = historicalCount * habit.rrPerDay;
                  }
                  
                  const totalRR = historicalRR + result.rr;
                  
                  this.plugin.settings.activitySnapshots[habit.id] = {
                    activityId: habit.id,
                    disabledDate: todayISO(),
                    frozenRR: totalRR,
                    frozenStreak: result.streak
                  };
                }
                
                if (!aboutToDisable && v) {
                  delete this.plugin.settings.activitySnapshots[habit.id];
                }
                
                habit.enabled = v;
                await this.plugin.saveSettings();
                this.plugin.refreshRankView();
              })
          );

        // Name
        new Setting(box)
          .setName("Name")
          .addText(t =>
            t
              .setPlaceholder("Habit name")
              .setValue(habit.name)
              .onChange(async v => {
                habit.name = v;
                await this.plugin.saveSettings();
              })
          );

        // Folder
        new Setting(box)
          .setName("Folder")
          .setDesc("Folder containing 'YYYY-MM-DD' notes") // This is required because it explains the format in which the notes are stored.
          .addText(t =>
            t
              .setPlaceholder("'01 Daily Journal'") // This is the name of the folder and a suggestion for the user.
              .setValue(habit.folder)
              .onChange(async v => {
                habit.folder = v;
                await this.plugin.saveSettings();
              })
          );

        // Property
        new Setting(box)
          .setName("Property")
          .setDesc("Checkbox property name")
          .addText(t =>
            t
              .setPlaceholder("Workout")
              .setValue(habit.field)
              .onChange(async v => {
                habit.field = v;
                await this.plugin.saveSettings();
              })
          );

        // RR per day
        new Setting(box)
          .setName("RR / day") // RR is an abbreviation for Rank Rating; it is necessary for it to be RR.
          .addText(t =>
            t
              .setValue(String(habit.rrPerDay))
              .onChange(async v => {
                habit.rrPerDay = Number(v) || 0;
                await this.plugin.saveSettings();
                this.plugin.refreshRankView();
              })
          );

        // Penalty per day
        new Setting(box)
          .setName("Penalty per day")
          .addText(t =>
            t
              .setValue(String(habit.penaltyPerDay))
              .onChange(async v => {
                habit.penaltyPerDay = Number(v) || 0;
                await this.plugin.saveSettings();
                this.plugin.refreshRankView();
              })
          );

        // Delete
        new Setting(box)
          .addButton(btn =>
            btn
              .setButtonText("Delete")
              .setWarning()
              .onClick(async () => {
                this.plugin.settings.customHabits.splice(index, 1);
                await this.plugin.saveSettings();
                this.display();
                this.plugin.refreshRankView();
              })
          );

        new Setting(box)
          .setName("Tracking mode")
          .setDesc("Daily = consecutive days, weekly = 1+ per week")
          .addDropdown(d =>
            d
              .addOption('daily', 'Daily')
              .addOption('weekly', 'Weekly')
              .setValue(habit.trackingMode || 'daily')
              .onChange(async v => {
                habit.trackingMode = v as 'daily' | 'weekly';
                await this.plugin.saveSettings();
                this.plugin.refreshRankView();
              })
          );

        if (habit.trackingMode === 'weekly') {
        new Setting(box)
          .setName("RR / week") // RR is an abbreviation for Rank Rating; it is necessary for it to be RR.
          .addText(t =>
            t
              .setValue(String(habit.rrPerWeek || 7))
              .onChange(async v => {
                habit.rrPerWeek = Number(v) || 0;
                await this.plugin.saveSettings();
                this.plugin.refreshRankView();
              })
          );
      }
      });
  }
}

class TrackStatsView extends ItemView {
  plugin: TrackHabitRankPlugin;
  
  constructor(leaf: WorkspaceLeaf, plugin: TrackHabitRankPlugin) {
    super(leaf);
    this.plugin = plugin;
  }
  
  getViewType() { return VIEW_TYPE_STATS; }
  getDisplayText() { return "Rank stats"; }
  
  async onOpen(): Promise<void> {
    this.render();
  }
  
  render() {
    const el = this.contentEl;
    el.empty();
    const snapshots = this.plugin.settings.snapshots ?? [];
    
    new Setting(el)
      .setName("Rank snapshots")
      .setHeading();
    
    if (snapshots.length === 0) {
      el.createEl("div", { text: "No snapshots yet." });
      return;
    }
    
    const table = el.createEl("table");
    const head = table.createEl("tr");
    ["Time", "Rank", "Total RR"].forEach(h =>
      head.createEl("th", { text: h })
    );
    
    snapshots.slice().reverse().forEach(s => {
      const row = table.createEl("tr");
      row.createEl("td", { text: new Date(s.timestamp).toLocaleString() });
      row.createEl("td", { text: s.rank });
      row.createEl("td", { text: String(s.totalRR) });
    });
  }
}

class RangeSelectModal extends Modal {
  onSubmit: (days: number) => void;

  constructor(app: App, onSubmit: (days: number) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    new Setting(contentEl)
      .setName("Generate rank analysis")
      .setHeading();

    contentEl.createEl("button", {
      text: "Generate",
    })

    const input = contentEl.createEl("input", {
      type: "number",
      attr: {
        placeholder: "Days (e.g. 7, 30, 90)",
        style: "width: 100%; margin-bottom: 12px;"
      }
    });

    contentEl.createEl("button", {
      text: "Generate",
      attr: { style: "width: 100%;" }
    }).onclick = () => {
      const days = Number(input.value);
      if (!days || days <= 0) return;
      this.close();
      this.onSubmit(days);
    };
  }
}

/* ======================
   PLUGIN
====================== */

export default class TrackHabitRankPlugin extends Plugin {
  settings!: TrackRankSettings;

  async onload() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData()
    );

    this.registerView(
      VIEW_TYPE_RANK,
      (leaf) => new TrackRankView(leaf, this)
    );

    this.registerView(
      VIEW_TYPE_STATS,
      leaf => new TrackStatsView(leaf, this)
    );

    const refresh = debounce(async () => {
      await this.saveSettings();
      this.refreshRankView();
    }, 300);

    this.registerEvent(
      this.app.metadataCache.on("changed", refresh)
    );

    this.addCommand({
      id: "open-Track-rank",
      name: "Open rank dashboard",
      callback: () => this.activateView()
    });

    this.addCommand({
      id: "capture-rank-snapshot",
      name: "Capture rank snapshot",
      callback: async () => {
        const snapshot = buildSnapshot(this.app, this.settings);
        this.settings.snapshots.push(snapshot);
        await this.saveSettings();
        new Notice("Rank snapshot saved");
      }
    });

    this.addCommand({
      id: "open-rank-stats",
      name: "Open rank stats",
      callback: () => {
        const leaf = this.app.workspace.getRightLeaf(false);
        if (leaf) {
          void leaf.setViewState({ type: VIEW_TYPE_STATS, active: true });
        }
      }
    });

    this.addCommand({
      id: "generate-rank-analysis-30d",
      name: "Generate rank analysis (last 30 days)",
      callback: () => void generateRankAnalysisNote(this.app, 30)
    });

    this.addCommand({
      id: "generate-rank-analysis",
      name: "Generate rank analysis",
      callback: () => {
        new RangeSelectModal(this.app, (days) => {
          void generateRankAnalysisNote(this.app, days);
        }).open();
      }
    });

    this.addSettingTab(new TrackRankSettingTab(this.app, this));
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_RANK)[0];
    
    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (!rightLeaf) return;
      await rightLeaf.setViewState({ type: VIEW_TYPE_RANK, active: true });
      leaf = rightLeaf;
    }
    
    await workspace.revealLeaf(leaf);
  }

  refreshRankView() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_RANK);
    leaves.forEach(leaf => {
      const view = leaf.view as TrackRankView;
      view.render();
    });
  }

  onunload() {
}
}
