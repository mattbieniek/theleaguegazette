import { t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { T as createAstro, _ as addAttribute, c as renderSlot, d as renderTemplate, g as renderHead, h as maybeRenderHead, i as renderComponent, v as createRenderInstruction } from "./server_C1dVeAgT.mjs";
//#region node_modules/astro/dist/runtime/server/render/script.js
async function renderScript(result, id) {
	const inlined = result.inlinedScripts.get(id);
	let content = "";
	if (inlined != null) {
		if (inlined) content = `<script type="module">${inlined}<\/script>`;
	} else {
		const resolved = await result.resolve(id);
		content = `<script type="module" src="${result.userAssetsBase ? (result.base === "/" ? "" : result.base) + result.userAssetsBase : ""}${resolved}"><\/script>`;
	}
	return createRenderInstruction({
		type: "script",
		id,
		content
	});
}
//#endregion
//#region src/components/site/Masthead.astro
var $$Masthead = createComponent(($$result, $$props, $$slots) => {
	const now = /* @__PURE__ */ new Date();
	const publicationDate = new Intl.DateTimeFormat("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
		year: "numeric",
		timeZone: "America/Chicago"
	}).format(now);
	const dateTime = new Intl.DateTimeFormat("en-CA", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		timeZone: "America/Chicago"
	}).format(now);
	return renderTemplate`${maybeRenderHead($$result)}<header class="masthead" data-astro-cid-3rxsxc55><div class="site-shell masthead__inner" data-astro-cid-3rxsxc55><div class="masthead__meta masthead__meta--left" data-astro-cid-3rxsxc55><span class="masthead__league" data-astro-cid-3rxsxc55>Far Far Away Football</span><span class="masthead__edition" data-astro-cid-3rxsxc55>Established 2022</span></div><a class="masthead__identity" href="/" aria-label="The League Gazette homepage" data-astro-cid-3rxsxc55><span class="masthead__kicker" data-astro-cid-3rxsxc55>The official publication of<span data-astro-cid-3rxsxc55>Far Far Away Football</span></span><span class="masthead__title" data-astro-cid-3rxsxc55>The League Gazette</span><span class="masthead__tagline" data-astro-cid-3rxsxc55>News, analysis and nonsense from around the league</span></a><div class="masthead__meta masthead__meta--right" data-astro-cid-3rxsxc55><time${addAttribute(dateTime, "datetime")} data-astro-cid-3rxsxc55>${publicationDate}</time><span class="masthead__edition" data-astro-cid-3rxsxc55>Houston, Texas</span></div></div></header>`;
}, "/Users/mattbieniek/Documents/Fantasy Football/Website/theleaguegazette/src/components/site/Masthead.astro", void 0);
//#endregion
//#region src/components/site/SiteNav.astro
createAstro("https://far-far-away-football.vercel.app");
var $$SiteNav = createComponent(($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$SiteNav;
	const currentPath = Astro.url.pathname;
	const navigation = [
		{
			label: "Front Page",
			href: "/"
		},
		{
			label: "The Gazette",
			href: "/gazette"
		},
		{
			label: "Standings",
			href: "/standings"
		},
		{
			label: "Matchups",
			href: "/matchups"
		},
		{
			label: "Teams",
			href: "/teams"
		},
		{
			label: "Awards",
			href: "/awards"
		},
		{
			label: "Stats",
			href: "/stats"
		}
	];
	function isCurrentPage(href) {
		if (href === "/") return currentPath === "/";
		return currentPath === href || currentPath.startsWith(`${href}/`);
	}
	return renderTemplate`${maybeRenderHead($$result)}<nav class="site-nav" aria-label="Primary navigation" data-astro-cid-kjc35efj><div class="site-shell site-nav__inner" data-astro-cid-kjc35efj><ul class="site-nav__list" data-astro-cid-kjc35efj>${navigation.map((item) => {
		const isCurrent = isCurrentPage(item.href);
		return renderTemplate`<li class="site-nav__item" data-astro-cid-kjc35efj><a${addAttribute(["site-nav__link", isCurrent && "site-nav__link--current"], "class:list")}${addAttribute(item.href, "href")}${addAttribute(isCurrent ? "page" : void 0, "aria-current")} data-astro-cid-kjc35efj>${item.label}</a></li>`;
	})}</ul></div></nav>`;
}, "/Users/mattbieniek/Documents/Fantasy Football/Website/theleaguegazette/src/components/site/SiteNav.astro", void 0);
//#endregion
//#region src/layouts/BaseLayout.astro
createAstro("https://far-far-away-football.vercel.app");
var $$BaseLayout = createComponent(($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$BaseLayout;
	const { title = "The League Gazette", description = "News, analysis and nonsense from the Far Far Away Fantasy Football League.", image = "/images/home-feature.png", type = "website", noindex = false } = Astro.props;
	const fullTitle = title === "The League Gazette" ? title : `${title} | The League Gazette`;
	const canonicalUrl = new URL(Astro.url.pathname, Astro.site);
	const socialImageUrl = new URL(image, Astro.site);
	return renderTemplate`<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${fullTitle}</title><meta name="description"${addAttribute(description, "content")}>${noindex && renderTemplate`<meta name="robots" content="noindex, nofollow">`}<link rel="canonical"${addAttribute(canonicalUrl, "href")}><meta property="og:site_name" content="The League Gazette"><meta property="og:type"${addAttribute(type, "content")}><meta property="og:title"${addAttribute(fullTitle, "content")}><meta property="og:description"${addAttribute(description, "content")}><meta property="og:url"${addAttribute(canonicalUrl, "content")}><meta property="og:image"${addAttribute(socialImageUrl, "content")}><meta property="og:image:alt" content="The League Gazette"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title"${addAttribute(fullTitle, "content")}><meta name="twitter:description"${addAttribute(description, "content")}><meta name="twitter:image"${addAttribute(socialImageUrl, "content")}><meta name="theme-color" content="#f4f1e9"><link rel="icon" type="image/svg+xml" href="/favicon.svg">${renderHead($$result)}</head><body><a class="skip-link" href="#main-content">Skip to content</a>${renderComponent($$result, "Masthead", $$Masthead, {})}${renderComponent($$result, "SiteNav", $$SiteNav, {})}<main id="main-content" class="page-main">${renderSlot($$result, $$slots["default"])}</main></body></html>`;
}, "/Users/mattbieniek/Documents/Fantasy Football/Website/theleaguegazette/src/layouts/BaseLayout.astro", void 0);
//#endregion
export { renderScript as n, $$BaseLayout as t };
