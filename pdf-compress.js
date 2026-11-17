
(() => {

    // ── State ─────────────────────────────────────────────────────────────────
    let originalFile   = null;    // File object from the input
    let compressedBlob = null;    // Most-recently produced compressed PDF
    let quality        = 0.60;    // JPEG quality 0–1
    let scale          = 1.00;    // Image resolution scale 0.1–1

    // ── DOM refs ──────────────────────────────────────────────────────────────
    const $ = id => document.getElementById(id);
    const dropzone      = $("pdfDropzone");
    const fileInput     = $("pdfFileInput");
    const controls      = $("pdfControls");
    const infoBar       = $("pdfInfoBar");
    const qualitySlider = $("qualitySlider");
    const qualityNum    = $("qualityNum");
    const qualityLabel  = $("qualityLabel");
    const scaleSlider   = $("scaleSlider");
    const scaleNum      = $("scaleNum");
    const scaleLabel    = $("scaleLabel");
    const compressBtn   = $("compressBtn");
    const progress      = $("pdfProgress");
    const progressBar   = $("progressBar");
    const progressPct   = $("progressPct");
    const progressLbl   = $("progressLabel");
    const progressDet   = $("progressDetail");
    const resultCard    = $("pdfResult");
    const resultLbl     = $("resultLabel");
    const resultDet     = $("resultDetail");
    const downloadBtn   = $("downloadBtn");
    const errorCard     = $("pdfError");
    const errorMsg      = $("pdfErrorMsg");

    // ── File loading ──────────────────────────────────────────────────────────
    function loadFile(file) {
        if (!file || file.type !== "application/pdf") {
            showError("Please select a valid PDF file.");
            return;
        }
        originalFile   = file;
        compressedBlob = null;
        hideResultAndError();
        progress.hidden = true;

        infoBar.innerHTML = `
            <span class="pdf-info-item"><strong>${escHtml(file.name)}</strong></span>
            <span class="pdf-info-item">Original size: <strong>${fmtSize(file.size)}</strong></span>
            <span class="pdf-info-item pdf-info-muted">Ready to compress</span>
        `;
        controls.hidden = false;
        dropzone.classList.add("pdf-drop-loaded");
        $("pdfDropInner").innerHTML = `
            <div class="upload-icon" style="background:#1e3030; color:#a5f06b">📄</div>
            <h2 style="font-size:15px; margin:0 0 4px">${escHtml(file.name)}</h2>
            <p style="font-size:12px">${fmtSize(file.size)} · Click or drop to replace</p>
        `;
    }

    dropzone.addEventListener("click", e => {
        if (e.target === fileInput) return;
        fileInput.click();
    });
    dropzone.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
    });
    fileInput.addEventListener("change", () => {
        if (fileInput.files[0]) loadFile(fileInput.files[0]);
    });
    dropzone.addEventListener("dragover",  e => { e.preventDefault(); dropzone.classList.add("pdf-drop-hover"); });
    dropzone.addEventListener("dragleave", e => { dropzone.classList.remove("pdf-drop-hover"); });
    dropzone.addEventListener("drop", e => {
        e.preventDefault();
        dropzone.classList.remove("pdf-drop-hover");
        const f = e.dataTransfer.files[0];
        if (f) loadFile(f);
    });

    // ── Preset buttons ────────────────────────────────────────────────────────
    const QUALITY_PRESETS = { low: 0.85, medium: 0.60, high: 0.35, extreme: 0.12 };
    const QUALITY_LABELS  = { low: "Low (max size)", medium: "Medium", high: "High (best quality)", extreme: "Extreme" };

    document.querySelectorAll(".pdf-preset-btn[data-level]").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".pdf-preset-btn[data-level]").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const q = QUALITY_PRESETS[btn.dataset.level];
            quality = q;
            qualitySlider.value = Math.round(q * 100);
            updateQualityDisplay();
        });
    });

    document.querySelectorAll(".pdf-preset-btn[data-scale]").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".pdf-preset-btn[data-scale]").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const s = parseFloat(btn.dataset.scale);
            scale = s;
            scaleSlider.value = s;
            updateScaleDisplay();
        });
    });

    qualitySlider.addEventListener("input", () => {
        quality = qualitySlider.value / 100;
        document.querySelectorAll(".pdf-preset-btn[data-level]").forEach(b => b.classList.remove("active"));
        updateQualityDisplay();
    });

    scaleSlider.addEventListener("input", () => {
        scale = parseFloat(scaleSlider.value);
        document.querySelectorAll(".pdf-preset-btn[data-scale]").forEach(b => b.classList.remove("active"));
        updateScaleDisplay();
    });

    function updateQualityDisplay() {
        qualityNum.textContent   = Math.round(quality * 100);
        const pct = Math.round(quality * 100);
        qualityLabel.textContent = pct >= 80 ? "Low compression" : pct >= 50 ? "Medium" : pct >= 25 ? "High" : "Extreme";
    }

    function updateScaleDisplay() {
        scaleNum.textContent = scale.toFixed(2);
        scaleLabel.textContent = scale >= 1 ? "1× (original)" : scale.toFixed(2) + "×";
    }

    // ── Compression ───────────────────────────────────────────────────────────
    compressBtn.addEventListener("click", () => runCompression());

    async function runCompression() {
        if (!originalFile) return;
        hideResultAndError();
        progress.hidden = false;
        compressBtn.disabled = true;
        compressBtn.textContent = "Compressing…";

        setProgress(0, "Loading PDF…", "");
        compressedBlob = null;

        try {
            const arrayBuf = await originalFile.arrayBuffer();
            const { PDFDocument } = PDFLib;

            setProgress(5, "Parsing PDF…", "");
            const srcDoc = await PDFDocument.load(arrayBuf, { ignoreEncryption: true });
            const dstDoc = await PDFDocument.create();

            // Copy pages
            const pageCount = srcDoc.getPageCount();
            const indices   = Array.from({ length: pageCount }, (_, i) => i);
            const copiedPages = await dstDoc.copyPages(srcDoc, indices);
            copiedPages.forEach(p => dstDoc.addPage(p));

            // Re-encode all JPEG and PNG images found in the document
            const imageObjects = collectImageXObjects(srcDoc);
            const total = imageObjects.length;
            let done = 0;

            setProgress(10, `Re-encoding images (0 / ${total})…`, total === 0 ? "No re-encodable images found — will still re-save with optimised structure." : "");

            for (const { ref, xobj } of imageObjects) {
                await reencodeImage(dstDoc, ref, xobj);
                done++;
                const pct = 10 + Math.round((done / Math.max(total, 1)) * 80);
                setProgress(pct, `Re-encoding images (${done} / ${total})…`, "");
                // Yield to the event loop so the UI can repaint
                await yieldFrame();
            }

            setProgress(93, "Saving PDF…", "");
            await yieldFrame();

            const bytes = await dstDoc.save({ useObjectStreams: true });
            compressedBlob = new Blob([bytes], { type: "application/pdf" });

            const saved = originalFile.size - compressedBlob.size;
            const pct   = ((saved / originalFile.size) * 100).toFixed(1);
            setProgress(100, "Done!", "");
            await yieldFrame();
            progress.hidden = true;

            const positiveResult = saved > 0;
            resultLbl.textContent = positiveResult
                ? `Saved ${fmtSize(Math.abs(saved))} (${pct}% smaller)`
                : `File size: ${fmtSize(compressedBlob.size)} (no reduction achieved)`;
            resultDet.textContent = `${fmtSize(originalFile.size)} → ${fmtSize(compressedBlob.size)}`;
            resultCard.hidden = false;

        } catch (err) {
            console.error("PDF compression error:", err);
            progress.hidden = true;
            showError(err.message || String(err));
        } finally {
            compressBtn.disabled = false;
            compressBtn.innerHTML = "Compress PDF <span>↓</span>";
        }
    }

    // ── Image extraction & re-encoding ────────────────────────────────────────

    /**
     * Walk the XRef table of a loaded PDFDocument and collect all Image XObjects
     * that contain DCTDecode (JPEG) or FlateDecode (PNG-like) streams.
     */
    function collectImageXObjects(pdfDoc) {
        const context = pdfDoc.context;
        const results = [];

        try {
            // Iterate over all indirect objects in the cross-reference table
            for (const [ref, obj] of context.enumerateIndirectObjects()) {
                if (!obj || typeof obj.dict === "undefined") continue;
                const dict = obj.dict;
                if (!dict) continue;

                // Must be a /XObject of /Subtype /Image
                const type    = dict.get(PDFLib.PDFName.of("Type"));
                const subtype = dict.get(PDFLib.PDFName.of("Subtype"));
                if (!subtype) continue;
                if (subtype.toString() !== "/Image") continue;

                results.push({ ref, xobj: obj });
            }
        } catch (e) {
            // Partial failure — continue with what we have
            console.warn("collectImageXObjects partial error:", e);
        }

        return results;
    }

    /**
     * Re-encode a single image XObject by drawing it onto an offscreen canvas
     * and exporting as JPEG at the chosen quality.  The recompressed JPEG bytes
     * are written back into the destination document via the same indirect ref.
     */
    async function reencodeImage(dstDoc, ref, xobj) {
        try {
            const dict   = xobj.dict;
            const filter = dict.get(PDFLib.PDFName.of("Filter"));
            const width  = dict.get(PDFLib.PDFName.of("Width"));
            const height = dict.get(PDFLib.PDFName.of("Height"));

            if (!width || !height) return;
            const w = width.asNumber();
            const h = height.asNumber();
            if (w < 2 || h < 2) return;

            // Only attempt for DCTDecode (JPEG) or FlateDecode images; skip masks, etc.
            const filterName = filter ? filter.toString() : "";
            const isJpeg     = filterName === "/DCTDecode";
            const isFlate    = filterName === "/FlateDecode";
            if (!isJpeg && !isFlate) return;

            // Skip 1-bit / Mask images
            const colorSpace = dict.get(PDFLib.PDFName.of("ColorSpace"));
            if (colorSpace && colorSpace.toString() === "/DeviceGray") {
                // Gray images — still try, just draw as gray
            }
            const imageMask = dict.get(PDFLib.PDFName.of("ImageMask"));
            if (imageMask && imageMask.toString() === "true") return;

            // Get the raw stream bytes
            const rawBytes = xobj.getContents ? xobj.getContents() : null;
            if (!rawBytes || rawBytes.length === 0) return;

            // Decode the image bytes into an ImageBitmap via a Blob URL
            const mimeType = isJpeg ? "image/jpeg" : "image/png";
            let decoded;
            if (isJpeg) {
                decoded = rawBytes;
            } else {
                // Flate-compressed: decompress with pako
                try {
                    decoded = pako.inflate(rawBytes);
                } catch {
                    return; // Can't decode — skip
                }
            }

            const blob = new Blob([decoded], { type: mimeType });
            const bmpUrl = URL.createObjectURL(blob);

            let bitmap;
            try {
                bitmap = await createImageBitmap(new Blob([decoded], { type: mimeType }));
            } catch {
                URL.revokeObjectURL(bmpUrl);
                return;
            }
            URL.revokeObjectURL(bmpUrl);

            // Draw onto canvas at the target scale
            const tw = Math.max(1, Math.round(w * scale));
            const th = Math.max(1, Math.round(h * scale));
            const canvas = document.createElement("canvas");
            canvas.width  = tw;
            canvas.height = th;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(bitmap, 0, 0, tw, th);
            bitmap.close();

            // Export as JPEG blob
            const jpegBlob = await new Promise(res => canvas.toBlob(res, "image/jpeg", quality));
            if (!jpegBlob) return;
            const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());

            // Patch the XObject dict and stream in the destination document.
            // We access the dst doc's context to overwrite the same ref.
            const dstContext = dstDoc.context;
            const newStream  = dstContext.stream(jpegBytes, {
                Type:             "XObject",
                Subtype:          "Image",
                Width:            tw,
                Height:           th,
                ColorSpace:       "DeviceRGB",
                BitsPerComponent: 8,
                Filter:           "DCTDecode",
            });
            dstContext.assign(ref, newStream);

        } catch (err) {
            // Non-fatal: skip this image
            console.warn("reencodeImage skipped one image:", err);
        }
    }

    // ── Download ──────────────────────────────────────────────────────────────
    downloadBtn.addEventListener("click", () => {
        if (!compressedBlob) return;
        const baseName = originalFile.name.replace(/\.pdf$/i, "");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(compressedBlob);
        a.download = baseName + "-compressed.pdf";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    });

    // ── Helpers ───────────────────────────────────────────────────────────────
    function setProgress(pct, label, detail) {
        progressBar.style.width = pct + "%";
        progressPct.textContent  = pct + "%";
        progressLbl.textContent  = label;
        progressDet.textContent  = detail;
    }

    function hideResultAndError() {
        resultCard.hidden = true;
        errorCard.hidden  = true;
    }

    function showError(msg) {
        errorCard.hidden  = false;
        errorMsg.textContent = msg;
    }

    function fmtSize(bytes) {
        if (bytes < 1024)        return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / (1024 * 1024)).toFixed(2) + " MB";
    }

    function escHtml(str) {
        return str.replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c]));
    }

    function yieldFrame() {
        return new Promise(res => requestAnimationFrame(() => setTimeout(res, 0)));
    }

})();
