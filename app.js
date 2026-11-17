
(() => {

    // The catalog is the single source of truth for navigation, routes, and
    // the landing-page carousel. Adding a utility here adds it everywhere.
    const h = React.createElement;
    const utilitiesCatalog = [
        { id: "video-to-gif", icon: "▣", label: "Video to GIF", detail: "Convert & edit", description: "Trim, crop, and turn local video clips into lightweight GIFs.", accent: "lime" },
        { id: "markdown-to-pdf", icon: "M", label: "Markdown to PDF", detail: "Write & export", description: "Write with Markdown, preview it live, and save a clean PDF.", accent: "blue" },
        { id: "latex-to-pdf", icon: "∑", label: "LaTeX to PDF", detail: "Typeset & export", description: "Compile equations and structured documents directly in your browser.", accent: "gold" },
        { id: "pdf-compress", icon: "⬇", label: "PDF Compress", detail: "Shrink & export", description: "Reduce PDF file size locally by re-encoding images at a compression level you choose.", accent: "rose" }
    ];
    window.utilitiesCatalog = utilitiesCatalog;

    const routeFromPath = () => {
        const file = window.location.pathname.split("/").pop() || "index.html";
        const route = file.replace(/\.html$/i, "");
        return route === "index" ? "home" : route;
    };

    function useRoute() {
        return routeFromPath();
    }

    function navigate(id) {
        window.location.href = id === "home" ? "index.html" : `${id}.html`;
    }

    function Sidebar() {
        const active = useRoute();

        return h("aside", { className: "sidebar" },
            h("a", { className: "sidebar-brand", href: "index.html" },
                h("span", { className: "sidebar-mark" }, "U"),
                h("div", null,
                    h("strong", null, "utilities"),
                    h("span", null, "Local-first tools")
                )
            ),
            h("nav", { className: "tool-nav", "aria-label": "Utilities" },
                h("p", { className: "nav-label" }, "WORKSPACE"),
                h("button", {
                    className: `tool-nav-item home-item${active === "home" ? " active" : ""}`,
                    onClick: () => navigate("home"),
                    "aria-current": active === "home" ? "page" : undefined
                },
                    h("span", { className: "tool-icon", "aria-hidden": "true" }, "⌂"),
                    h("span", { className: "tool-copy" },
                        h("strong", null, "Overview"),
                        h("small", null, "All utilities")
                    )
                ),
                h("p", { className: "nav-label tools-label" }, "TOOLS"),
                utilitiesCatalog.map(tool => h("button", {
                    key: tool.id,
                    className: `tool-nav-item${active === tool.id ? " active" : ""}${tool.disabled ? " disabled" : ""}`,
                    onClick: () => {
                        if (tool.disabled) return;
                        navigate(tool.id);
                    },
                    disabled: tool.disabled,
                    "aria-current": active === tool.id ? "page" : undefined
                },
                    h("span", { className: "tool-icon", "aria-hidden": "true" }, tool.icon),
                    h("span", { className: "tool-copy" },
                        h("strong", null, tool.label),
                        h("small", null, tool.detail)
                    ),
                    tool.disabled ? h("span", { className: "soon-badge" }, "Soon") : null
                ))
            ),
            h("div", { className: "sidebar-foot" },
                h("span", { className: "privacy-dot" }),
                h("span", null, "Private by default")
            )
        );
    }

    function UtilityPreview({ tool }) {
        const preview = tool.id === "video-to-gif"
            ? h("div", { className: "carousel-video-preview" }, h("span", null, "▶"), h("div", { className: "preview-timeline" }))
            : tool.id === "markdown-to-pdf"
                ? h("div", { className: "carousel-document-preview markdown-mini" }, h("b", null, "# Project notes"), h("span", null, "Write **bold** ideas and export."), h("i", null, "✓ PDF ready"))
                : tool.id === "latex-to-pdf"
                    ? h("div", { className: "carousel-document-preview latex-mini" }, h("b", null, "∫ f(x) dx"), h("span", null, "\\section{Results}"), h("i", null, "Compiled locally"))
                    : h("div", { className: "carousel-document-preview compress-mini" }, h("b", null, "⬇"), h("span", null, "Drop PDF → compress"), h("i", null, "Smaller. Local."));

        return h("div", { className: `carousel-preview ${tool.accent}` },
            h("div", { className: "preview-window-bar" }, h("i"), h("i"), h("i"), h("span", null, tool.label)),
            preview
        );
    }

    function Landing() {
        const [slide, setSlide] = React.useState(0);
        const tool = utilitiesCatalog[slide];

        React.useEffect(() => {
            const timer = window.setInterval(() => {
                setSlide(current => (current + 1) % utilitiesCatalog.length);
            }, 4200);
            return () => window.clearInterval(timer);
        }, []);

        return h("section", { className: "landing-page" },
            h("div", { className: "landing-copy" },
                h("p", { className: "eyebrow" }, "A LOCAL-FIRST TOOLKIT"),
                h("h1", null, "Small tools.", h("br"), h("span", null, "Big utility.")),
                h("p", { className: "landing-subhead" }, "A growing collection of focused browser utilities for making, editing, and exporting without sending your files anywhere."),
                h("div", { className: "landing-actions" },
                    h("button", { className: "primary-btn", onClick: () => navigate("video-to-gif") }, "Open Video to GIF", h("span", null, "↗")),
                    h("span", { className: "landing-privacy" }, h("i"), "Private by default")
                )
            ),
            h("div", { className: "landing-carousel", "aria-label": "Utility previews" },
                h("div", { className: "carousel-topline" }, h("span", null, "WHAT YOU CAN DO"), h("span", null, `${String(slide + 1).padStart(2, "0")} / ${String(utilitiesCatalog.length).padStart(2, "0")}`)),
                h(UtilityPreview, { tool }),
                h("div", { className: "carousel-caption" },
                    h("div", null, h("span", { className: "carousel-icon" }, tool.icon), h("div", null, h("h2", null, tool.label), h("p", null, tool.description))),
                    h("button", { className: "carousel-open", onClick: () => navigate(tool.id) }, "Try it", h("span", null, "→"))
                ),
                h("div", { className: "carousel-dots" }, utilitiesCatalog.map((item, index) => h("button", { key: item.id, className: index === slide ? "active" : "", onClick: () => setSlide(index), "aria-label": `Show ${item.label}` })))
            )
        );
    }

    const sidebarRoot = document.getElementById("reactSidebar");
    const landingRoot = document.getElementById("reactLanding");
    if (sidebarRoot) ReactDOM.createRoot(sidebarRoot).render(h(Sidebar));
    if (landingRoot) ReactDOM.createRoot(landingRoot).render(h(Landing));


})();
