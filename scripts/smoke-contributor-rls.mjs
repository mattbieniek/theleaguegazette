import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";

function localCredentials() {
  if (
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return {
      API_URL: process.env.SUPABASE_URL,
      ANON_KEY: process.env.SUPABASE_ANON_KEY,
      SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
  }

  const output = execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["--no-install", "supabase", "status", "-o", "json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );
  return JSON.parse(output);
}

const credentials = localCredentials();
const apiUrl = credentials.API_URL;
const anonKey = credentials.ANON_KEY;
const serviceRoleKey = credentials.SERVICE_ROLE_KEY;

if (!apiUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    "Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY for a local Supabase stack.",
  );
}

if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(apiUrl)) {
  throw new Error(`Refusing to run destructive smoke-test cleanup against non-local URL: ${apiUrl}`);
}

const password = "Local-smoke-test-2026!";
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const emails = {
  admin: `admin-${stamp}@example.test`,
  contributorA: `writer-a-${stamp}@example.test`,
  contributorB: `writer-b-${stamp}@example.test`,
};

const service = createClient(apiUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(apiUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const createdUserIds = [];
const createdArticleIds = [];
const results = [];

function check(condition, label, detail = "") {
  if (!condition) throw new Error(`${label}${detail ? `: ${detail}` : ""}`);
  results.push(`PASS  ${label}`);
}

async function createUser(email) {
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error(`Unable to create ${email}`);
  createdUserIds.push(data.user.id);
  return data.user;
}

async function signIn(email) {
  const client = createClient(apiUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

function article(slug, createdBy, overrides = {}) {
  return {
    slug: `${slug}-${stamp}`,
    category: "Op-Ed",
    headline: `Local smoke test: ${slug}`,
    summary: "Temporary authorization smoke-test story.",
    author_name: "Local Test Writer",
    body: [],
    status: "draft",
    is_featured: false,
    homepage_order: null,
    created_by: createdBy,
    ...overrides,
  };
}

try {
  const adminUser = await createUser(emails.admin);
  const contributorAUser = await createUser(emails.contributorA);
  await createUser(emails.contributorB);

  const { error: adminFixtureError } = await service
    .from("admin_users")
    .insert({ user_id: adminUser.id, display_name: "Local Test Admin" });
  if (adminFixtureError) throw adminFixtureError;

  const adminClient = await signIn(emails.admin);
  const grantA = await adminClient.rpc("admin_add_publication_contributor", {
    contributor_email: emails.contributorA,
    contributor_display_name: "Local Writer A",
  });
  const grantB = await adminClient.rpc("admin_add_publication_contributor", {
    contributor_email: emails.contributorB,
    contributor_display_name: "Local Writer B",
  });
  check(!grantA.error && !grantB.error, "Admin can grant Op-Ed contributor access", grantA.error?.message ?? grantB.error?.message);

  const contributorA = await signIn(emails.contributorA);
  const contributorB = await signIn(emails.contributorB);

  const ownDraft = await contributorA
    .from("gazette_articles")
    .insert(article("own-draft", contributorAUser.id))
    .select("id,status,category,created_by")
    .single();
  check(!ownDraft.error && ownDraft.data?.status === "draft", "Contributor can create an owned Op-Ed draft", ownDraft.error?.message);
  createdArticleIds.push(ownDraft.data.id);

  const wrongCategory = await contributorA
    .from("gazette_articles")
    .insert(article("wrong-category", contributorAUser.id, { category: "News" }));
  check(Boolean(wrongCategory.error), "Contributor cannot create a non-Op-Ed story");

  const directPublish = await contributorA
    .from("gazette_articles")
    .insert(article("direct-publish", contributorAUser.id, { status: "published", published_at: new Date().toISOString() }));
  check(Boolean(directPublish.error), "Contributor cannot publish directly");

  const homepageControl = await contributorA
    .from("gazette_articles")
    .insert(article("homepage-control", contributorAUser.id, { is_featured: true, homepage_order: 1 }));
  check(Boolean(homepageControl.error), "Contributor cannot feature or place a story on the homepage");

  const otherRead = await contributorB
    .from("gazette_articles")
    .select("id")
    .eq("id", ownDraft.data.id);
  check(!otherRead.error && otherRead.data.length === 0, "Contributor cannot read another contributor's draft", otherRead.error?.message);

  const otherUpdate = await contributorB
    .from("gazette_articles")
    .update({ headline: "Unauthorized edit" })
    .eq("id", ownDraft.data.id)
    .select("id");
  check(!otherUpdate.error && otherUpdate.data.length === 0, "Contributor cannot update another contributor's draft", otherUpdate.error?.message);

  const submit = await contributorA
    .from("gazette_articles")
    .update({ status: "ready_for_review" })
    .eq("id", ownDraft.data.id)
    .select("status")
    .single();
  check(!submit.error && submit.data?.status === "ready_for_review", "Contributor can submit an owned draft for review", submit.error?.message);

  const publish = await adminClient
    .from("gazette_articles")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", ownDraft.data.id)
    .select("status")
    .single();
  check(!publish.error && publish.data?.status === "published", "Admin can approve and publish a submitted Op-Ed", publish.error?.message);

  const postPublishEdit = await contributorA
    .from("gazette_articles")
    .update({ headline: "Edit after publication" })
    .eq("id", ownDraft.data.id)
    .select("id");
  check(!postPublishEdit.error && postPublishEdit.data.length === 0, "Contributor cannot modify an Op-Ed after publication", postPublishEdit.error?.message);

  const publicRead = await anon
    .from("gazette_articles")
    .select("id,status")
    .eq("id", ownDraft.data.id)
    .single();
  check(!publicRead.error && publicRead.data?.status === "published", "Published Op-Ed is publicly readable", publicRead.error?.message);

  console.log(results.join("\n"));
  console.log(`\n${results.length} contributor authorization checks passed.`);
} finally {
  if (createdArticleIds.length) {
    await service.from("gazette_articles").delete().in("id", createdArticleIds);
  }
  for (const userId of createdUserIds.reverse()) {
    await service.auth.admin.deleteUser(userId);
  }
}
