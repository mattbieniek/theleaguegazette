import { g as addAttribute, h as renderHead, i as renderComponent, m as maybeRenderHead, s as renderSlot, u as renderTemplate, w as createAstro } from "./server_B_hu0jgv.mjs";
import { t as createComponent } from "./compiler_uT6rBWMH.mjs";
//#region src/components/site/Masthead.astro
var $$Masthead = createComponent(($$result, $$props, $$slots) => {
	const publicationDate = new Intl.DateTimeFormat("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
		year: "numeric"
	}).format(/* @__PURE__ */ new Date());
	return renderTemplate`${maybeRenderHead($$result)}<header class="masthead" data-astro-cid-3rxsxc55><div class="site-shell masthead__inner" data-astro-cid-3rxsxc55><div class="masthead__meta masthead__meta--left" data-astro-cid-3rxsxc55><span data-astro-cid-3rxsxc55>Far Far Away Football</span><span class="masthead__edition" data-astro-cid-3rxsxc55>Established 2022</span></div><a class="masthead__identity" href="/" aria-label="The League Gazette homepage" data-astro-cid-3rxsxc55><span class="masthead__title" data-astro-cid-3rxsxc55>The League Gazette</span><span class="masthead__tagline" data-astro-cid-3rxsxc55>News, analysis and nonsense from around the league</span></a><div class="masthead__meta masthead__meta--right" data-astro-cid-3rxsxc55><time${addAttribute((/* @__PURE__ */ new Date()).toISOString(), "datetime")} data-astro-cid-3rxsxc55>${publicationDate}</time><span class="masthead__edition" data-astro-cid-3rxsxc55>Houston, Texas</span></div></div></header>`;
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
			label: "Power Rankings",
			href: "/power-rankings"
		},
		{
			label: "League History",
			href: "/history"
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
	const { title = "The League Gazette", description = "News, analysis and nonsense from the Far Far Away Fantasy Football League." } = Astro.props;
	const fullTitle = title === "The League Gazette" ? title : `${title} | The League Gazette`;
	return renderTemplate`<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description"${addAttribute(description, "content")}><meta name="theme-color" content="#f4f1e9"><title>${fullTitle}</title><link rel="icon" type="image/svg+xml" href="/favicon.svg">${renderHead($$result)}</head><body><a class="skip-link" href="#main-content">Skip to content</a>${renderComponent($$result, "Masthead", $$Masthead, {})}${renderComponent($$result, "SiteNav", $$SiteNav, {})}<main id="main-content" class="page-main">${renderSlot($$result, $$slots["default"])}</main></body></html>`;
}, "/Users/mattbieniek/Documents/Fantasy Football/Website/theleaguegazette/src/layouts/BaseLayout.astro", void 0);
//#endregion
export { $$BaseLayout as t };
