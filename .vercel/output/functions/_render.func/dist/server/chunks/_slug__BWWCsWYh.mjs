import { S as unescapeHTML, g as addAttribute, i as renderComponent, m as maybeRenderHead, u as renderTemplate, w as createAstro } from "./server_B_hu0jgv.mjs";
import { t as createComponent } from "./compiler_uT6rBWMH.mjs";
import { t as $$BaseLayout } from "./BaseLayout_DfnYwikd.mjs";
import { t as __exportAll } from "./_id__D1clxZ4P.mjs";
import { generateHTML } from "@tiptap/html/server";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { createClient } from "@supabase/supabase-js";
//#region src/components/gazette/ArticleBody.astro
createAstro("https://far-far-away-football.vercel.app");
var $$ArticleBody = createComponent(($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$ArticleBody;
	const { body } = Astro.props;
	const html = generateHTML(body, [StarterKit.configure({ heading: { levels: [2, 3] } }), Link.configure({
		openOnClick: false,
		HTMLAttributes: { rel: "noopener noreferrer" }
	})]);
	return renderTemplate`${maybeRenderHead($$result)}<div class="article-rich-text" data-astro-cid-rtcawyt5>${unescapeHTML(html)}</div>`;
}, "/Users/mattbieniek/Documents/Fantasy Football/Website/theleaguegazette/src/components/gazette/ArticleBody.astro", void 0);
var supabase = createClient("https://ycozdpdabtxukygkovgd.supabase.co", "sb_publishable_u4gM7rF8ImnuZCVV13oDbA_YkwPD9jE", { auth: {
	persistSession: false,
	autoRefreshToken: false,
	detectSessionInUrl: false
} });
//#endregion
//#region src/lib/gazette/articleBody.ts
function isLegacyArticleBody(body) {
	return Array.isArray(body) && body.every((paragraph) => typeof paragraph === "string");
}
function isRichTextDocument(body) {
	if (!body || typeof body !== "object" || Array.isArray(body)) return false;
	const candidate = body;
	return candidate.type === "doc" && Array.isArray(candidate.content);
}
function legacyBodyToRichText(paragraphs) {
	const content = paragraphs.map((paragraph) => paragraph.trim()).filter(Boolean).map((paragraph) => ({
		type: "paragraph",
		content: [{
			type: "text",
			text: paragraph
		}]
	}));
	return {
		type: "doc",
		content: content.length > 0 ? content : [{ type: "paragraph" }]
	};
}
function normalizeArticleBody(body) {
	if (isRichTextDocument(body)) return body;
	if (isLegacyArticleBody(body)) return legacyBodyToRichText(body);
	return {
		type: "doc",
		content: [{ type: "paragraph" }]
	};
}
//#endregion
//#region src/lib/queries/gazette.ts
function normalizeArticle(article) {
	return {
		...article,
		body: normalizeArticleBody(article.body)
	};
}
async function getPublishedArticleBySlug(slug) {
	const { data, error } = await supabase.from("gazette_articles").select("*").eq("slug", slug).in("status", ["published", "scheduled"]).lte("published_at", (/* @__PURE__ */ new Date()).toISOString()).maybeSingle();
	if (error) throw new Error(`Unable to load Gazette article: ${error.message}`);
	return data ? normalizeArticle(data) : null;
}
//#endregion
//#region src/lib/formatDate.ts
function formatPublicationDate(date) {
	const parsedDate = new Date(date);
	if (Number.isNaN(parsedDate.getTime())) return "";
	return new Intl.DateTimeFormat("en-US", {
		month: "long",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC"
	}).format(parsedDate);
}
//#endregion
//#region src/pages/gazette/[slug].astro
var _slug__exports = /* @__PURE__ */ __exportAll({
	default: () => $$Slug,
	file: () => $$file,
	prerender: () => false,
	url: () => $$url
});
createAstro("https://far-far-away-football.vercel.app");
var $$Slug = createComponent(async ($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Slug;
	const { slug } = Astro.params;
	if (!slug) throw new Error("Missing Gazette article slug.");
	const story = await getPublishedArticleBySlug(slug);
	if (!story) return Astro.redirect("/404");
	return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, {
		"title": `${story.headline} | The League Gazette`,
		"description": story.summary,
		"data-astro-cid-itrap6rf": true
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<article class="article-page" data-astro-cid-itrap6rf><header class="article-header site-shell" data-astro-cid-itrap6rf><a class="article-header__back" href="/gazette" data-astro-cid-itrap6rf>Gazette</a><p class="eyebrow" data-astro-cid-itrap6rf>${story.category}</p><h1 data-astro-cid-itrap6rf>${story.headline}</h1><p class="article-header__dek" data-astro-cid-itrap6rf>${story.summary}</p><div class="article-header__meta" data-astro-cid-itrap6rf><span data-astro-cid-itrap6rf>By <strong data-astro-cid-itrap6rf>${story.author_name}</strong></span><span aria-hidden="true" data-astro-cid-itrap6rf>·</span>${story.published_at && renderTemplate`<time${addAttribute(story.published_at, "datetime")} data-astro-cid-itrap6rf>${formatPublicationDate(story.published_at)}</time>`}</div></header>${story.image_url && renderTemplate`<figure class="article-image site-shell" data-astro-cid-itrap6rf><img${addAttribute(story.image_url, "src")}${addAttribute(story.image_alt ?? "", "alt")} width="1600" height="1000" data-astro-cid-itrap6rf></figure>`}<div class="article-body site-shell" data-astro-cid-itrap6rf><div class="article-body__content" data-astro-cid-itrap6rf>${renderComponent($$result, "ArticleBody", $$ArticleBody, {
		"body": story.body,
		"data-astro-cid-itrap6rf": true
	})}</div></div></article>` })}`;
}, "/Users/mattbieniek/Documents/Fantasy Football/Website/theleaguegazette/src/pages/gazette/[slug].astro", void 0);
var $$file = "/Users/mattbieniek/Documents/Fantasy Football/Website/theleaguegazette/src/pages/gazette/[slug].astro";
var $$url = "/gazette/[slug]";
//#endregion
//#region \0virtual:astro:page:src/pages/gazette/[slug]@_@astro
var page = () => _slug__exports;
//#endregion
export { page };
