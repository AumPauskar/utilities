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
            // Convert RGB (0-255) to latex.js's native rgb model (0.0-1.0).
            .replace(/\\definecolor\s*\{([^}]+)\}\s*\{RGB\}\s*\{([^}]+)\}/gi, (_, name, values) => {
                const rgb = values.split(",").map(value => Number(value.trim()) / 255);
                return rgb.length === 3 && rgb.every(Number.isFinite)
                    ? "\\definecolor{" + name + "}{rgb}{" + rgb.join(",") + "}"
                    : "";
            })
            // Convert HTML hex to latex.js's native rgb model.
            .replace(/\\definecolor\s*\{([^}]+)\}\s*\{HTML\}\s*\{([0-9a-fA-F]{6})\}/gi, (_, name, value) => {
                const rgb = [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16) / 255);
                return "\\definecolor{" + name + "}{rgb}{" + rgb.join(",") + "}";
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
            // Extract colors after full RGB normalisation (already done above).
            const colors = preamble.match(/\\definecolor\{[^}]+\}\{[^}]+\}\{[^}]+\}/g) || [];
            const metadata = preamble.match(/\\(?:title|author|date)\{[^}]*\}/g) || [];
            prepared = [documentClass, packages, colors.join("\n"), metadata.join("\n"), body].join("\n");
        }

        // LaTeX.js implements the core article document plus selected packages,
        // but not the native TeX packages used for page layout and box styling.
        prepared = prepared
            // ── Unsupported packages ──────────────────────────────────────────
            .replace(/\\usepackage(?:\[[^\]]*\])?\{(?:geometry|fontenc|lmodern|microtype|graphicx|array|booktabs|tabularx|colortbl|amsmath|amssymb|tcolorbox|fancyhdr|titlesec|enumitem|pifont)\}\s*/gi, "")
            // ── hypersetup block (may span many lines) ────────────────────────
            .replace(/\\hypersetup\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)?\}\s*/g, "")
            // ── Page / layout commands ────────────────────────────────────────
            .replace(/\\pagecolor\{[^}]+\}/g, "")
            .replace(/\\pagestyle\s*\{[^}]+\}/g, "")
            .replace(/\\fancyhf\s*\{[^}]*\}/g, "")
            .replace(/\\(?:headrulewidth|footrulewidth|headrule)\b[^\n]*/g, "")
            .replace(/\\fancy(?:head|foot)\s*\[[^\]]+\]\s*\{[\s\S]*?\}/g, "")
            // ── \setlength / \setlist (may span lines, brace-balanced) ────────
            .replace(/\\setlength\s*\{[^}]*\}\s*\{[^}]*\}/g, "")
            .replace(/\\setlist\s*(?:\[[^\]]*\])?\s*\{[\s\S]*?\}/g, "")
            // ── titlesec: \titleformat and \titlespacing (multi-line, optional args) ─
            .replace(/\\titleformat\s*\{[^}]+\}[\s\S]*?(?=\\|\n\n|\\begin\{document\})/g, "")
            .replace(/\\titlespacing\*?\s*\{[^}]+\}\s*\{[^}]+\}\s*\{[^}]+\}\s*\{[^}]+\}/g, "")
            // ── tcolorbox ────────────────────────────────────────────────────
            .replace(/\\tcbuselibrary\s*\{[^}]+\}/g, "")
            .replace(/\\newtcolorbox\s*\{[^}]+\}\s*\{[\s\S]*?\n\s*\}/g, "")
            // ── Color HTML→float conversion (fallback for body occurrences) ───
            .replace(/\\definecolor\{([^}]+)\}\{HTML\}\{([0-9a-f]{6})\}/gi, (_, name, value) => {
                const rgb = [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16) / 255);
                return "\\definecolor{" + name + "}{rgb}{" + rgb.join(",") + "}";
            })
            // ── \titlerule → horizontal rule approximation ────────────────────
            .replace(/\\titlerule(?:\[[^\]]*\])?/g, "")
            // ── \textbar → literal pipe ───────────────────────────────────────
            .replace(/\\textbar\b/g, "|")
            // ── \texttimes → × ───────────────────────────────────────────────
            .replace(/\\texttimes\b/g, "×")
            // ── \hfill in a paragraph context → \hspace{fill} ─────────────────
            // latex.js supports \hfill inside tabular/minipage; in plain text it
            // can crash — replace with an em-space so alignment is approximated.
            .replace(/\\hfill\b/g, "\\hspace{1em}")
            // ── Custom environments → quote ───────────────────────────────────
            .replace(/\\begin\{(?:hero|metric|insight)\}/g, "\\begin{quote}")
            .replace(/\\end\{(?:hero|metric|insight)\}/g, "\\end{quote}")
            // ── enumitem options on \begin{itemize} ──────────────────────────
            .replace(/\\begin\{itemize\}\s*\[[\s\S]*?\]/g, "\\begin{itemize}")
            // ── tabularx → tabular ────────────────────────────────────────────
            .replace(/\\begin\{tabularx\}\{[^}]+\}/g, "\\begin{tabular}")
            .replace(/\\end\{tabularx\}/g, "\\end{tabular}")
            // ── booktabs / colortbl ───────────────────────────────────────────
            .replace(/\\(?:toprule|midrule|bottomrule|rowcolors\s*\{[^}]+\}\{[^}]+\}\{[^}]+\}|rowcolor\s*\{[^}]+\})/g, "")
            // ── pifont \ding → bullet ─────────────────────────────────────────
            .replace(/\\ding\{[^}]+\}/g, "•")
            // ── Tint shorthand ────────────────────────────────────────────────
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

    async function ensureHtml2Pdf() {
        if (window.html2pdf) return window.html2pdf;
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "lib/html2pdf.bundle.min.js";
            script.onload = () => {
                if (window.html2pdf) resolve(window.html2pdf);
                else reject(new Error("html2pdf failed to initialize."));
            };
            script.onerror = () => {
                const cdnScript = document.createElement("script");
                cdnScript.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
                cdnScript.onload = () => {
                    if (window.html2pdf) resolve(window.html2pdf);
                    else reject(new Error("html2pdf failed to initialize."));
                };
                cdnScript.onerror = () => reject(new Error("Failed to load PDF export library."));
                document.head.appendChild(cdnScript);
            };
            document.head.appendChild(script);
        });
    }

    function getPdfFilename(source, defaultName, regex) {
        if (typeof source === "string" && regex) {
            const match = source.match(regex);
            if (match && match[1]) {
                const clean = match[1].trim().toLowerCase()
                    .replace(/[^a-z0-9]+/gi, "-")
                    .replace(/^-+|-+$/g, "");
                if (clean) return clean + ".pdf";
            }
        }
        return defaultName;
    }

    async function exportToPdf(toolType) {
        const isLatex = toolType === "latex";
        const preview = isLatex ? $("latexPreview") : $("markdownPreview");
        const button = isLatex ? $("latexPrint") : $("markdownPrint");
        const input = isLatex ? $("latexInput") : $("markdownInput");

        if (!preview || !button) return;

        if (preview.classList.contains("compile-error-state")) {
            alert("Please fix the compilation error before exporting to PDF.");
            return;
        }

        if (!preview.textContent.trim()) {
            alert("The document is empty. Please enter some content before exporting.");
            return;
        }

        const originalBtnHtml = button.innerHTML;
        button.disabled = true;
        button.style.pointerEvents = "none";
        button.innerHTML = 'Exporting PDF... <span aria-hidden="true">⏳</span>';

        try {
            await ensureHtml2Pdf();

            const filename = isLatex
                ? getPdfFilename(input ? input.value : "", "latex-document.pdf", /\\title\{([^}]+)\}/)
                : getPdfFilename(input ? input.value : "", "markdown-document.pdf", /^#\s+([^\n#]+)/m);

            const container = document.createElement("div");
            container.className = "document-preview pdf-export-container" + (isLatex ? " latex-preview" : "");
            container.innerHTML = preview.innerHTML;

            const opt = {
                margin: [15, 15, 15, 15],
                filename: filename,
                image: { type: "jpeg", quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    letterRendering: true,
                    logging: false,
                    backgroundColor: "#ffffff"
                },
                jsPDF: {
                    unit: "mm",
                    format: "a4",
                    orientation: "portrait"
                },
                pagebreak: {
                    mode: ["avoid-all", "css", "legacy"],
                    avoid: [
                        "h1", "h2", "h3", "h4", "h5", "h6",
                        "blockquote", "pre", "table", "tr",
                        ".katex-display", ".ltx_equation", ".ltx_tabular",
                        ".ltx_title_document"
                    ]
                }
            };

            await html2pdf().set(opt).from(container).save();
        } catch (error) {
            console.error("PDF export error:", error);
            alert("Failed to export PDF: " + (error.message || String(error)));
        } finally {
            button.disabled = false;
            button.style.pointerEvents = "";
            button.innerHTML = originalBtnHtml;
        }
    }

    if ($("markdownInput")) {
        $("markdownInput").addEventListener("input", updateMarkdownPreview);
        $("markdownPrint").addEventListener("click", () => exportToPdf("markdown"));
        updateMarkdownPreview();
    }

    if ($("latexInput")) {
        $("latexInput").addEventListener("input", event => latexHtml(event.target.value));
        $("latexPrint").addEventListener("click", () => exportToPdf("latex"));
        latexHtml($("latexInput").value);
    }

})();
