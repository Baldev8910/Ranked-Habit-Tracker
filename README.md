# Ranked Habit Tracker

> **Note:** Some features like Rank Analysis Reports are currently in beta testing and may not function correctly. Stick to the main rank tracking features for stable functionality.

Ranked Habit Tracker is a plugin that tracks and ranks you based on your habits. This plugin contains RR (Rank Rating) that manages and decides your rank. The ranks take inspiration from Valorant.

This plugin can help you build habit for over a long term and keep you competitive. The gamified style can help you push yourself to the edge.

---

## How to Use?

![Rank display showing current tier and progress, featuring a rank icon on the left with the tier name displayed alongside a progress bar indicating RR points toward the next rank threshold](assets/preview.png)
![Settings panel with date 2025-12-23 at top, Properties section listing 13 default habit checkboxes (DJournal, Masturbation Avoidance checked, GTG, Study, Research, Gaming, waterPlants, Medicine, AcaResearch unchecked), and Add property option at bottom](assets/preview_2.png)

You will need to set your habits in the properties in checkbox style. Numerical and alphabetical values will not work. Might add in the next update.

Disable all the default habits in the settings and add your own. You can name your habit anything. Then, you need to specify the folder your daily notes are stored in. Make sure your notes are saved in `YYYY-MM-DD` format. No other format will work. Add the field (or name of the property) you are tracking. You can customize `RR per Day` and `Penalty per Day` as per your liking. You can also change the `Tracking Mode` from `Daily` to `Weekly`.

You can open and see your rank by pressing a keyboard shortcut that you will have to set yourself from the commands. I have it set as `Alt + V`. You can set as per your comfort and requirements.

The plugin will open on the right sidebar of the Obsidian window. It will show you the rank your are on and how many RR are required to climb up the next rank.

When you skip a habit for more than 2 days, you will start gaining penalties (as per the value you set in `Penalty per Day`). Your RR count will decrease if you skip the habits for too long and thus your rank will decrease.

**Grace Period Rules:**

- Missing 1 day: Streak continues
- Missing 2 days: Streak continues
- Missing 3+ days: Streak breaks, penalty apply

**Example:**

- Complete activity Monday through Friday: 5-day streak
- Miss Saturday: Grace period (streak intact)
- Miss Sunday: Still within grace period (streak intact)
- Miss Monday: Streak broken on this day

### Daily RR Calculation

```markdown
Activity RR = Current Streak Length × RR per Day
```

**Example Calculation:**

```markdown
10-day streak = 10 days × 1 RR = 10 RR
```

### Weekly RR Calculation

```markdown
Activity RR = Consecutive Weeks Completed × RR per Week
```

**Example Calculation:**

- Completed Research in 5 consecutive weeks = 5 weeks × 7 RR = 35 RR
- If you skip a week, the streak breaks and starts over

---

## Quick Start

1. Install the plugin and enable it
2. Open Settings → Ranked Habit Tracker
3. Disable all default habits (or keep ones you want)
4. Click "Add Custom Habit" for each habit you track
5. Set your keyboard shortcut (recommended: `Alt + V`)
6. Press your shortcut to view your rank!

---

## Penalty System

- Activities never started: 0 RR (no penalty)
- Activities with active streaks: Positive RR
- Activities with broken streaks: Net RR after penalties (may be negative)

**Penalty Calculation:**

```markdown
Penalty Days = Days Since Last Completion - 2 (grace period)

Total Penalty = Penalty Days × Penalty Rate

Net RR = Earned RR from Past Streak - Total Penalty

Net RR is capped at: Maximum(-Earned RR, Net RR)
```

**Default penalty rate** is -2 RR per day beyond grace period.

### Penalty Examples

**Example 1 - Standard Activity (Moderate Penalty):**

- Built a 15-day workout streak: +15 RR earned
- Stopped working out for 6 days
- Penalty days: 6 - 2 = 4 days
- Penalty applied: 4 × 2 = -8 RR
- Net RR: 15 - 8 = +7 RR

**Example 2 - No Fap (Moderate Penalty):**

- Built a 20-day streak: +100 RR earned
- Broke streak, 5 days since last completion
- Penalty days: 5 - 2 = 3 days
- Penalty applied: 3 × 5 = -15 RR
- Net RR: 100 - 15 = +85 RR

**Example 3 - Severe Penalty:**

- Built a 10-day workout streak: +10 RR earned
- Stopped working out for 15 days
- Penalty days: 15 - 2 = 13 days
- Penalty applied: 13 × 2 = -26 RR
- Net RR: 10 - 26 = **-16 RR**

