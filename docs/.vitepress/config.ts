import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitepress";

/**
 * The site is the `docs/` directory rendered as-is, plus what `scripts/generate.mjs`
 * writes into `docs/generated/` from the product (the CLI usage table, the registry
 * documents, the operating note, the changelog). Generated pages are rewritten to
 * their place in the sidebar; `docs/archive/` is design history and is not built.
 *
 * A relative link that leaves `docs/` — a source file, a fixture, a definition file —
 * becomes a link into the repository on GitHub, so the same Markdown reads on GitHub
 * and on the site without two copies of every link.
 */
const DOCS = fileURLToPath(new URL("..", import.meta.url));
const ROOT = path.resolve(DOCS, "..");
const REPO = "https://github.com/MetaCoding-io/regulator";

export default defineConfig({
  title: "regulator",
  description: "An agent harness on Pi with an explicit cybernetic control plane: prompts advise, types describe, gates enforce.",
  base: "/regulator/",
  lang: "en-US",
  lastUpdated: true,
  cleanUrls: true,
  srcExclude: ["archive/**", "README.md"],
  rewrites: {
    "generated/cli.md": "reference/cli.md",
    "generated/regulators.md": "reference/regulators.md",
    "generated/boundary.md": "reference/boundary.md",
    "generated/operating.md": "guide/operating.md",
    "generated/changelog.md": "project/changelog.md",
    "generated/roadmap.md": "project/roadmap.md",
    "generated/contributing.md": "project/contributing.md",
  },
  head: [["link", { rel: "icon", type: "image/svg+xml", href: "/regulator/favicon.svg" }]],
  themeConfig: {
    logo: "/favicon.svg",
    siteTitle: "regulator",
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Concepts", link: "/concepts/control-plane" },
      { text: "Reference", link: "/reference/cli" },
      { text: "Project", link: "/project/roadmap" },
      { text: "Course", link: "https://github.com/MetaCoding-io/viable-agents-course" },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting started", link: "/guide/getting-started" },
          { text: "Running units", link: "/guide/running-units" },
          { text: "Operating", link: "/guide/operating" },
          { text: "Worked example: a household ledger", link: "/examples/personal-finance" },
        ],
      },
      {
        text: "Concepts",
        items: [
          { text: "The control plane", link: "/concepts/control-plane" },
          { text: "Definition, instance, domain", link: "/concepts/definition-and-instance" },
          { text: "Architecture", link: "/ARCHITECTURE" },
          { text: "Glossary", link: "/GLOSSARY" },
          { text: "Pathologies", link: "/PATHOLOGIES" },
          { text: "Typed reporting", link: "/REPORTING" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "CLI", link: "/reference/cli" },
          { text: "Definition files", link: "/reference/definition" },
          { text: "Instance layout", link: "/reference/instance" },
          { text: "Host checks", link: "/reference/host-checks" },
          { text: "Regulators", link: "/reference/regulators" },
          { text: "Enforcement boundary", link: "/reference/boundary" },
        ],
      },
      {
        text: "Project",
        items: [
          { text: "Roadmap", link: "/project/roadmap" },
          { text: "Changelog", link: "/project/changelog" },
          { text: "Build debt", link: "/DEBT" },
          { text: "Decisions", link: "/decisions/0001-own-orchestrator" },
          { text: "Packages", link: "/project/packages" },
          { text: "Contributing", link: "/project/contributing" },
        ],
      },
    ],
    socialLinks: [{ icon: "github", link: REPO }],
    editLink: {
      pattern: "https://github.com/MetaCoding-io/regulator/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },
    search: { provider: "local" },
    footer: {
      message: "Released under the Apache-2.0 License.",
      copyright: "Copyright © 2025–present MetaCoding",
    },
    outline: { level: [2, 3] },
  },
  markdown: {
    config(md) {
      const fallback = md.renderer.rules.link_open ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
      md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
        const token = tokens[idx]!;
        const href = token.attrGet("href");
        const file: string | undefined = env?.path;
        if (href && file && !/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(href)) {
          const [target, hash] = href.split("#");
          const absolute = path.resolve(path.dirname(file), target!);
          if (!absolute.startsWith(DOCS) || absolute.startsWith(path.join(DOCS, "archive"))) {
            const relative = path.relative(ROOT, absolute).split(path.sep).join("/");
            token.attrSet("href", `${REPO}/blob/main/${relative}${hash ? `#${hash}` : ""}`);
          }
        }
        return fallback(tokens, idx, options, env, self);
      };
    },
  },
});
