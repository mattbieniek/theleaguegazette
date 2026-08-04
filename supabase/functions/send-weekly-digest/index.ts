import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const htmlEntities: Record<string, string> = {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"};
const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => htmlEntities[character]);

Deno.serve(async (request: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const cronSecret = Deno.env.get("WEEKLY_DIGEST_CRON_SECRET");
  const sender = Deno.env.get("WEEKLY_DIGEST_FROM") ?? "The League Gazette <gazette@theleaguegazette.org>";
  const siteUrl = Deno.env.get("PUBLIC_SITE_URL") ?? "https://theleaguegazette.org";
  if (!supabaseUrl || !serviceKey || !resendKey || !cronSecret) return Response.json({success:false,error:"Digest secrets are not configured."},{status:503});
  if (request.headers.get("x-cron-secret") !== cronSecret) return Response.json({success:false,error:"Unauthorized"},{status:401});
  const supabase = createClient(supabaseUrl, serviceKey);
  let runId = "";
  try {
    const { data: weekly } = await supabase.from("team_weekly_results").select("season_year,week").order("season_year",{ascending:false}).order("week",{ascending:false}).limit(1).maybeSingle();
    const season = Number(weekly?.season_year ?? new Date().getFullYear()), week = Number(weekly?.week ?? 1);
    const subject = `The League Gazette · ${season} Week ${week}`;
    const digestStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [{data:articles},{data:rankings},{data:profiles}] = await Promise.all([
      supabase.from("gazette_articles").select("slug,headline,summary,category").eq("status","published").gte("published_at",digestStart).order("published_at",{ascending:false}).limit(12),
      supabase.from("power_rankings").select("title,entries").eq("status","ready").order("season_year",{ascending:false}).order("week",{ascending:false}).limit(1).maybeSingle(),
      supabase.from("reader_profiles").select("user_id,display_name").eq("digest_enabled",true),
    ]);
    const recipients: Array<{email:string;displayName:string}> = [];
    for (const profile of profiles ?? []) {
      const { data } = await supabase.auth.admin.getUserById(profile.user_id);
      if (data.user?.email && data.user.email_confirmed_at) recipients.push({email:data.user.email,displayName:profile.display_name});
    }
    const {data:run,error:runError}=await supabase.from("weekly_digest_runs").insert({season_year:season,week,subject,recipient_count:recipients.length}).select("id").single();
    if(runError)throw runError;runId=run.id;
    const storyHtml=(articles??[]).map(article=>`<li style="margin:0 0 18px"><p style="margin:0;color:#a1802f;font:700 12px monospace;text-transform:uppercase">${escapeHtml(article.category)}</p><h2 style="margin:4px 0;font-family:Georgia,serif"><a style="color:#173126" href="${siteUrl}/gazette/${encodeURIComponent(article.slug)}">${escapeHtml(article.headline)}</a></h2><p style="margin:0;color:#5d625e">${escapeHtml(article.summary)}</p></li>`).join("");
    const topThree=Array.isArray(rankings?.entries)?rankings.entries.slice().sort((a:any,b:any)=>a.rank-b.rank).slice(0,3):[];
    const rankingHtml=topThree.map((entry:any)=>`<li><strong>${escapeHtml(entry.rank)}. ${escapeHtml(entry.teamName)}</strong>${entry.note?` — ${escapeHtml(entry.note)}`:""}</li>`).join("");
    let delivered=0,failed=0;
    for(const recipient of recipients){
      const html=`<!doctype html><html><body style="margin:0;background:#f5f1e8;color:#18231d"><main style="max-width:680px;margin:auto;padding:34px"><p style="font:700 12px monospace;letter-spacing:.1em;text-transform:uppercase">Far Far Away Football</p><h1 style="font:700 48px Georgia,serif;margin:8px 0">The League Gazette</h1><p>Good morning, ${escapeHtml(recipient.displayName)}. Here is the complete Week ${week} dispatch.</p><hr><ul style="padding:0;list-style:none">${storyHtml||"<li>No new stories this week.</li>"}</ul><h2 style="font-family:Georgia,serif">The Gazette Poll</h2><ol>${rankingHtml||"<li>The latest rankings are still being debated.</li>"}</ol><h2 style="font-family:Georgia,serif">Around the league</h2><p><a href="${siteUrl}/matchups?season=${season}&week=${week}">Week ${week} matchups</a> · <a href="${siteUrl}/standings?season=${season}&week=${week}">Standings</a> · <a href="${siteUrl}/awards">Weekly awards</a> · <a href="${siteUrl}/poll?season=${season}&week=${Math.min(week+1,17)}">Readers Poll</a></p><p><a style="display:inline-block;padding:12px 18px;background:#173126;color:#fff;text-decoration:none" href="${siteUrl}">Read the Gazette</a></p><p style="margin-top:32px;color:#777;font-size:12px">This digest is included with your Gazette reader account. <a href="${siteUrl}/account">Manage email preferences</a>.</p></main></body></html>`;
      const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${resendKey}`,"Content-Type":"application/json"},body:JSON.stringify({from:sender,to:[recipient.email],subject,html})});
      if(response.ok)delivered++;else{failed++;console.error("Digest delivery failed",recipient.email,await response.text())}
    }
    await supabase.from("weekly_digest_runs").update({delivered_count:delivered,failed_count:failed,status:failed&& !delivered?"failed":"completed",completed_at:new Date().toISOString()}).eq("id",runId);
    return Response.json({success:true,recipients:recipients.length,delivered,failed});
  } catch(error){if(runId)await supabase.from("weekly_digest_runs").update({status:"failed",error_message:error instanceof Error?error.message:String(error),completed_at:new Date().toISOString()}).eq("id",runId);return Response.json({success:false,error:error instanceof Error?error.message:String(error)},{status:500})}
});