---

## Total RR Calculation

Your total RR is split into two components:

1. **Live RR**: Current active streaks and penalties
2. **Historical RR**: Immutable RR from past completed days outside current streaks

```markdown
Total RR = Live RR + Historical RR
```

**Historical RR Example:**

- You built a 30-day workout streak and completed it
- Now you're on a fresh 5-day streak
- Historical RR: 25 days × 1 RR = 25 RR (immutable)
- Live RR: 5 days × 1 RR = 5 RR (can decay)
- Total: 30 RR

---

## Rank Icons

| Rank          | Icon                                                         | Tier | RR Required |
| ------------- | ------------------------------------------------------------ | ---- | ----------- |
| Unranked      | ![Unranked](assets/ranks/Unranked.png)                       | 0    | 0           |
| Iron I        | ![Iron I](assets/ranks/Iron_1_Rank.png)                      | 1    | 50          |
| Iron II       | ![Iron II](assets/ranks/Iron_2_Rank.png)                     | 2    | 100         |
| Iron III      | ![Iron III](assets/ranks/Iron_3_Rank.png)                    | 3    | 150         |
| Bronze I      | ![Bronze I](assets/ranks/Bronze_1_Rank.png)                  | 4    | 200         |
| Bronze II     | ![Bronze II](assets/ranks/Bronze_2_Rank.png)                 | 5    | 250         |
| Bronze III    | ![Bronze III](assets/ranks/Bronze_3_Rank.png)                | 6    | 300         |
| Silver I      | ![Silver I](assets/ranks/Silver_1_Rank.png)                  | 7    | 350         |
| Silver II     | ![Silver II](assets/ranks/Silver_2_Rank.png)                 | 8    | 400         |
| Silver III    | ![Silver III](assets/ranks/Silver_3_Rank.png)                | 9    | 450         |
| Gold I        | ![Gold I](assets/ranks/Gold_1_Rank.png)                      | 10   | 500         |
| Gold II       | ![Gold II](assets/ranks/Gold_2_Rank.png)                     | 11   | 550         |
| Gold III      | ![Gold III](assets/ranks/Gold_3_Rank.png)                    | 12   | 600         |
| Platinum I    | ![Platinum I](assets/ranks/Platinum_1_Rank.png)              | 13   | 650         |
| Platinum II   | ![Platinum II](assets/ranks/Platinum_2_Rank.png)             | 14   | 700         |
| Platinum III  | ![Platinum III](assets/ranks/Platinum_3_Rank.png)            | 15   | 750         |
| Diamond I     | ![Diamond I](assets/ranks/Diamond_1_Rank.png)                | 16   | 800         |
| Diamond II    | ![Diamond II](assets/ranks/Diamond_2_Rank.png)               | 17   | 850         |
| Diamond III   | ![Diamond III](assets/ranks/Diamond_3_Rank.png)              | 18   | 900         |
| Ascendant I   | ![Ascendant I](assets/ranks/Ascendant_1_Rank.png)            | 19   | 950         |
| Ascendant II  | ![Ascendant II](assets/ranks/Ascendant_2_Rank.png)           | 20   | 1000        |
| Ascendant III | ![Ascendant III](assets/ranks/Ascendant_3_Rank.png)          | 21   | 1050        |
| Immortal I    | ![Immortal I](assets/ranks/Immortal_1_Rank.png)              | 22   | 1100        |
| Immortal II   | ![Immortal II](assets/ranks/Immortal_2_Rank.png)             | 23   | 1150        |
| Immortal III  | ![Immortal III](assets/ranks/Immortal_3_Rank.png)            | 24   | 1200        |
| Radiant       | ![Radiant](assets/ranks/Radiant_Rank.png)                    | 25   | 1250        |

---

## Demotion Protection (Grace Period)

The plugin includes a **rank demotion grace period** to prevent immediate rank loss:

**Default Settings:**

- **Grace RR**: 20 RR below rank threshold
- **Grace Days**: 3 days

**How It Works:**

1. If your Total RR drops below your current rank threshold, a grace timer starts
2. You have 3 days to recover back to the rank threshold
3. If you're within 20 RR of the threshold, your rank is frozen during grace period
4. After 3 days without recovery, demotion occurs
5. A red warning indicator appears during the grace period

**Example:**

- You're Gold I (500 RR required)
- Your RR drops to 485 RR (15 below threshold, within 20 RR grace)
- Grace period activates: you have 3 days to get back to 500+ RR
- Your rank displays as Gold I with a "⬇ Rank under pressure" warning
- Progress bar turns red during grace period

