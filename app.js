
(() => {

    const $ = id => document.getElementById(id);

    const video = $("video");
    const canvas = $("previewCanvas");
    const ctx = canvas.getContext("2d");

    let sourceUrl = null;
    let duration = 0;
    let raf = 0;
    let exporting = false;
    let lastDownloadUrl = null;


    // -------------------------
    // UTILITIES
    // -------------------------

    const fmt = seconds => {
        seconds = Math.max(0, Number(seconds) || 0);

        const minutes = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(1);

        return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(4, "0")}`;
    };

    const clamp = (value, min, max) => {
        return Math.max(min, Math.min(max, Number(value) || 0));
    };


    // -------------------------
    // CROP SETTINGS
    // -------------------------

    function crop() {

        const x = clamp($("cropX").value, 0, 99);
        const y = clamp($("cropY").value, 0, 99);

        const w = clamp($("cropW").value, 1, 100 - x);
        const h = clamp($("cropH").value, 1, 100 - y);

        return {
            x: x / 100,
            y: y / 100,
            w: w / 100,
            h: h / 100
        };
    }


    function dims() {

        const c = crop();

        return {
            x: Math.round(c.x * video.videoWidth),
            y: Math.round(c.y * video.videoHeight),

            w: Math.max(1, Math.round(c.w * video.videoWidth)),
            h: Math.max(1, Math.round(c.h * video.videoHeight))
        };
    }


    // -------------------------
    // PREVIEW RENDERING
    // -------------------------

    function drawPreview() {

        if (!video.videoWidth) return;

        const c = crop();

        const outW = Math.max(
            1,
            Math.round(video.videoWidth * c.w)
        );

        const outH = Math.max(
            1,
            Math.round(video.videoHeight * c.h)
        );

        const scale = Math.min(
            900 / outW,
            520 / outH,
            1
        );

        canvas.width = Math.max(1, Math.round(outW * scale));
        canvas.height = Math.max(1, Math.round(outH * scale));

        ctx.drawImage(
            video,
            Math.round(c.x * video.videoWidth),
            Math.round(c.y * video.videoHeight),
            outW,
            outH,
            0,
            0,
            canvas.width,
            canvas.height
        );

        $("cropDimensions").textContent =
            `${outW} × ${outH} px`;

        $("currentTime").textContent = fmt(video.currentTime);
        $("timeReadout").textContent = fmt(video.currentTime);

        $("scrubber").value = duration
            ? video.currentTime / duration * 1000
            : 0;
    }


    function loop() {

        drawPreview();

        if (!video.paused && !video.ended) {
            raf = requestAnimationFrame(loop);
        }
    }


    function setEnabled(enabled) {

        [
            "exportTrim",
            "exportCrop",
            "exportGif",
            "scrubber"
        ].forEach(id => {
            $(id).disabled = !enabled;
        });
    }


    // -------------------------
    // VIDEO LOADING
    // -------------------------

    function loadFile(file) {

        if (!file) return;

        if (!file.type.startsWith("video/")) {
            alert("Please select a video file.");
            return;
        }

        if (sourceUrl) {
            URL.revokeObjectURL(sourceUrl);
        }

        sourceUrl = URL.createObjectURL(file);

        video.src = sourceUrl;
        video.load();

        $("emptyState").hidden = true;
        $("stageOverlay").hidden = false;

        $("dropzone").classList.add("loaded");

        $("fileMeta").textContent = file.name;

        $("resultCard").hidden = true;
        $("progressCard").hidden = true;

        setEnabled(false);
    }


    video.addEventListener("loadedmetadata", () => {

        duration = video.duration || 0;

        $("duration").textContent = fmt(duration);

        $("trimStart").value = "0";
        $("trimEnd").value = duration.toFixed(1);

        $("gifStart").value = "0";
        $("gifEnd").value = duration.toFixed(1);

        $("startRange").value = 0;
        $("endRange").value = 1000;

        setEnabled(true);

        updateTrim();
        updateGifEstimate();
        drawPreview();
    });


    video.addEventListener("timeupdate", drawPreview);


    video.addEventListener("play", () => {

        $("playBtn").textContent = "Ⅱ";

        cancelAnimationFrame(raf);
        loop();
    });


    video.addEventListener("pause", () => {

        $("playBtn").textContent = "▶";

        cancelAnimationFrame(raf);
        drawPreview();
    });


    $("fileInput").addEventListener("change", e => {
        loadFile(e.target.files[0]);
    });


    $("replaceInput").addEventListener("change", e => {
        loadFile(e.target.files[0]);
    });


    // Drag and drop

    $("dropzone").addEventListener("dragover", e => {

        e.preventDefault();

        $("dropzone").style.outline =
            "2px dashed #a5f06b";
    });


    $("dropzone").addEventListener("dragleave", () => {

        $("dropzone").style.outline = "";
    });


    $("dropzone").addEventListener("drop", e => {

        e.preventDefault();

        $("dropzone").style.outline = "";

        loadFile(e.dataTransfer.files[0]);
    });


    $("playBtn").addEventListener("click", () => {

        if (video.paused) {
            video.play();
        } else {
            video.pause();
        }
    });


    // Timeline

    $("scrubber").addEventListener("input", e => {

        video.currentTime =
            duration * Number(e.target.value) / 1000;
    });


    // -------------------------
    // TAB SWITCHING
    // -------------------------

    document.querySelectorAll(".tab").forEach(button => {

        button.addEventListener("click", () => {

            document.querySelectorAll(".tab").forEach(tab => {
                tab.classList.toggle("active", tab === button);
            });

            document.querySelectorAll(".tool-panel").forEach(panel => {

                panel.classList.toggle(
                    "active",
                    panel.id === `panel-${button.dataset.tab}`
                );
            });
        });
    });


    // -------------------------
    // TRIMMING
    // -------------------------

    function updateTrim() {

        if (!duration) return;

        let start = clamp(
            $("trimStart").value,
            0,
            duration
        );

        let end = clamp(
            $("trimEnd").value,
            0,
            duration
        );

        if (end < start) {
            end = start;
            $("trimEnd").value = end.toFixed(1);
        }

        $("trimStart").value = start.toFixed(1);
        $("trimEnd").value = end.toFixed(1);

        $("startRange").value = start / duration * 1000;
        $("endRange").value = end / duration * 1000;

        $("selectedDuration").textContent =
            fmt(end - start);
    }


    $("trimStart").addEventListener("change", updateTrim);
    $("trimEnd").addEventListener("change", updateTrim);


    $("startRange").addEventListener("input", e => {

        $("trimStart").value =
            (duration * e.target.value / 1000).toFixed(1);

        updateTrim();
    });


    $("endRange").addEventListener("input", e => {

        $("trimEnd").value =
            (duration * e.target.value / 1000).toFixed(1);

        updateTrim();
    });


    // -------------------------
    // GIF ESTIMATION
    // -------------------------

    function updateGifEstimate() {

        const start = clamp($("gifStart").value, 0, duration);
        const end = clamp($("gifEnd").value, 0, duration);

        const fps = Number($("gifFps").value);

        const frames = Math.max(
            0,
            Math.ceil((end - start) * fps)
        );

        $("gifFrames").textContent =
            `${frames} frames`;
    }


    ["gifStart", "gifEnd", "gifFps"].forEach(id => {

        $(id).addEventListener("change", updateGifEstimate);
    });


    // -------------------------
    // CROP PREVIEW
    // -------------------------

    ["cropX", "cropY", "cropW", "cropH"].forEach(id => {

        $(id).addEventListener("input", drawPreview);
    });


    // Crop aspect ratio presets

    document.querySelectorAll("[data-ratio]").forEach(button => {

        button.addEventListener("click", () => {

            if (!video.videoWidth) return;

            const ratio = button.dataset.ratio;

            if (ratio === "original") {

                $("cropX").value = 0;
                $("cropY").value = 0;
                $("cropW").value = 100;
                $("cropH").value = 100;

            } else {

                const [rw, rh] = ratio.split(":").map(Number);

                const target = rw / rh;

                const source =
                    video.videoWidth / video.videoHeight;

                let w = 100;
                let h = 100;

                if (source > target) {
                    w = 100 * target / source;
                } else {
                    h = 100 * source / target;
                }

                $("cropW").value = w.toFixed(1);
                $("cropH").value = h.toFixed(1);

                $("cropX").value = ((100 - w) / 2).toFixed(1);
                $("cropY").value = ((100 - h) / 2).toFixed(1);
            }

            drawPreview();
        });
    });


    // -------------------------
    // EXPORT UI
    // -------------------------

    function progress(title, message) {

        $("progressCard").hidden = false;

        $("progressTitle").textContent = title;
        $("progressMessage").textContent = message;

        $("progressPercent").textContent = "0%";
        $("progressBar").style.width = "0%";

        $("resultCard").hidden = true;
    }


    function setProgress(percent, message) {

        $("progressPercent").textContent =
            `${Math.round(percent)}%`;

        $("progressBar").style.width =
            `${percent}%`;

        if (message) {
            $("progressMessage").textContent = message;
        }
    }


    function finishBlob(blob, filename) {

        if (lastDownloadUrl) {
            URL.revokeObjectURL(lastDownloadUrl);
        }

        lastDownloadUrl = URL.createObjectURL(blob);

        $("downloadLink").href = lastDownloadUrl;
        $("downloadLink").download = filename;

        $("resultTitle").textContent = "Your export is ready";

        $("resultMeta").textContent =
            `${filename} · ${(blob.size / 1024 / 1024).toFixed(2)} MB`;

        $("resultCard").hidden = false;
        $("progressCard").hidden = true;
    }


    // -------------------------
    // VIDEO EXPORT
    // -------------------------

    function recorderMime() {

        if (!window.MediaRecorder) return "";

        return [
            "video/webm;codecs=vp9,opus",
            "video/webm;codecs=vp8,opus",
            "video/webm"
        ].find(type => MediaRecorder.isTypeSupported(type)) || "";
    }


    function seekTo(time) {

        return new Promise((resolve, reject) => {

            const timeout = setTimeout(() => {
                reject(new Error("Video seek timed out."));
            }, 10000);

            const handler = () => {

                clearTimeout(timeout);

                video.removeEventListener("seeked", handler);

                resolve();
            };

            video.addEventListener("seeked", handler);

            video.currentTime = time;
        });
    }


    async function exportVideo(mode) {

        if (exporting) return;

        if (
            !window.MediaRecorder ||
            !HTMLCanvasElement.prototype.captureStream
        ) {
            alert(
                "This browser does not support canvas video export. Try recent Chrome or Edge."
            );
            return;
        }

        const start = mode === "trim"
            ? Number($("trimStart").value)
            : 0;

        const end = mode === "trim"
            ? Number($("trimEnd").value)
            : duration;

        if (end <= start) {
            alert("End time must be after start time.");
            return;
        }

        exporting = true;

        progress(
            "Preparing video export",
            "Rendering frames in your browser..."
        );

        const originalTime = video.currentTime;
        const wasPlaying = !video.paused;

        const d = dims();

        const output = document.createElement("canvas");

        output.width = d.w;
        output.height = d.h;

        const outputCtx = output.getContext("2d");

        const stream = output.captureStream(30);

        // Include original audio where browser support allows it.

        try {

            if (video.captureStream) {

                const videoStream = video.captureStream();

                videoStream.getAudioTracks().forEach(track => {
                    stream.addTrack(track);
                });
            }

        } catch (error) {
            console.warn("Audio capture unavailable:", error);
        }

        const mime = recorderMime();

        let recorder;

        try {

            recorder = new MediaRecorder(
                stream,
                mime ? { mimeType: mime } : undefined
            );

        } catch (error) {

            alert("Video recording is not supported by this browser.");

            stream.getTracks().forEach(track => track.stop());

            exporting = false;
            return;
        }

        const chunks = [];

        recorder.ondataavailable = e => {

            if (e.data.size) {
                chunks.push(e.data);
            }
        };

        const recordingFinished = new Promise((resolve, reject) => {

            recorder.onstop = resolve;

            recorder.onerror = e => {
                reject(e.error || e);
            };
        });


        recorder.start(250);

        try {

            video.pause();

            await seekTo(start);

            const renderFrame = () => {

                outputCtx.drawImage(
                    video,
                    d.x,
                    d.y,
                    d.w,
                    d.h,
                    0,
                    0,
                    output.width,
                    output.height
                );
            };

            renderFrame();

            const total = end - start;

            await new Promise((resolve, reject) => {

                const tick = () => {

                    if (video.currentTime >= end - 0.025) {

                        renderFrame();

                        resolve();
                        return;
                    }

                    renderFrame();

                    setProgress(
                        Math.min(
                            99,
                            (video.currentTime - start) / total * 100
                        ),
                        `Recording ${fmt(video.currentTime - start)} of ${fmt(total)}...`
                    );

                    if (video.paused) {
                        video.play().catch(reject);
                    }

                    requestAnimationFrame(tick);
                };

                video.play()
                    .then(() => requestAnimationFrame(tick))
                    .catch(reject);
            });


            video.pause();

            renderFrame();

            recorder.stop();

            await recordingFinished;

            finishBlob(
                new Blob(chunks, {
                    type: recorder.mimeType || "video/webm"
                }),
                mode === "trim"
                    ? "trimmed-video.webm"
                    : "cropped-video.webm"
            );

        } catch (error) {

            try {
                if (recorder.state !== "inactive") {
                    recorder.stop();
                }
            } catch (e) {}

            alert(`Export failed: ${error.message || error}`);

        } finally {

            stream.getTracks().forEach(track => track.stop());

            video.pause();

            try {
                await seekTo(Math.min(originalTime, duration));
            } catch (e) {}

            if (wasPlaying) {
                video.play();
            } else {
                video.pause();
            }

            exporting = false;
        }
    }


    $("exportTrim").addEventListener("click", () => {
        exportVideo("trim");
    });


    $("exportCrop").addEventListener("click", () => {
        exportVideo("crop");
    });


    // -------------------------
    // GIF EXPORT
    // -------------------------

    $("exportGif").addEventListener("click", async () => {

        if (exporting) return;

        if (!window.GIF) {

            alert(
                "GIF encoder library did not load. Check your internet connection and reload."
            );

            return;
        }

        const start = clamp(
            $("gifStart").value,
            0,
            duration
        );

        const end = clamp(
            $("gifEnd").value,
            0,
            duration
        );

        const fps = Number($("gifFps").value);
        const width = Number($("gifWidth").value);

        if (end <= start) {
            alert("GIF end time must be after start time.");
            return;
        }

        const count = Math.ceil((end - start) * fps);

        // Safety limit against enormous GIFs.

        if (count > 600) {

            alert(
                "This GIF would exceed 600 frames. Shorten the clip or lower the frame rate."
            );

            return;
        }

        exporting = true;

        progress(
            "Creating your GIF",
            "Capturing frames..."
        );

        const originalTime = video.currentTime;
        const wasPlaying = !video.paused;

        const c = $("gifCrop").checked
            ? dims()
            : {
                x: 0,
                y: 0,
                w: video.videoWidth,
                h: video.videoHeight
            };

        const output = document.createElement("canvas");

        const height = Math.round(width * c.h / c.w);

        output.width = width;
        output.height = height;

        const outputCtx = output.getContext("2d");

        const gif = new GIF({
            workers: 2,
            quality: 10,
            width,
            height,

            workerScript: "lib/gif.worker.js",

            repeat: 0
        });


        try {

            video.pause();

            for (let i = 0; i < count; i++) {

                const time = Math.min(
                    end - 0.001,
                    start + i / fps
                );

                await seekTo(time);

                outputCtx.drawImage(
                    video,
                    c.x,
                    c.y,
                    c.w,
                    c.h,
                    0,
                    0,
                    width,
                    height
                );

                gif.addFrame(output, {
                    copy: true,
                    delay: Math.round(1000 / fps)
                });

                setProgress(
                    (i + 1) / count * 65,
                    `Capturing frame ${i + 1} of ${count}...`
                );
            }


            const blob = await new Promise((resolve, reject) => {

                gif.on("progress", percent => {

                    setProgress(
                        65 + percent * 35,
                        "Encoding GIF..."
                    );
                });

                gif.on("finished", resolve);

                gif.on("abort", () => {
                    reject(new Error("GIF encoding aborted."));
                });

                gif.render();
            });


            finishBlob(blob, "animation.gif");

        } catch (error) {

            alert(`GIF export failed: ${error.message || error}`);

        } finally {

            try {
                await seekTo(Math.min(originalTime, duration));
            } catch (e) {}

            if (wasPlaying) {
                video.play();
            } else {
                video.pause();
            }

            exporting = false;
        }

    });

})();
