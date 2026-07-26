import { _ as createRenderInstruction, h as renderHead, i as renderComponent, m as maybeRenderHead, s as renderSlot, u as renderTemplate, w as createAstro } from "./server_B_hu0jgv.mjs";
import { t as createComponent } from "./compiler_uT6rBWMH.mjs";
//#region \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
//#endregion
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
//#region src/layouts/AdminLayout.astro
createAstro("https://far-far-away-football.vercel.app");
var $$AdminLayout = createComponent(($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$AdminLayout;
	const { title = "Admin | The League Gazette" } = Astro.props;
	return renderTemplate`<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex, nofollow"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><title>${title}</title>${renderHead($$result)}</head><body class="admin-body"><header class="admin-header"><div class="admin-shell admin-header__inner"><a class="admin-brand" href="/admin"><span>The League Gazette</span><strong>Editorial Desk</strong></a><nav aria-label="Admin navigation"><a href="/" target="_blank" rel="noreferrer">View website</a><button id="admin-sign-out" type="button" hidden>Sign out</button></nav></div></header><main>${renderSlot($$result, $$slots["default"])}</main>${renderScript($$result, "/Users/mattbieniek/Documents/Fantasy Football/Website/theleaguegazette/src/layouts/AdminLayout.astro?astro&type=script&index=0&lang.ts")}</body></html>`;
}, "/Users/mattbieniek/Documents/Fantasy Football/Website/theleaguegazette/src/layouts/AdminLayout.astro", void 0);
//#endregion
//#region src/pages/admin/articles/[id].astro
var _id__exports = /* @__PURE__ */ __exportAll({
	default: () => $$Id,
	file: () => $$file,
	prerender: () => false,
	url: () => $$url
});
createAstro("https://far-far-away-football.vercel.app");
var $$Id = createComponent(($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Id;
	const { id } = Astro.params;
	return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, {
		"title": "Edit Article | The League Gazette",
		"data-astro-cid-or2xbkgz": true
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<div class="admin-shell placeholder-page" data-astro-cid-or2xbkgz><p class="eyebrow" data-astro-cid-or2xbkgz>Editorial Desk</p><h1 data-astro-cid-or2xbkgz>Edit article</h1><p data-astro-cid-or2xbkgz>Article ID: ${id}</p><p data-astro-cid-or2xbkgz>The editing form will be added in the next step.</p><a href="/admin" data-astro-cid-or2xbkgz>← Return to dashboard</a></div>` })}`;
}, "/Users/mattbieniek/Documents/Fantasy Football/Website/theleaguegazette/src/pages/admin/articles/[id].astro", void 0);
var $$file = "/Users/mattbieniek/Documents/Fantasy Football/Website/theleaguegazette/src/pages/admin/articles/[id].astro";
var $$url = "/admin/articles/[id]";
//#endregion
//#region \0virtual:astro:page:src/pages/admin/articles/[id]@_@astro
var page = () => _id__exports;
//#endregion
export { page, __exportAll as t };
