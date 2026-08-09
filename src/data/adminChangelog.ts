export interface ChangelogEntry {
  id: string;
  date: string;
  title: string;
  summary: string;
  changes: string[];
}

export const adminChangelog: ChangelogEntry[] = [
  {
    id: "gazette-category-filters",
    date: "2026-08-09",
    title: "Cleaned up Gazette story categories",
    summary:
      "Power Rankings is no longer an article category, and the public Gazette now shows only filters that have stories to read.",
    changes: [
      "Removed Power Rankings from the category choices used for new Gazette articles.",
      "Kept older Power Rankings stories intact and editable without making the category available for new stories.",
      "Updated the public category bar to hide empty categories and include active categories represented by published stories.",
    ],
  },
  {
    id: "matchup-player-statuses",
    date: "2026-08-09",
    title: "Added player availability notes to current matchups",
    summary:
      "The matchup lineup view now highlights useful Sleeper updates such as Questionable, Out, and Injured Reserve.",
    changes: [
      "Added player availability information to the matchup lineup data returned from Sleeper records.",
      "Showed a small status badge beside players in the current season's active or upcoming matchup weeks.",
      "Kept older completed matchups and historical seasons free of current-status labels so archived games are not misleading.",
    ],
  },
  {
    id: "matchup-desktop-alignment",
    date: "2026-08-09",
    title: "Aligned matchup cards on wider screens",
    summary:
      "Desktop matchup cards now keep team names and scores lined up even when one team has a much longer name.",
    changes: [
      "Gave the two team identity areas a shared desktop rhythm so long and short names begin consistently.",
      "Aligned both scores along the same baseline on larger screens.",
      "Kept the stacked mobile layout unchanged, where the original spacing already worked well.",
    ],
  },
  {
    id: "contributor-category-access",
    date: "2026-08-09",
    title: "Kept contributor stories in the Op-Ed lane",
    summary:
      "Op-Ed contributors now see only the categories they are allowed to use when drafting a story.",
    changes: [
      "Removed the brief flash of admin-only category choices while the story editor checks an account.",
      "Kept the full category selector available to administrators while showing contributors only the approved Op-Ed categories.",
      "Retained the database safeguard that rejects contributor stories submitted outside the Op-Ed category.",
    ],
  },
  {
    id: "gazette-comments",
    date: "2026-08-09",
    title: "Opened Gazette stories to reader conversation",
    summary:
      "Signed-in readers can now share their thoughts directly on published stories, with the same familiar formatting tools used by the editorial team.",
    changes: [
      "Added a reader comment section to every published Gazette story; comments appear immediately after they are posted.",
      "Let readers edit their own comments while keeping other readers' comments protected from changes.",
      "Added bold, italic, underline, links, images, headings, lists, quotes, dividers, and undo/redo to the comment editor.",
      "Stored formatted comments securely and limited comment access to published stories and the signed-in reader who owns each comment.",
    ],
  },
  {
    id: "reader-poll-workflow",
    date: "2026-08-09",
    title: "Made Reader Poll voting clearer and fairer",
    summary:
      "Readers now vote only on the current week, with private ballots and a separate archive for completed editions.",
    changes: [
      "Updated the poll to say ‘Rank all league teams’ so it remains accurate if the league size changes.",
      "Separated the current-week ballot from previous-week results and prevented submissions for past or future weeks.",
      "Kept current votes hidden until the voting window closes, including at the database access level.",
      "Removed sign-in and account-creation links for readers who are already signed in.",
    ],
  },
  {
    id: "historical-lineups",
    date: "2026-08-09",
    title: "Completed the 2022 and 2023 league archives",
    summary:
      "The historical seasons now work across the public archive, including player-level lineup records and franchise history.",
    changes: [
      "Added 2022 and 2023 matchup, standings, roster, draft, transaction, and record data to the public archive.",
      "Connected historical team names to their current franchise profiles while preserving the names used in each older season.",
      "Built Weekly Perfect Lineup and Positional Record Lineup views from the player scores captured in historical matchup rosters.",
      "Added archived roster views to team profiles and expanded the season selectors to include 2022 and 2023.",
    ],
  },
  {
    id: "changelog-formatting",
    date: "2026-08-09",
    title: "Polished the changelog update cards",
    summary:
      "The private change history is now easier to scan, with each update presented as its own readable card.",
    changes: [
      "Separated update numbers and references so they no longer run together.",
      "Added clearer card borders, spacing, shadows, and headings.",
      "Improved the layout for both wide screens and smaller devices.",
    ],
  },
  {
    id: "admin-changelog",
    date: "2026-08-09",
    title: "Added a private website changelog",
    summary:
      "Administrators now have one place to review what changed on the website and why it matters.",
    changes: [
      "Added an administrator-only Changelog page to the editorial portal.",
      "Protected changelog details behind the same account checks used by other administrative tools.",
      "Established a plain-language format for recording future website updates by date.",
    ],
  },
  {
    id: "8e5da804",
    date: "2026-08-09",
    title: "Made buttons feel more responsive",
    summary:
      "Buttons now give clearer visual feedback when someone points to or presses them.",
    changes: [
      "Changed the mouse cursor to a pointer when hovering over an available button.",
      "Added a brief pressed animation so clicks are easier to recognize.",
      "Kept movement disabled for visitors who prefer reduced motion.",
    ],
  },
  {
    id: "19a6fea2",
    date: "2026-08-09",
    title: "Recorded the production review",
    summary:
      "The project handbook now records which important live-site pages and account safeguards were checked after deployment.",
    changes: [
      "Documented the successful production walkthrough.",
      "Recorded the deployed version so future releases have a known comparison point.",
    ],
  },
  {
    id: "e9f22522",
    date: "2026-08-09",
    title: "Restored the 2022 and 2023 league archives",
    summary:
      "Earlier league seasons now have the historical information needed by public archive pages.",
    changes: [
      "Added legacy matchup, roster, transaction, team, and draft records for 2022 and 2023.",
      "Expanded historical coverage without changing current-season data.",
    ],
  },
  {
    id: "ba2fa607",
    date: "2026-08-09",
    title: "Added a complete project handbook and recovery reference",
    summary:
      "The website's setup, publishing workflow, data sources, and recovery information are now documented in one maintained handbook.",
    changes: [
      "Documented the website architecture, editorial workflow, database, deployment, and development process.",
      "Added a verified copy of the production database structure for recovery and comparison.",
      "Recorded known operational gaps so they can be addressed safely over time.",
    ],
  },
  {
    id: "b4adfa5b",
    date: "2026-08-09",
    title: "Recorded the preview deployment review",
    summary:
      "The handbook now records the checks completed against the preview version before it reached the live site.",
    changes: [
      "Documented preview behavior across representative public and administrative pages.",
      "Captured the verification result for future release comparisons.",
    ],
  },
];
