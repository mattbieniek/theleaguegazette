import { n as __exportAll, t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { T as createAstro, _ as addAttribute, a as Fragment, d as renderTemplate, h as maybeRenderHead, i as renderComponent } from "./server_C1dVeAgT.mjs";
import { n as renderScript, t as $$BaseLayout } from "./BaseLayout_DEOVcEwA.mjs";
import { createClient } from "@supabase/supabase-js";
var supabase = createClient("https://ycozdpdabtxukygkovgd.supabase.co", "sb_publishable_u4gM7rF8ImnuZCVV13oDbA_YkwPD9jE", { auth: {
	persistSession: false,
	autoRefreshToken: false,
	detectSessionInUrl: false
} });
//#endregion
//#region src/lib/queries/awards.ts
function toNumber(value) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}
function toOptionalNumber(value) {
	if (value === null || value === void 0 || value === "") return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}
function getAvailableSeasons(weekOptions) {
	return Array.from(new Set(weekOptions.map((option) => option.seasonYear))).sort((first, second) => second - first);
}
function normalizeResult(row) {
	return {
		matchup_id: String(row.matchup_id ?? ""),
		season_year: toNumber(row.season_year),
		week: toNumber(row.week),
		sleeper_matchup_id: toNumber(row.sleeper_matchup_id),
		fantasy_team_id: String(row.fantasy_team_id ?? ""),
		team_name: String(row.team_name ?? "").trim() || "Unknown Team",
		opponent_fantasy_team_id: typeof row.opponent_fantasy_team_id === "string" ? row.opponent_fantasy_team_id : null,
		opponent_team_name: typeof row.opponent_team_name === "string" ? row.opponent_team_name.trim() : null,
		points_for: toNumber(row.points_for),
		points_against: toNumber(row.points_against),
		point_differential: toNumber(row.point_differential),
		starters_points: toNumber(row.starters_points),
		bench_points: toNumber(row.bench_points),
		result: String(row.result ?? ""),
		is_winner: Boolean(row.is_winner),
		is_tie: Boolean(row.is_tie)
	};
}
async function getAwardsWeekOptions() {
	const { data, error } = await supabase.from("team_weekly_results").select(`
        season_year,
        week,
        matchup_id
      `).order("season_year", { ascending: false }).order("week", { ascending: false });
	if (error) throw new Error(`Unable to load Awards weeks: ${error.message}`);
	const grouped = /* @__PURE__ */ new Map();
	for (const row of data ?? []) {
		const seasonYear = toNumber(row.season_year);
		const week = toNumber(row.week);
		const key = `${seasonYear}-${week}`;
		const existing = grouped.get(key) ?? {
			seasonYear,
			week,
			teamResults: 0,
			matchupIds: /* @__PURE__ */ new Set()
		};
		existing.teamResults += 1;
		if (row.matchup_id) existing.matchupIds.add(String(row.matchup_id));
		grouped.set(key, existing);
	}
	return Array.from(grouped.values()).map((group) => ({
		seasonYear: group.seasonYear,
		week: group.week,
		teamResults: group.teamResults,
		matchupCount: group.matchupIds.size,
		isComplete: group.teamResults >= 10
	})).sort((first, second) => {
		if (first.seasonYear !== second.seasonYear) return second.seasonYear - first.seasonYear;
		return second.week - first.week;
	});
}
async function getWeeklyAwardsResults(seasonYear, week) {
	const { data, error } = await supabase.from("team_weekly_results").select(`
        matchup_id,
        season_year,
        week,
        sleeper_matchup_id,
        fantasy_team_id,
        team_name,
        opponent_fantasy_team_id,
        opponent_team_name,
        points_for,
        points_against,
        point_differential,
        starters_points,
        bench_points,
        result,
        is_winner,
        is_tie
      `).eq("season_year", seasonYear).eq("week", week).order("sleeper_matchup_id", { ascending: true });
	if (error) throw new Error(`Unable to load weekly Awards data: ${error.message}`);
	return (data ?? []).map((row) => normalizeResult(row));
}
async function getAwardsPageData(selection = {}) {
	const weekOptions = await getAwardsWeekOptions();
	const seasons = getAvailableSeasons(weekOptions);
	const requestedSeason = toOptionalNumber(selection.season);
	const requestedWeek = toOptionalNumber(selection.week);
	const requestedOption = requestedSeason !== null && requestedWeek !== null ? weekOptions.find((option) => option.seasonYear === requestedSeason && option.week === requestedWeek) ?? null : null;
	const requestedSeasonDefault = requestedSeason !== null ? weekOptions.find((option) => option.seasonYear === requestedSeason && option.isComplete) ?? weekOptions.find((option) => option.seasonYear === requestedSeason) ?? null : null;
	const selectedOption = requestedOption ?? requestedSeasonDefault ?? weekOptions.find((option) => option.isComplete) ?? weekOptions[0] ?? null;
	return {
		weekOptions,
		seasons,
		selectedOption,
		selectedSeasonOptions: selectedOption ? weekOptions.filter((option) => option.seasonYear === selectedOption.seasonYear) : [],
		results: selectedOption ? await getWeeklyAwardsResults(selectedOption.seasonYear, selectedOption.week) : []
	};
}
//#endregion
//#region src/lib/gazette/awards.ts
function formatPoints(value) {
	return value.toFixed(2);
}
function getHighest(rows, getValue) {
	return [...rows].sort((first, second) => getValue(second) - getValue(first))[0] ?? null;
}
function getLowest(rows, getValue) {
	return [...rows].sort((first, second) => getValue(first) - getValue(second))[0] ?? null;
}
function getUniqueMatchups(results) {
	return Array.from(new Map(results.map((result) => [result.matchup_id, result])).values());
}
function buildWeeklyAwards(results, week) {
	if (results.length === 0) return [];
	const winners = results.filter((result) => result.result === "W");
	const losers = results.filter((result) => result.result === "L");
	const uniqueMatchups = getUniqueMatchups(results);
	const highestScore = getHighest(results, (result) => result.points_for);
	const lowestScore = getLowest(results, (result) => result.points_for);
	const biggestBlowout = getHighest(winners, (result) => result.point_differential);
	const closestMatchup = getLowest(uniqueMatchups, (result) => Math.abs(result.point_differential));
	const highestScoringLoss = getHighest(losers, (result) => result.points_for);
	const lowestScoringWin = getLowest(winners, (result) => result.points_for);
	const bestBench = getHighest(results, (result) => result.bench_points);
	const awards = [];
	if (highestScore) awards.push({
		id: "performance-of-the-week",
		symbol: "★",
		label: "Performance of the Week",
		title: "The Golden Box Score",
		teamName: highestScore.team_name,
		opponentName: highestScore.opponent_team_name,
		teamScore: highestScore.points_for,
		opponentScore: highestScore.points_against,
		primaryValue: `${formatPoints(highestScore.points_for)} points`,
		description: highestScore.result === "W" ? `${highestScore.team_name} posted the highest total of Week ${week} and converted it into a victory.` : `${highestScore.team_name} produced the week's highest score but still walked away without a win.`,
		tone: "positive"
	});
	if (lowestScore) awards.push({
		id: "lowest-score",
		symbol: "↓",
		label: "Low-Water Mark",
		title: "The Paper Bag",
		teamName: lowestScore.team_name,
		opponentName: lowestScore.opponent_team_name,
		teamScore: lowestScore.points_for,
		opponentScore: lowestScore.points_against,
		primaryValue: `${formatPoints(lowestScore.points_for)} points`,
		description: `${lowestScore.team_name} finished Week ${week} with the league's lowest point total.`,
		tone: "negative"
	});
	if (biggestBlowout) awards.push({
		id: "biggest-blowout",
		symbol: "+",
		label: "Largest Margin",
		title: "The Steamroller",
		teamName: biggestBlowout.team_name,
		opponentName: biggestBlowout.opponent_team_name,
		teamScore: biggestBlowout.points_for,
		opponentScore: biggestBlowout.points_against,
		primaryValue: `+${formatPoints(biggestBlowout.point_differential)}`,
		description: `${biggestBlowout.team_name} delivered the week's largest margin of victory.`,
		tone: "positive"
	});
	if (closestMatchup) {
		const winningTeamName = closestMatchup.result === "L" ? closestMatchup.opponent_team_name ?? closestMatchup.team_name : closestMatchup.team_name;
		const losingTeamName = closestMatchup.result === "L" ? closestMatchup.team_name : closestMatchup.opponent_team_name;
		const winningScore = closestMatchup.result === "L" ? closestMatchup.points_against : closestMatchup.points_for;
		const losingScore = closestMatchup.result === "L" ? closestMatchup.points_for : closestMatchup.points_against;
		awards.push({
			id: "closest-matchup",
			symbol: "Δ",
			label: "Closest Finish",
			title: "The Photo Finish",
			teamName: winningTeamName,
			opponentName: losingTeamName,
			teamScore: winningScore,
			opponentScore: losingScore,
			primaryValue: `${formatPoints(Math.abs(closestMatchup.point_differential))}-point margin`,
			description: "The week's tightest matchup was decided by the smallest scoring margin.",
			tone: "neutral"
		});
	}
	if (highestScoringLoss) awards.push({
		id: "highest-scoring-loss",
		symbol: "!",
		label: "Toughest Defeat",
		title: "The Bad Beat",
		teamName: highestScoringLoss.team_name,
		opponentName: highestScoringLoss.opponent_team_name,
		teamScore: highestScoringLoss.points_for,
		opponentScore: highestScoringLoss.points_against,
		primaryValue: `${formatPoints(highestScoringLoss.points_for)} points`,
		description: `${highestScoringLoss.team_name} scored more than every other losing team and still came up short.`,
		tone: "warning"
	});
	if (lowestScoringWin) awards.push({
		id: "lowest-scoring-win",
		symbol: "↗",
		label: "Lowest Winning Score",
		title: "The Escape Artist",
		teamName: lowestScoringWin.team_name,
		opponentName: lowestScoringWin.opponent_team_name,
		teamScore: lowestScoringWin.points_for,
		opponentScore: lowestScoringWin.points_against,
		primaryValue: `${formatPoints(lowestScoringWin.points_for)} points`,
		description: `${lowestScoringWin.team_name} escaped Week ${week} with the lowest winning score on the board.`,
		tone: "warning"
	});
	if (bestBench) awards.push({
		id: "best-bench",
		symbol: "B",
		label: "Bench Production",
		title: "The Clipboard All-Stars",
		teamName: bestBench.team_name,
		opponentName: bestBench.opponent_team_name,
		teamScore: bestBench.points_for,
		opponentScore: bestBench.points_against,
		primaryValue: `${formatPoints(bestBench.bench_points)} bench points`,
		description: `${bestBench.team_name} received the week's largest contribution from players who never entered the starting lineup.`,
		tone: "neutral"
	});
	const awardOrder = {
		"performance-of-the-week": 1,
		"biggest-blowout": 2,
		"closest-matchup": 3,
		"lowest-score": 4,
		"highest-scoring-loss": 5,
		"lowest-scoring-win": 6,
		"best-bench": 7
	};
	return awards.sort((first, second) => (awardOrder[first.id] ?? 999) - (awardOrder[second.id] ?? 999));
}
//#endregion
//#region src/pages/awards.astro
var awards_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Awards,
	file: () => $$file,
	prerender: () => false,
	url: () => $$url
});
createAstro("https://far-far-away-football.vercel.app");
var $$Awards = createComponent(async ($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Awards;
	const { weekOptions, seasons, selectedOption, selectedSeasonOptions, results } = await getAwardsPageData({
		season: Astro.url.searchParams.get("season"),
		week: Astro.url.searchParams.get("week")
	});
	const awards = selectedOption ? buildWeeklyAwards(results, selectedOption.week) : [];
	return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, {
		"title": "Weekly Awards | The League Gazette",
		"description": "The best, worst, luckiest and most painful performances from each week of Far Far Away Football.",
		"data-astro-cid-f3nkhzwl": true
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<main class="awards-page site-shell" data-astro-cid-f3nkhzwl><header class="awards-header" data-astro-cid-f3nkhzwl><div data-astro-cid-f3nkhzwl><p class="eyebrow" data-astro-cid-f3nkhzwl>Far Far Away Football</p><h1 data-astro-cid-f3nkhzwl>Weekly Awards</h1><p class="awards-header__description" data-astro-cid-f3nkhzwl>Celebrating excellence, documenting embarrassment and preserving every questionable lineup decision for posterity.</p></div>${selectedOption && renderTemplate`<div class="awards-header__edition" data-astro-cid-f3nkhzwl><span data-astro-cid-f3nkhzwl>Awards Edition</span><strong data-astro-cid-f3nkhzwl>Week ${selectedOption.week}</strong><small data-astro-cid-f3nkhzwl>${selectedOption.seasonYear} Season</small></div>`}</header>${selectedOption && renderTemplate`<section class="awards-controls" aria-label="Choose an Awards week" data-astro-cid-f3nkhzwl><form method="get" data-astro-cid-f3nkhzwl><label data-astro-cid-f3nkhzwl><span data-astro-cid-f3nkhzwl>Season</span><select id="awards-season" name="season" data-astro-cid-f3nkhzwl>${seasons.map((season) => renderTemplate`<option${addAttribute(season, "value")}${addAttribute(season === selectedOption.seasonYear, "selected")} data-astro-cid-f3nkhzwl>${season}</option>`)}</select></label><label data-astro-cid-f3nkhzwl><span data-astro-cid-f3nkhzwl>Week</span><select id="awards-week" name="week" data-astro-cid-f3nkhzwl>${selectedSeasonOptions.map((option) => renderTemplate`<option${addAttribute(option.week, "value")}${addAttribute(option.week === selectedOption.week, "selected")} data-astro-cid-f3nkhzwl>Week ${option.week}${!option.isComplete ? " — Partial" : ""}</option>`)}</select></label><button type="submit" data-astro-cid-f3nkhzwl>View awards</button></form></section>`}${selectedOption && !selectedOption.isComplete && renderTemplate`<aside class="partial-notice" data-astro-cid-f3nkhzwl><strong data-astro-cid-f3nkhzwl>Partial week</strong><p data-astro-cid-f3nkhzwl>This edition contains ${selectedOption.teamResults} team results across ${selectedOption.matchupCount} matchups. Awards may change when additional results become available.</p></aside>`}${awards.length > 0 ? renderTemplate`${renderComponent($$result, "Fragment", Fragment, {}, { "default": ($$result) => renderTemplate`<section class="awards-intro" data-astro-cid-f3nkhzwl><div data-astro-cid-f3nkhzwl><p class="eyebrow" data-astro-cid-f3nkhzwl>The Official Results</p><h2 data-astro-cid-f3nkhzwl>Week ${selectedOption?.week}’s winners and losers</h2></div><p data-astro-cid-f3nkhzwl>Every award below is calculated directly from the final weekly results.</p></section><section class="awards-grid" data-astro-cid-f3nkhzwl>${awards.map((award, index) => renderTemplate`<article${addAttribute([
		"award-card",
		`award-card--${award.tone}`,
		{
			"award-card--hero": award.id === "performance-of-the-week",
			"award-card--secondary": award.id === "biggest-blowout" || award.id === "closest-matchup",
			"award-card--compact": award.id !== "performance-of-the-week" && award.id !== "biggest-blowout" && award.id !== "closest-matchup"
		}
	], "class:list")} data-astro-cid-f3nkhzwl><div class="award-card__watermark" aria-hidden="true" data-astro-cid-f3nkhzwl>${award.symbol}</div><div class="award-card__topline" data-astro-cid-f3nkhzwl><span class="award-card__symbol" data-astro-cid-f3nkhzwl>${award.symbol}</span><p class="award-card__label" data-astro-cid-f3nkhzwl>${award.label}</p><span class="award-card__number" data-astro-cid-f3nkhzwl>${String(index + 1).padStart(2, "0")}</span></div><div class="award-card__body" data-astro-cid-f3nkhzwl><div class="award-card__story" data-astro-cid-f3nkhzwl><h3 data-astro-cid-f3nkhzwl>${award.title}</h3><div class="award-card__rule" aria-hidden="true" data-astro-cid-f3nkhzwl></div><p class="award-card__team" data-astro-cid-f3nkhzwl>${award.teamName}</p><p class="award-card__value" data-astro-cid-f3nkhzwl>${award.primaryValue}</p><p class="award-card__description" data-astro-cid-f3nkhzwl>${award.description}</p></div>${award.opponentName && renderTemplate`<div class="award-score"${addAttribute(`${award.teamName} ${award.teamScore.toFixed(2)}, ${award.opponentName} ${award.opponentScore?.toFixed(2)}`, "aria-label")} data-astro-cid-f3nkhzwl><div class="award-score__row" data-astro-cid-f3nkhzwl><span data-astro-cid-f3nkhzwl>${award.teamName}</span><strong data-astro-cid-f3nkhzwl>${award.teamScore.toFixed(2)}</strong></div><div class="award-score__row" data-astro-cid-f3nkhzwl><span data-astro-cid-f3nkhzwl>${award.opponentName}</span><strong data-astro-cid-f3nkhzwl>${award.opponentScore?.toFixed(2)}</strong></div></div>`}</div></article>`)}</section>` })}` : renderTemplate`<section class="empty-state" data-astro-cid-f3nkhzwl><p class="eyebrow" data-astro-cid-f3nkhzwl>Awards Desk</p><h2 data-astro-cid-f3nkhzwl>No results are available yet.</h2><p data-astro-cid-f3nkhzwl>Weekly honors will appear after matchup results have been synced.</p><a href="/" data-astro-cid-f3nkhzwl>Return to the front page</a></section>`}</main>${renderScript($$result, "/Users/mattbieniek/Documents/Fantasy Football/Website/theleaguegazette/src/pages/awards.astro?astro&type=script&index=0&lang.ts")}` })}`;
}, "/Users/mattbieniek/Documents/Fantasy Football/Website/theleaguegazette/src/pages/awards.astro", void 0);
var $$file = "/Users/mattbieniek/Documents/Fantasy Football/Website/theleaguegazette/src/pages/awards.astro";
var $$url = "/awards";
//#endregion
//#region \0virtual:astro:page:src/pages/awards@_@astro
var page = () => awards_exports;
//#endregion
export { page };