---

## Demotion Floor

You cannot freefall through ranks. If your RR drops significantly, your **effective RR is clamped** at the previous rank's threshold:

**Example:**

- You're at Gold II (550 RR)
- Penalties drop you to 470 RR
- Your effective RR is clamped at 500 RR (Gold I threshold)
- You display as Gold I, not Bronze III
- Progress bar shows 0% toward Gold II

---

## Plugin Features

### Main Rank View

The main dashboard displays:

- **Current Rank**: Visual rank icon with name
- **Total RR**: Your accumulated rating points
- **Progress Bar**: Visual progress to next rank (color-coded by tier)
- **RR Needed**: Exact points required for next rank
- **Demotion Warning**: Alert if in grace period
- **Active Penalties**: List of activities currently penalized

**Opening the Rank View:**

- Command Palette: "Open Valorant Rank Dashboard"
- Appears in right sidebar

### Custom Habits

Add unlimited custom habits beyond the default 13:

**Configurable Settings:**

- Habit name
- Folder path (where daily notes are stored)
- Property name (checkbox field in frontmatter)
- RR per day/week
- Penalty per day (for daily tracking)
- Tracking mode (daily or weekly)
- Enable/disable toggle

**How It Works:**

1. Go to plugin settings
2. Click "Add Custom Habit"
3. Configure folder, property, and RR values
4. The habit immediately starts tracking

---

## Installation

**From GitHub Releases:**

1. Download the latest release from [Releases](link)
2. Extract to `.obsidian/plugins/valorant-habit-rank/`
3. Restart Obsidian
4. Enable in Settings → Community Plugins

**Manual Installation:**

1. Clone this repository into `.obsidian/plugins/`
2. Run `npm install` and `npm run build`
3. Restart Obsidian
4. Enable in Settings → Community Plugins

### Requirements

- Obsidian
- Daily notes with YYYY-MM-DD format filenames
- Checkbox properties in note frontmatter

### Configuring Your Vault

The plugin expects daily notes in specific folders with checkbox properties:

**Example Folder Structure:**

```markdown
01 Daily Journal/
  2024-12-20.md
  2024-12-21.md
02 Workout/
  2024-12-20.md
  2024-12-21.md
03 Guitar Practice/
  2024-12-20.md
  ...
```

**Example Daily Note (Frontmatter):**

```yaml
---
DJournal: true
Workout: true
Guitar: false
Python: true
Cardio: true
Reading: false
MasturbationAvoided: true
GTG: true
Study: true
Research: true
Gaming: false
waterPlants: true
Medicine: true
---

# 2024-12-20

Your daily note content...
```

### Adjusting Default Settings

Edit `main.ts` to customize:

**RR Values:**

```typescript
{
  name: "Workout",
  folder: "02 Workout",
  field: "Workout",
  rrPerDay: 2,        // Change from 1 to 2
  penaltyPerDay: 3    // Change from 2 to 3
}
```

**Grace Period:**

```typescript
const DEFAULT_SETTINGS: ValorantRankSettings = {
  rankGraceRR: 30,      // Change from 20
  rankGraceDays: 5,     // Change from 3
  ...
}
```

---

## Available Commands

| Command | Description |
| --------- | ------------- |
| Open Valorant Rank Dashboard | Opens main rank view |
| Capture Rank Snapshot | Saves current state |
| Open Rank Stats | Views snapshot history |
| Generate Rank Analysis (Last 30 Days) | Creates 30-day report |
| Generate Rank Analysis | Creates custom report |

---

## Strategic Insights

### Optimal RR Accumulation

**Fastest Path to Higher Ranks:**

1. Prioritize high-value activities (No Fap = 5 RR/day)
2. Maintain multiple simultaneous streaks
3. Never let daily streaks exceed 2-day grace period
4. Build long streaks before any planned breaks
5. Weekly activities provide steady RR with no penalty risk

**RR Efficiency:**

- Maximum daily RR potential: 18 RR (all 13 activities daily)
- Maximum weekly RR potential: 133 RR per week (18 × 7 + 7 Research)
- No Fap contributes 27.8% of maximum daily RR
- Research provides 5.3% of maximum weekly RR for minimal effort

### Penalty Minimization

**Recovery Strategy:**

- Resume broken activities immediately to minimize penalty accumulation
- Each additional day beyond grace period increases penalty
- Consider disabling activities you know you'll skip (preserves frozen RR)
- Weekly tracked activities have no penalties—great for irregular habits

**Critical Thresholds:**

