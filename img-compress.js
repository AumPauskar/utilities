
(() => {

    // ── State ─────────────────────────────────────────────────────────────────
    let files      = [];   // FileList → Array of File
    let outputFmt  = "jpeg";
    let quality    = 0.80;
    let scalePct   = 1.00; // 0.05 – 1.00
    let bgColor    = "#ffffff";
    let results    = [];   // { name, origSize, blob, objectURL }

    // ── DOM refs ──────────────────────────────────────────────────────────────
    const $  = id => document.getElementById(id);
    const dropzone    = $("imgDropzone");
    const fileInput   = $("imgFileInput");
    const controls    = $("imgControls");
    const fmtLabel    = $("fmtLabel");
    const qLabel      = $("imgQualityLabel");
    const qNum        = $("imgQualityNum");
    const qSlider     = $("imgQualitySlider");
    const rLabel      = $("resizeLabel");
    const rNum        = $("resizeNum");
    const rSlider     = $("resizeSlider");
    const maxWidthIn  = $("maxWidth");
    const maxHeightIn = $("maxHeight");
    const bgLbl       = $("bgLabel");
    const bgPicker    = $("bgColorPicker");
    const stripExif   = $("stripExif");
    const compressBtn = $("imgCompressBtn");
    const btnCount    = $("imgBtnCount");
    const progCard    = $("imgProgress");
    const progBar     = $("imgProgressBar");
    const progPct     = $("imgProgressPct");
    const progLbl     = $("imgProgressLabel");
    const progDet     = $("imgProgressDetail");
    const resultsWrap = $("imgResults");
    const resultsTitle= $("imgResultsTitle");
    const resultsList = $("imgResultsList");
    const dlAllBtn    = $("imgDownloadAll");
    const errorCard   = $("imgError");
    const errorMsg    = $("imgErrorMsg");

    // ── File loading ──────────────────────────────────────────────────────────
    function loadFiles(incoming) {
        const valid = [...incoming].filter(f => f.type.startsWith("image/"));
        if (!valid.length) { showError("No supported image files found. Try JPG, PNG, WebP, GIF, BMP, or AVIF."); return; }

        files = valid;
        clearResults();
        controls.hidden = false;
        dropzone.classList.add("pdf-drop-loaded");

        $("imgDropInner").innerHTML = `
            <div class="upload-icon" style="background:#1e3030; color:#a5f06b">🖼</div>
            <h2 style="font-size:15px; margin:0 0 4px">${files.length} image${files.length > 1 ? "s" : ""} loaded</h2>
            <p style="font-size:12px">${files.map(f => escHtml(f.name)).slice(0,3).join(", ")}${files.length > 3 ? ` +${files.length-3} more` : ""}</p>
            <p style="font-size:11px; color:#7f8b9c; margin:4px 0 0">Click or drop to replace</p>
        `;

        updateBtnCount();
    }

    function updateBtnCount() {
        btnCount.textContent = `${files.length} image${files.length !== 1 ? "s" : ""}`;
    }

    dropzone.addEventListener("click", e => {
        if (e.target === fileInput) return;
        fileInput.click();
    });
    dropzone.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
    });
    fileInput.addEventListener("change", () => {
        if (fileInput.files.length) loadFiles(fileInput.files);
    });
    dropzone.addEventListener("dragover",  e => { e.preventDefault(); dropzone.classList.add("pdf-drop-hover"); });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("pdf-drop-hover"));
    dropzone.addEventListener("drop", e => {
        e.preventDefault();
        dropzone.classList.remove("pdf-drop-hover");
        if (e.dataTransfer.files.length) loadFiles(e.dataTransfer.files);
    });

    // ── Format presets ────────────────────────────────────────────────────────
    document.querySelectorAll(".pdf-preset-btn[data-fmt]").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".pdf-preset-btn[data-fmt]").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            outputFmt = btn.dataset.fmt;
            fmtLabel.textContent = outputFmt.toUpperCase();
        });
    });

    // ── Quality presets / slider ───────────────────────────────────────────────
    const Q_LEVELS = { low: 60, medium: 80, high: 92, max: 100 };
    document.querySelectorAll(".pdf-preset-btn[data-qlevel]").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".pdf-preset-btn[data-qlevel]").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            quality = Q_LEVELS[btn.dataset.qlevel] / 100;
            qSlider.value = Q_LEVELS[btn.dataset.qlevel];
            syncQDisplay();
        });
    });
    qSlider.addEventListener("input", () => {
        quality = qSlider.value / 100;
        document.querySelectorAll(".pdf-preset-btn[data-qlevel]").forEach(b => b.classList.remove("active"));
        syncQDisplay();
    });
    function syncQDisplay() {
        qNum.textContent   = Math.round(quality * 100);
        qLabel.textContent = Math.round(quality * 100) + "%";
    }

    // ── Resize presets / slider ───────────────────────────────────────────────
    document.querySelectorAll(".pdf-preset-btn[data-rscale]").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".pdf-preset-btn[data-rscale]").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            scalePct = parseFloat(btn.dataset.rscale);
            rSlider.value = Math.round(scalePct * 100);
            syncResizeDisplay();
        });
    });
    rSlider.addEventListener("input", () => {
        scalePct = rSlider.value / 100;
        document.querySelectorAll(".pdf-preset-btn[data-rscale]").forEach(b => b.classList.remove("active"));
        syncResizeDisplay();
    });
    function syncResizeDisplay() {
        rNum.textContent   = Math.round(scalePct * 100);
        rLabel.textContent = scalePct >= 1 ? "Original size" : Math.round(scalePct * 100) + "%";
    }

    // ── Background presets ────────────────────────────────────────────────────
    document.querySelectorAll(".pdf-preset-btn[data-bg]").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".pdf-preset-btn[data-bg]").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            bgColor = btn.dataset.bg;
            bgLbl.textContent  = btn.textContent;
            if (bgColor !== "transparent") bgPicker.value = bgColor;
        });
    });
    bgPicker.addEventListener("input", () => {
        bgColor = bgPicker.value;
        document.querySelectorAll(".pdf-preset-btn[data-bg]").forEach(b => b.classList.remove("active"));
        bgLbl.textContent = bgColor;
    });

    // ── Compress ──────────────────────────────────────────────────────────────
    compressBtn.addEventListener("click", runCompression);

    async function runCompression() {
        if (!files.length) return;
        clearResults();
        progCard.hidden = false;
        compressBtn.disabled = true;
        compressBtn.style.opacity = "0.5";
        results = [];

        const maxW = parseInt(maxWidthIn.value)  || Infinity;
        const maxH = parseInt(maxHeightIn.value) || Infinity;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const pct  = Math.round((i / files.length) * 100);
            setProgress(pct, `Processing ${i+1} / ${files.length}…`, file.name);
            await yieldFrame();

            try {
                const blob = await compressImage(file, maxW, maxH);
                const ext  = outputFmt === "jpeg" ? "jpg" : outputFmt;
                const outName = stripExtension(file.name) + "." + ext;
                const url  = URL.createObjectURL(blob);
                results.push({ name: outName, origName: file.name, origSize: file.size, blob, url });
            } catch (err) {
                console.warn("Failed to compress", file.name, err);
                results.push({ name: file.name, origName: file.name, origSize: file.size, blob: null, url: null, error: err.message });
            }
        }

        setProgress(100, "Done!", "");
        await yieldFrame();
        progCard.hidden = true;

        compressBtn.disabled = false;
        compressBtn.style.opacity = "";
        renderResults();
    }

    // ── Core image compression via Canvas ─────────────────────────────────────
    function compressImage(file, maxW, maxH) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(url);

                // Compute target dimensions
                let w = img.naturalWidth;
                let h = img.naturalHeight;

                // Apply percentage scale
                w = Math.max(1, Math.round(w * scalePct));
                h = Math.max(1, Math.round(h * scalePct));

                // Apply max-dimension caps (preserve aspect ratio)
                if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
                if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
                w = Math.max(1, w);
                h = Math.max(1, h);

                const canvas = document.createElement("canvas");
                canvas.width  = w;
                canvas.height = h;
                const ctx = canvas.getContext("2d");

                // Fill background (needed when converting transparent images to JPEG)
                if (bgColor !== "transparent") {
                    ctx.fillStyle = bgColor;
                    ctx.fillRect(0, 0, w, h);
                }

                // High-quality downscaling via imageSmoothingQuality
                ctx.imageSmoothingEnabled  = true;
                ctx.imageSmoothingQuality  = "high";
                ctx.drawImage(img, 0, 0, w, h);

                const mime = "image/" + outputFmt;
                const q    = (outputFmt === "png") ? undefined : quality;

                canvas.toBlob(blob => {
                    if (!blob) return reject(new Error("Canvas toBlob returned null"));
                    resolve(blob);
                }, mime, q);
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error("Could not decode image"));
            };
            img.src = url;
        });
    }

    // ── Results rendering ─────────────────────────────────────────────────────
    function renderResults() {
        const successful = results.filter(r => !r.error);
        const failed     = results.filter(r => r.error);
        const totalOrig  = results.reduce((s, r) => s + r.origSize, 0);
        const totalOut   = successful.reduce((s, r) => s + r.blob.size, 0);
        const saving     = totalOrig - totalOut;
        const savingPct  = totalOrig ? ((saving / totalOrig) * 100).toFixed(1) : 0;

        resultsTitle.textContent = successful.length === 1
            ? `Compressed 1 image — saved ${fmtSize(Math.max(0, saving))} (${savingPct}%)`
            : `Compressed ${successful.length} images — saved ${fmtSize(Math.max(0, saving))} total (${savingPct}%)`;

        resultsList.innerHTML = "";

        results.forEach(r => {
            const row = document.createElement("div");
            row.className = "img-result-row" + (r.error ? " img-result-error" : "");

            if (r.error) {
                row.innerHTML = `
                    <div class="img-result-thumb img-result-thumb-err">✕</div>
                    <div class="img-result-info">
                        <strong>${escHtml(r.origName)}</strong>
                        <span class="img-result-err-msg">${escHtml(r.error)}</span>
                    </div>
                `;
            } else {
                const delta    = r.origSize - r.blob.size;
                const deltaPct = ((delta / r.origSize) * 100).toFixed(1);
                const badge    = delta > 0
                    ? `<span class="img-saving-badge">−${deltaPct}%</span>`
                    : `<span class="img-saving-badge img-saving-badge-warn">+${Math.abs(deltaPct)}%</span>`;

                row.innerHTML = `
                    <div class="img-result-thumb">
                        <img src="${r.url}" alt="${escHtml(r.name)}" loading="lazy">
                    </div>
                    <div class="img-result-info">
                        <strong>${escHtml(r.name)}</strong>
                        <span class="img-result-sizes">${fmtSize(r.origSize)} → <strong>${fmtSize(r.blob.size)}</strong> ${badge}</span>
                    </div>
                    <button class="pdf-preset-btn img-dl-btn" data-idx="${results.indexOf(r)}">Download ↗</button>
                `;
            }

            resultsList.appendChild(row);
        });

        // Per-row download
        resultsList.querySelectorAll(".img-dl-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const r = results[parseInt(btn.dataset.idx)];
                if (r && r.url) triggerDownload(r.url, r.name);
            });
        });

        dlAllBtn.style.display = successful.length > 1 ? "" : "none";
        resultsWrap.hidden = false;
    }

    dlAllBtn.addEventListener("click", async () => {
        const successful = results.filter(r => r.url);
        // Download one at a time with a small delay so the browser doesn't block
        for (const r of successful) {
            triggerDownload(r.url, r.name);
            await new Promise(res => setTimeout(res, 120));
        }
    });

    function triggerDownload(url, name) {
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    function clearResults() {
        // Revoke old object URLs
        results.forEach(r => { if (r.url) URL.revokeObjectURL(r.url); });
        results = [];
        resultsList.innerHTML = "";
        resultsWrap.hidden = true;
        errorCard.hidden   = true;
        progCard.hidden    = true;
    }

    function setProgress(pct, label, detail) {
        progBar.style.width  = pct + "%";
        progPct.textContent  = pct + "%";
        progLbl.textContent  = label;
        progDet.textContent  = detail;
    }

    function showError(msg) {
        errorCard.hidden     = false;
        errorMsg.textContent = msg;
    }

    function fmtSize(b) {
        if (b < 1024)        return b + " B";
        if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
        return (b / (1024 * 1024)).toFixed(2) + " MB";
    }

    function escHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
    }

    function stripExtension(name) {
        return name.replace(/\.[^.]+$/, "");
    }

    function yieldFrame() {
        return new Promise(res => requestAnimationFrame(() => setTimeout(res, 0)));
    }

})();
