(() => {
    const $ = id => document.getElementById(id);

    function escapeHtml(value) {
        return value.replace(/[&<>]/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;"
        }[character]));
    }

    function updateMarkdownPreview() {
        const source = $("markdownInput").value;
        $("markdownPreview").innerHTML = window.marked
            ? marked.parse(source)
            : "<pre>" + escapeHtml(source) + "</pre>";
    }

    let latexAssetsLoaded = false;

    function normalizeLatexColors(source) {
        return source
            // LaTeX.js expects definecolor's final argument as a direct RGB list.
            .replace(/\\definecolor\s*\{([^}]+)\}\s*\{RGB\}\s*\{([^}]+)\}/gi, (_, name, values) => {
                const rgb = values.split(",").map(value => Number(value.trim()) / 255);
                return rgb.length === 3 && rgb.every(Number.isFinite)
                    ? "\\definecolor{" + name + "}{" + rgb.join(",") + "}"
                    : "";
            })
            .replace(/\\definecolor\s*\{([^}]+)\}\s*\{HTML\}\s*\{([0-9a-f]{6})\}/gi, (_, name, value) => {
                const rgb = [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16) / 255);
                return "\\definecolor{" + name + "}{" + rgb.join(",") + "}";
            })
            // The color macros are built into LaTeX.js; these package declarations
            // otherwise make it try to load an unsupported native package.
            .replace(/\\usepackage(?:\[[^\]]*\])?\{(?:xcolor|color)\}/gi, "");
    }

    function prepareLatexForBrowser(source) {
        let prepared = normalizeLatexColors(source);

        // Keep a clean, compatible preamble. This prevents layout/package
        // declarations from being mistaken for document content by the parser.
        const documentStart = prepared.indexOf("\\begin{document}");
        if (documentStart !== -1) {
            const preamble = prepared.slice(0, documentStart);
            const body = prepared.slice(documentStart);
            const documentClass = preamble.match(/\\documentclass(?:\[[^\]]*\])?\{[^}]+\}/)?.[0] || "\\documentclass{article}";
            const packages = (preamble.match(/\\usepackage(?:\[[^\]]*\])?\{(?:multicol|hyperref)\}/gi) || []).join("\n");
            const colors = preamble.match(/\\definecolor\{[^}]+\}\{[^}]+\}/g) || [];
            const metadata = preamble.match(/\\(?:title|author|date)\{[^}]*\}/g) || [];
            prepared = [documentClass, packages, colors.join("\n"), metadata.join("\n"), body].join("\n");
        }

        // LaTeX.js implements the core article document plus selected packages,
        // but not the native TeX packages used for page layout and box styling.
        prepared = prepared
            .replace(/\\usepackage(?:\[[^\]]*\])?\{(?:geometry|fontenc|lmodern|microtype|graphicx|array|booktabs|tabularx|colortbl|amsmath|amssymb|tcolorbox|fancyhdr|titlesec|enumitem|pifont)\}\s*/gi, "")
            .replace(/\\hypersetup\{[\s\S]*?\}\s*/g, "")
            .replace(/\\pagecolor\{[^}]+\}/g, "")
            .replace(/\\(?:pagestyle|fancyhf|headrulewidth|footrulewidth|headrule)\b[^\n]*/g, "")
            .replace(/\\fancy(?:head|foot)\s*\[[^\]]+\]\s*\{[\s\S]*?\}/g, "")
            .replace(/\\(?:titleformat|titlespacing)\s*\n?[\s\S]*?\n\s*\}/g, "")
            .replace(/\\(?:setlength|tcbuselibrary)\s*\{[\s\S]*?\}/g, "")
            .replace(/\\newtcolorbox\s*\{[^}]+\}\s*\{[\s\S]*?\n\s*\}/g, "")
            .replace(/\\definecolor\{([^}]+)\}\{HTML\}\{([0-9a-f]{6})\}/gi, (_, name, value) => {
                const rgb = [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16) / 255);
                return "\\definecolor{" + name + "}{" + rgb.join(",") + "}";
            })
            .replace(/\\begin\{(?:hero|metric|insight)\}/g, "\\begin{quote}")
            .replace(/\\end\{(?:hero|metric|insight)\}/g, "\\end{quote}")
            .replace(/\\begin\{itemize\}\s*\[[\s\S]*?\]/g, "\\begin{itemize}")
            .replace(/\\begin\{tabularx\}\{[^}]+\}/g, "\\begin{tabular}")
            .replace(/\\end\{tabularx\}/g, "\\end{tabular}")
            .replace(/\\(?:toprule|midrule|bottomrule|rowcolors\s*\{[^}]+\}\{[^}]+\}\{[^}]+\}|rowcolor\s*\{[^}]+\})/g, "")
            .replace(/\\ding\{[^}]+\}/g, "•")
            .replace(/\\color\{white!\d+\}/g, "\\color{white}");

        return prepared;
    }

    function latexHtml(source) {
        const target = $("latexPreview");

        if (!window.latexjs) {
            target.innerHTML = "<p class=\"compile-error\">The LaTeX compiler is still loading. Try again in a moment.</p>";
            return;
        }

        try {
            const generator = new latexjs.HtmlGenerator({ hyphenate: false });
            latexjs.parse(prepareLatexForBrowser(source), { generator });

            if (!latexAssetsLoaded) {
                document.head.appendChild(
                    generator.stylesAndScripts("https://cdn.jsdelivr.net/npm/latex.js@0.12.6/dist/")
                );
                latexAssetsLoaded = true;
            }

            target.replaceChildren(generator.domFragment());
            target.classList.remove("compile-error-state");
        } catch (error) {
            target.classList.add("compile-error-state");
            target.innerHTML = "<strong>Compilation error</strong><pre>" +
                escapeHtml(error.message || String(error)) +
                "</pre><small>Check the LaTeX source near the reported command.</small>";
        }
    }

    if ($("markdownInput")) {
        $("markdownInput").addEventListener("input", updateMarkdownPreview);
        $("markdownPrint").addEventListener("click", () => window.print());
        updateMarkdownPreview();
    }

    if ($("latexInput")) {
        $("latexInput").addEventListener("input", event => latexHtml(event.target.value));
        $("latexPrint").addEventListener("click", () => window.print());
        latexHtml($("latexInput").value);
    }

})();
