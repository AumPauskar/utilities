/**
 * Stopwatch - High precision local stopwatch with laps, split analysis & export
 */
(() => {
    'use strict';

    // State
    let state = 'idle'; // 'idle' | 'running' | 'paused'
    let startTime = 0;
    let elapsedBeforeResume = 0;
    let animFrameId = null;
    let laps = []; // { id, lapMs, totalMs }
    let lastLapTotalMs = 0;

    // DOM Elements
    const digitsMain = document.getElementById('digitsMain');
    const digitsFraction = document.getElementById('digitsFraction');
    const statusPill = document.getElementById('statusPill');
    const statusText = document.getElementById('statusText');
    const subReadout = document.getElementById('subReadout');

    const btnStartPause = document.getElementById('btnStartPause');
    const btnLap = document.getElementById('btnLap');
    const btnReset = document.getElementById('btnReset');
    const btnFullscreen = document.getElementById('btnFullscreen');
    const btnExitFullscreen = document.getElementById('btnExitFullscreen');
    const fullscreenContainer = document.getElementById('stopwatchFullscreenContainer');

    const lapTableBody = document.getElementById('lapTableBody');
    const lapEmptyState = document.getElementById('lapEmptyState');
    const lapCountBadge = document.getElementById('lapCountBadge');
    const statFastest = document.getElementById('statFastest');
    const statSlowest = document.getElementById('statSlowest');
    const statAverage = document.getElementById('statAverage');
    const btnCopyLaps = document.getElementById('btnCopyLaps');
    const btnExportCsv = document.getElementById('btnExportCsv');
    const btnClearLaps = document.getElementById('btnClearLaps');

    // Format millisecond duration into { h, m, s, cs, full }
    function formatTime(totalMs) {
        if (totalMs < 0) totalMs = 0;
        const totalHundredths = Math.floor(totalMs / 10);
        const cs = totalHundredths % 100;
        const totalSec = Math.floor(totalHundredths / 100);
        const s = totalSec % 60;
        const totalMin = Math.floor(totalSec / 60);
        const m = totalMin % 60;
        const h = Math.floor(totalMin / 60);

        const pad = (n, len = 2) => String(n).padStart(len, '0');
        const hStr = pad(h);
        const mStr = pad(m);
        const sStr = pad(s);
        const csStr = pad(cs);

        return {
            h, m, s, cs,
            main: `${hStr}:${mStr}:${sStr}`,
            fraction: `.${csStr}`,
            full: `${hStr}:${mStr}:${sStr}.${csStr}`
        };
    }

    // Get current elapsed milliseconds
    function getElapsedMs() {
        if (state === 'running') {
            return elapsedBeforeResume + (performance.now() - startTime);
        }
        return elapsedBeforeResume;
    }

    // Update the main digital display
    function updateDisplay(nowElapsed) {
        const t = formatTime(nowElapsed);
        digitsMain.textContent = t.main;
        digitsFraction.textContent = t.fraction;

        if (state === 'running' && laps.length > 0) {
            const currentLapMs = nowElapsed - lastLapTotalMs;
            const lapTime = formatTime(currentLapMs);
            subReadout.textContent = `Lap ${laps.length + 1}: ${lapTime.full}`;
        } else if (state === 'idle') {
            subReadout.textContent = 'Ready to start';
        } else if (state === 'paused') {
            subReadout.textContent = 'Paused';
        }
    }

    // Animation frame loop
    function tick() {
        if (state !== 'running') return;
        const current = getElapsedMs();
        updateDisplay(current);
        animFrameId = requestAnimationFrame(tick);
    }

    // Set UI State
    function setStatus(newState) {
        state = newState;
        statusPill.className = 'time-status-pill ' + (newState === 'running' ? 'running' : (newState === 'paused' ? 'paused' : ''));
        statusText.textContent = newState === 'running' ? 'Running' : (newState === 'paused' ? 'Paused' : 'Ready');

        if (newState === 'running') {
            btnStartPause.className = 'timer-btn timer-btn-amber';
            btnStartPause.innerHTML = '<span>⏸</span> Pause';
            btnLap.disabled = false;
            btnReset.disabled = false;
        } else if (newState === 'paused') {
            btnStartPause.className = 'timer-btn timer-btn-primary';
            btnStartPause.innerHTML = '<span>▶</span> Resume';
            btnLap.disabled = true;
            btnReset.disabled = false;
        } else {
            btnStartPause.className = 'timer-btn timer-btn-primary';
            btnStartPause.innerHTML = '<span>▶</span> Start';
            btnLap.disabled = true;
            btnReset.disabled = true;
        }
    }

    // Start / Resume
    function start() {
        if (state === 'running') return;
        startTime = performance.now();
        setStatus('running');
        animFrameId = requestAnimationFrame(tick);
    }

    // Pause
    function pause() {
        if (state !== 'running') return;
        elapsedBeforeResume += performance.now() - startTime;
        cancelAnimationFrame(animFrameId);
        setStatus('paused');
        updateDisplay(elapsedBeforeResume);
    }

    // Toggle Start/Pause
    function toggleStartPause() {
        if (state === 'running') {
            pause();
        } else {
            start();
        }
    }

    // Reset
    function reset() {
        cancelAnimationFrame(animFrameId);
        state = 'idle';
        startTime = 0;
        elapsedBeforeResume = 0;
        lastLapTotalMs = 0;
        setStatus('idle');
        updateDisplay(0);
        clearLaps();
    }

    // Record Lap
    function recordLap() {
        if (state !== 'running') return;
        const currentElapsed = getElapsedMs();
        const lapDuration = currentElapsed - lastLapTotalMs;
        lastLapTotalMs = currentElapsed;

        const lapIndex = laps.length + 1;
        laps.unshift({
            index: lapIndex,
            lapMs: lapDuration,
            totalMs: currentElapsed
        });

        renderLaps();
    }

    // Render Laps table & stats
    function renderLaps() {
        lapCountBadge.textContent = `${laps.length} lap${laps.length === 1 ? '' : 's'}`;

        if (laps.length === 0) {
            lapEmptyState.hidden = false;
            lapTableBody.innerHTML = '';
            statFastest.textContent = '--:--.--';
            statSlowest.textContent = '--:--.--';
            statAverage.textContent = '--:--.--';
            btnCopyLaps.disabled = true;
            btnExportCsv.disabled = true;
            btnClearLaps.disabled = true;
            return;
        }

        lapEmptyState.hidden = true;
        btnCopyLaps.disabled = false;
        btnExportCsv.disabled = false;
        btnClearLaps.disabled = false;

        // Calculate min, max, avg
        let minLap = laps[0].lapMs;
        let maxLap = laps[0].lapMs;
        let sumLap = 0;

        for (const l of laps) {
            if (l.lapMs < minLap) minLap = l.lapMs;
            if (l.lapMs > maxLap) maxLap = l.lapMs;
            sumLap += l.lapMs;
        }

        const avgLap = sumLap / laps.length;

        statFastest.textContent = formatTime(minLap).full;
        statSlowest.textContent = formatTime(maxLap).full;
        statAverage.textContent = formatTime(avgLap).full;

        // Render rows
        const hasMinMax = laps.length >= 2 && minLap !== maxLap;

        lapTableBody.innerHTML = laps.map(l => {
            let badge = '';
            if (hasMinMax && l.lapMs === minLap) {
                badge = '<span class="lap-badge lap-badge-fastest">Fastest</span>';
            } else if (hasMinMax && l.lapMs === maxLap) {
                badge = '<span class="lap-badge lap-badge-slowest">Slowest</span>';
            }

            return `<tr>
                <td>#${l.index}</td>
                <td>${formatTime(l.lapMs).full} ${badge}</td>
                <td>${formatTime(l.totalMs).full}</td>
            </tr>`;
        }).join('');
    }

    // Clear laps
    function clearLaps() {
        laps = [];
        lastLapTotalMs = state === 'running' ? getElapsedMs() : 0;
        renderLaps();
    }

    // Copy laps to clipboard
    function copyLaps() {
        if (laps.length === 0) return;
        const text = laps.slice().reverse().map(l =>
            `Lap ${l.index}: Split ${formatTime(l.lapMs).full} | Total ${formatTime(l.totalMs).full}`
        ).join('\n');

        navigator.clipboard.writeText(text).then(() => {
            const originalText = btnCopyLaps.textContent;
            btnCopyLaps.textContent = '✓ Copied!';
            setTimeout(() => { btnCopyLaps.textContent = originalText; }, 1800);
        }).catch(() => {
            alert('Failed to copy to clipboard.');
        });
    }

    // Export CSV
    function exportCsv() {
        if (laps.length === 0) return;
        const rows = [
            ['Lap', 'Split Time', 'Total Time', 'Split Ms', 'Total Ms'],
            ...laps.slice().reverse().map(l => [
                l.index,
                formatTime(l.lapMs).full,
                formatTime(l.totalMs).full,
                Math.round(l.lapMs),
                Math.round(l.totalMs)
            ])
        ];

        const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `stopwatch-laps-${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Fullscreen toggle
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            fullscreenContainer.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    }

    function onFullscreenChange() {
        if (document.fullscreenElement) {
            btnFullscreen.textContent = 'Exit Fullscreen ✕';
        } else {
            btnFullscreen.textContent = 'Fullscreen ⛶';
        }
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        // Avoid interfering when typing in inputs/textareas
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

        if (e.code === 'Space') {
            e.preventDefault();
            toggleStartPause();
        } else if (e.code === 'KeyL') {
            if (state === 'running') {
                e.preventDefault();
                recordLap();
            }
        } else if (e.code === 'KeyR') {
            e.preventDefault();
            reset();
        } else if (e.code === 'KeyF') {
            e.preventDefault();
            toggleFullscreen();
        }
    });

    // Event Listeners
    btnStartPause.addEventListener('click', toggleStartPause);
    btnLap.addEventListener('click', recordLap);
    btnReset.addEventListener('click', reset);
    btnFullscreen.addEventListener('click', toggleFullscreen);
    btnExitFullscreen.addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', onFullscreenChange);

    btnCopyLaps.addEventListener('click', copyLaps);
    btnExportCsv.addEventListener('click', exportCsv);
    btnClearLaps.addEventListener('click', clearLaps);

    // Initial setup
    setStatus('idle');
    updateDisplay(0);
    renderLaps();
})();