- Standard activity: Every 2 penalty days negates 1 day of past streak (2:1 ratio)
- No Fap: Every 1 penalty day negates 1 day of past streak (1:1 ratio)

### Rank Climbing Estimates

**Approximate Timeline (assuming 100% consistency):**

- Iron I to Bronze III: ~14 days
- Iron I to Silver III: ~22 days
- Iron I to Gold III: ~30 days
- Iron I to Platinum III: ~39 days
- Iron I to Diamond III: ~47 days
- Iron I to Immortal III: ~64 days
- Iron I to Radiant: ~67 days

_Note: These estimates assume perfect daily completion of all activities with no penalties applied._

---

## Technical Notes

### Data Sources

The system queries markdown files in your vault folders based on:

- Filename format: `YYYY-MM-DD.md`
- Frontmatter properties: Boolean checkbox fields
- Folder structure: Configurable per activity

### Real-Time Updates

The ranking system recalculates automatically when:

- Metadata cache changes (checkbox toggled in any note)
- Settings are modified
- Dashboard is refreshed

Debouncing (300ms) prevents excessive recalculation.

### Streak Counting Logic

- Daily streaks count backwards from most recent completion
- Weekly streaks use ISO week numbers (Monday start)
- Grace period is strict: exactly 2 calendar days
- Historical RR excludes current streak days (prevents double-counting)

### Storage

All plugin data is stored in:

- `.obsidian/plugins/valorant-habit-rank/data.json`

This includes:

- Enabled/disabled activities
- Custom habits configuration
- Rank grace settings
- Activity snapshots (frozen RR)
- Rank snapshot history

---

## Beta Features

The following features are currently in testing and may not work as expected:

### Rank Analysis Reports (Beta)

Generate detailed activity reports with visual heatmaps. This feature is experimental and may have issues.

**Commands:**

- "Generate Rank Analysis (Last 30 Days)" - Quick 30-day report
- "Generate Rank Analysis" - Custom date range

**Known Issues:**

- Report generation may fail for large date ranges
- Heatmap visualization may not render correctly
- Some activities may not appear in reports

**Note:** This feature is under active development. Use at your own risk and please report any bugs you encounter.

---

## Frequently Asked Questions

**Q: Can my Total RR go negative?**  
A: Yes, Total RR can go negative if accumulated penalties exceed earned RR. However, you'll remain at Iron I (0 RR) until Total RR becomes positive again.

**Q: What happens if I rank up then immediately break streaks?**  
A: Your rank will decrease if penalties push your Total RR below the current rank threshold. The grace period gives you 3 days to recover.

**Q: Do penalties compound over time?**  
A: Yes, each additional day beyond the grace period adds more penalty RR. There is no cap—penalties can exceed earned RR.

**Q: Is there a maximum RR cap?**  
A: No, you can accumulate RR indefinitely beyond Radiant (1200 RR).

**Q: How do I add activities from different folders?**  
A: Use Custom Habits in settings. You can track any checkbox property from any folder.

**Q: Can I track the same property from multiple folders?**  
A: No, each habit tracks one folder/property combination. Create separate custom habits if needed.

**Q: What happens to my RR if I disable an activity?**  
A: The plugin captures a "snapshot" of the activity's current RR (both live and historical) and adds it to your Historical RR. Your Total RR is preserved. If you re-enable the activity, it starts tracking from a fresh streak.

**Q: Can I change RR values after I've started tracking?**  
A: Yes, but it only affects future calculations. Past Historical RR remains unchanged.

**Q: How do I backup my progress?**  
A: Copy the `data.json` file from the plugin folder. All settings, snapshots, and grace period state are stored there.

**Q: Can I use weekly tracking for activities that need daily consistency?**  
A: Not recommended. Weekly tracking is best for activities like "Research" or "Meal Prep" where frequency matters less than regular completion.

**Q: What's the difference between Live RR and Historical RR?**  
A: Live RR comes from your current active streaks (can decay with penalties). Historical RR is immutable and comes from past completed days outside your current streaks. Total RR = Live RR + Historical RR.

---

## Version Information

**Plugin Version:** 2.0  
**Last Updated:** December 2024  
**Compatibility:** Obsidian v1.0.0+

**Major Features in v2.0:**

- Weekly tracking mode (in addition to daily)
- Rank demotion grace period (3 days + 20 RR buffer)
- Demotion floor (prevents rank freefall)
- Custom habits with unlimited configuration
- Real-time dashboard updates

---

## Credits

Inspired by Valorant's competitive ranking system. Rank icons from Valorant (Riot Games).
