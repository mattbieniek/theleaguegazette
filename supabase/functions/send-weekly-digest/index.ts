import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { activeSeasonYear } from "../_shared/activeLeague.ts";

const htmlEntities: Record<string, string> = {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"};
const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => htmlEntities[character]);
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret" };
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: corsHeaders });

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ success: false, error: "Use POST." }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const cronSecret = Deno.env.get("WEEKLY_DIGEST_CRON_SECRET");
  const sender = Deno.env.get("WEEKLY_DIGEST_FROM") ?? "The League Gazette <gazette@theleaguegazette.org>";
  const siteUrl = Deno.env.get("PUBLIC_SITE_URL") ?? "https://theleaguegazette.org";
  if (!supabaseUrl || !serviceKey || !resendKey || !cronSecret) return json({ success: false, error: "Digest secrets are not configured." }, 503);
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const requestBody = await request.json().catch(() => ({})) as { test_email?: string; retry_failed?: boolean };
  const testEmail = requestBody.test_email?.trim().toLowerCase() || "";
  const isCronRequest = request.headers.get("x-cron-secret")?.trim() === cronSecret;
  let isAdminRequest = false;
  if (!isCronRequest) {
    const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const { data: userData } = await supabase.auth.getUser(accessToken);
    if (userData.user) {
      const { data: admin, error: adminError } = await supabase.from("admin_users").select("user_id").eq("user_id", userData.user.id).maybeSingle();
      if (adminError) return json({ success: false, error: "Could not verify administrator access." }, 503);
      isAdminRequest = Boolean(admin);
    }
    if (!isAdminRequest) return json({ success: false, error: "Unauthorized" }, 401);
  }
  if (testEmail && !isAdminRequest) return json({ success: false, error: "Test deliveries require an administrator session." }, 403);
  if (testEmail && !emailPattern.test(testEmail)) return json({ success: false, error: "Enter a valid test recipient email address." }, 400);
  let runId = "";
  try {
    const activeSeason = activeSeasonYear();
    const { data: weekly, error: weeklyError } = await supabase.from("team_weekly_results").select("season_year,week").eq("season_year", activeSeason).order("week",{ascending:false}).limit(1).maybeSingle();
    if (weeklyError) throw new Error("Could not determine the latest league week.");
    const season = activeSeason, week = Number(weekly?.week ?? 1);
    if (!Number.isInteger(season) || !Number.isInteger(week) || week < 1 || week > 18) throw new Error("The latest league week is invalid.");
    const isPreseason = !weekly;
    const editionLabel = isPreseason ? `${season} Preseason` : `${season} Week ${week}`;
    const subject = `${testEmail ? "[TEST] " : ""}The League Gazette · ${editionLabel}`;
    const digestStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [articlesResult, rankingsResult, profilesResult] = await Promise.all([
      supabase.from("gazette_articles").select("slug,headline,summary,category,author_name,image_url,image_alt").eq("status","published").gte("published_at",digestStart).order("published_at",{ascending:false}).limit(12),
      supabase.from("power_rankings").select("title,entries").eq("status","ready").order("season_year",{ascending:false}).order("week",{ascending:false}).limit(1).maybeSingle(),
      supabase.from("reader_profiles").select("user_id,display_name").eq("digest_enabled",true).range(0,999),
    ]);
    if (articlesResult.error || rankingsResult.error || profilesResult.error) throw new Error("Could not load digest content.");
    const articles = articlesResult.data;
    const rankings = rankingsResult.data;
    const profiles = profilesResult.data;
    const recipients: Array<{email:string;displayName:string}> = [];
    for (const profile of profiles ?? []) {
      const { data, error } = await supabase.auth.admin.getUserById(profile.user_id);
      if (error) throw new Error("Could not verify digest recipients.");
      if (data.user?.email && data.user.email_confirmed_at) recipients.push({email:data.user.email,displayName:profile.display_name});
    }
    if (testEmail) {
      recipients.splice(0, recipients.length, { email: testEmail, displayName: "Gazette Reader" });
    }
    const isTest = Boolean(testEmail);
    const editionKey = isTest ? null : isPreseason ? `${season}:preseason:${new Date().toISOString().slice(0, 10)}` : `${season}:${week}`;
    if (!isTest && editionKey) {
      const { data: existing, error: existingError } = await supabase.from("weekly_digest_runs").select("id,status,delivered_count,failed_count").eq("edition_key", editionKey).eq("is_test", false).maybeSingle();
      if (existingError) throw new Error("Could not check whether this digest edition already ran.");
      if (existing?.status === "completed") return json({ success: true, alreadySent: true, season, week, delivered: existing.delivered_count, failed: existing.failed_count });
      if (existing?.status === "running") return json({ success: false, error: "This digest edition is already running." }, 409);
      if (existing && (!requestBody.retry_failed || !isAdminRequest || existing.delivered_count > 0)) return json({ success: false, error: "This digest edition already needs administrator review before it can be retried." }, 409);
      if (existing) {
        const { error: resetError } = await supabase.from("weekly_digest_runs").update({ status: "running", subject, recipient_count: recipients.length, delivered_count: 0, failed_count: 0, error_message: null, completed_at: null }).eq("id", existing.id);
        if (resetError) throw new Error("Could not reopen the digest edition.");
        runId = existing.id;
      }
    }
    if (!runId) {
      const {data:run,error:runError}=await supabase.from("weekly_digest_runs").insert({season_year:season,week,subject,recipient_count:recipients.length,edition_key:editionKey,is_test:isTest}).select("id").single();
      if(runError) {
        if (!isTest && runError.code === "23505") return json({ success: false, error: "This digest edition is already running or has already been sent." }, 409);
        throw new Error("Could not create the digest run.");
      }
      runId=run.id;
    }
    const storyHtml=(articles??[]).map((article,index)=>{
      const image=article.image_url||`${siteUrl}/images/gazette/article-placeholder.webp`;
      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;${index?"border-top:1px solid #d4cfc2;":""}"><tr><td style="padding:22px 0"><img src="${escapeHtml(image)}" alt="${escapeHtml(article.image_alt||"")}" width="600" style="display:block;width:100%;height:auto;max-height:315px;object-fit:cover;border:0"><p style="margin:18px 0 4px;color:#9b792f;font:700 11px Arial,sans-serif;letter-spacing:1.5px;text-transform:uppercase">${escapeHtml(article.category)}</p><h2 style="margin:0 0 8px;font:700 30px Georgia,serif;line-height:1.05"><a style="color:#18231d;text-decoration:none" href="${siteUrl}/gazette/${encodeURIComponent(article.slug)}">${escapeHtml(article.headline)}</a></h2><p style="margin:0 0 10px;color:#535b56;font:17px Georgia,serif;line-height:1.5">${escapeHtml(article.summary)}</p><p style="margin:0;color:#777d79;font:600 10px Arial,sans-serif;letter-spacing:1px;text-transform:uppercase">By ${escapeHtml(article.author_name||"The Gazette Staff")}</p></td></tr></table>`;
    }).join("");
    const topFive=Array.isArray(rankings?.entries)?rankings.entries.slice().sort((a:any,b:any)=>a.rank-b.rank).slice(0,5):[];
    const rankingHtml=topFive.map((entry:any)=>`<tr><td width="44" style="padding:11px 0;border-bottom:1px solid #385046;color:#e0c97e;font:700 25px Georgia,serif;text-align:center">${escapeHtml(entry.rank)}</td><td style="padding:11px 8px;border-bottom:1px solid #385046"><strong style="display:block;color:#fff;font:700 16px Arial,sans-serif">${escapeHtml(entry.teamName)}</strong>${entry.note?`<span style="color:#b9c2bd;font:13px Georgia,serif">${escapeHtml(entry.note)}</span>`:""}</td></tr>`).join("");
    const matchupsLabel = isPreseason ? `${season} season preview` : `Week ${week} matchups`;
    const standingsLabel = isPreseason ? `${season} season standings` : "Historical standings";
    const matchupsRow = isPreseason ? "" : `<tr><td style="padding:9px 0;border-top:1px solid #d4cfc2"><a href="${siteUrl}/matchups?season=${season}&week=${week}" style="color:#173126;font:700 14px Arial,sans-serif;text-decoration:none">${escapeHtml(matchupsLabel)} →</a></td></tr>`;
    let delivered=0,failed=0;
    for(const recipient of recipients){
      const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head><body style="margin:0;background:#e9e4d8;color:#18231d"><div style="display:none;max-height:0;overflow:hidden">Stories, rankings and league business from ${escapeHtml(editionLabel)}.</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#e9e4d8"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:680px;border-collapse:collapse;background:#f8f5ed;border:1px solid #c9c3b6"><tr><td align="center" style="padding:26px 28px 22px;border-top:7px solid #173126;border-bottom:3px double #3c463f"><img src="${siteUrl}/logos/league-logo.webp" alt="" width="56" height="56" style="display:block;margin:0 auto 10px;border:0"><p style="margin:0 0 8px;color:#68706b;font:700 10px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase">The official publication of Far Far Away Football</p><h1 style="margin:0;color:#18231d;font:700 52px Georgia,serif;letter-spacing:-2px;line-height:.95">The League Gazette</h1><p style="margin:12px 0 0;color:#9b792f;font:700 11px Arial,sans-serif;letter-spacing:1.5px;text-transform:uppercase">${escapeHtml(editionLabel)} Digest</p></td></tr><tr><td style="padding:22px 38px 8px"><p style="margin:0;color:#535b56;font:18px Georgia,serif;line-height:1.55">Good morning, <strong>${escapeHtml(recipient.displayName)}</strong>. Here is this week’s dispatch from around the league.</p></td></tr><tr><td style="padding:0 38px 20px">${storyHtml||`<p style="padding:24px 0;color:#6b716d;font:17px Georgia,serif">No new stories were published this week. The league, against all odds, survived.</p>`}</td></tr><tr><td style="padding:28px 38px;background:#173126"><p style="margin:0 0 4px;color:#e0c97e;font:700 10px Arial,sans-serif;letter-spacing:1.6px;text-transform:uppercase">Editorial rankings</p><h2 style="margin:0 0 14px;color:#fff;font:700 32px Georgia,serif">The Gazette Poll</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${rankingHtml||`<tr><td style="color:#c8d0cc;font:16px Georgia,serif">The latest rankings are still being debated.</td></tr>`}</table><p style="margin:18px 0 0"><a href="${siteUrl}/rankings" style="color:#e0c97e;font:700 13px Arial,sans-serif;text-decoration:none">Compare both power rankings →</a></p></td></tr><tr><td style="padding:28px 38px"><p style="margin:0 0 4px;color:#9b792f;font:700 10px Arial,sans-serif;letter-spacing:1.6px;text-transform:uppercase">The weekly docket</p><h2 style="margin:0 0 16px;font:700 30px Georgia,serif">Around the league</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${matchupsRow}<tr><td style="padding:9px 0;border-top:1px solid #d4cfc2"><a href="${siteUrl}/standings?season=${season}&week=${week}" style="color:#173126;font:700 14px Arial,sans-serif;text-decoration:none">${escapeHtml(standingsLabel)} →</a></td></tr><tr><td style="padding:9px 0;border-top:1px solid #d4cfc2"><a href="${siteUrl}/awards" style="color:#173126;font:700 14px Arial,sans-serif;text-decoration:none">Weekly awards →</a></td></tr><tr><td style="padding:9px 0;border-top:1px solid #d4cfc2;border-bottom:1px solid #d4cfc2"><a href="${siteUrl}/poll?season=${season}&week=${Math.min(week+1,17)}" style="color:#173126;font:700 14px Arial,sans-serif;text-decoration:none">Cast a Readers Poll ballot →</a></td></tr></table><p style="margin:26px 0 4px;text-align:center"><a href="${siteUrl}" style="display:inline-block;padding:14px 22px;background:#173126;color:#fff;font:700 14px Arial,sans-serif;text-decoration:none">Read the full Gazette</a></p></td></tr><tr><td align="center" style="padding:22px 30px;border-top:1px solid #c9c3b6;background:#efebe2"><p style="margin:0 0 7px;color:#646b67;font:12px Arial,sans-serif">News, analysis, and some good old-fashioned fuckery from around the league.</p><p style="margin:0;color:#7a807c;font:11px Arial,sans-serif">This digest is included with your Gazette account. <a href="${siteUrl}/account" style="color:#173126">Manage email preferences</a>.</p></td></tr></table></td></tr></table></body></html>`;
      const text=`The League Gazette\n${editionLabel}\n\nGood morning, ${recipient.displayName}.\n\n${(articles??[]).map(article=>`${article.category}: ${article.headline}\n${article.summary}\n${siteUrl}/gazette/${article.slug}`).join("\n\n")||"No new stories were published this week."}\n\nThe Gazette Poll\n${topFive.map((entry:any)=>`${entry.rank}. ${entry.teamName}`).join("\n")||"Rankings pending."}\n\nRead the Gazette: ${siteUrl}\nManage email preferences: ${siteUrl}/account`;
      const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${resendKey}`,"Content-Type":"application/json"},body:JSON.stringify({from:sender,to:[recipient.email],subject,html,text})});
      if(response.ok)delivered++;else{failed++;console.error("Digest delivery failed",{status:response.status})}
    }
    const finalStatus = failed === 0 ? "completed" : delivered > 0 ? "partial" : "failed";
    const { error: completionError } = await supabase.from("weekly_digest_runs").update({delivered_count:delivered,failed_count:failed,status:finalStatus,completed_at:new Date().toISOString()}).eq("id",runId);
    if (completionError) throw new Error("Digest delivery completed, but its run record could not be updated.");
    return json({ success: failed === 0, status: finalStatus, recipients: recipients.length, delivered, failed }, failed === 0 ? 200 : 502);
  } catch(error){
    const message = error instanceof Error ? error.message : "The digest could not be completed.";
    console.error("Digest run failed", { message });
    if(runId) {
      const { error: updateError } = await supabase.from("weekly_digest_runs").update({status:"failed",error_message:message,completed_at:new Date().toISOString()}).eq("id",runId);
      if (updateError) console.error("Digest run status update failed", { code: updateError.code });
    }
    return json({ success: false, error: message }, 500);
  }
});
