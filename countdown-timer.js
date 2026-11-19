/**
 * Countdown Timer - Customizable browser timer with presets, circular SVG progress & audio chime
 */
(() => {
    'use strict';

    // State
    let totalDurationMs = 25 * 60 * 1000; // default 25 min (Pomodoro)
    let remainingMs = totalDurationMs;
    let state = 'idle'; // 'idle' | 'running' | 'paused' | 'complete'
    let endTime = 0;
    let animFrameId = null;
    let alarmIntervalId = null;
    let titleIntervalId = null;
    let originalDocTitle = document.title;
    let soundEnabled = true;
    let soundTone = 'chime'; // 'chime' | 'beep' | 'bell'

    // DOM Elements
    const digitsElem = document.getElementById('countdownDigits');
    const percentElem = document.getElementById('countdownPercent');
    const circleFill = document.getElementById('countdownCircleFill');
    const statusPill = document.getElementById('statusPill');
    const statusText = document.getElementById('statusText');

    const btnStartPause = document.getElementById('btnStartPause');
    const btnReset = document.getElementById('btnReset');
    const btnFullscreen = document.getElementById('btnFullscreen');
    const btnExitFullscreen = document.getElementById('btnExitFullscreen');
    const fullscreenContainer = document.getElementById('timerFullscreenContainer');

    const alertBanner = document.getElementById('timerAlertBanner');
    const btnDismissAlert = document.getElementById('btnDismissAlert');

    const inputHours = document.getElementById('inputHours');
    const inputMinutes = document.getElementById('inputMinutes');
    const inputSeconds = document.getElementById('inputSeconds');
    const btnSetCustom = document.getElementById('btnSetCustom');

    const soundToggle = document.getElementById('soundToggle');
    const soundToneSelect = document.getElementById('soundToneSelect');
    const btnTestSound = document.getElementById('btnTestSound');
    const notifyToggle = document.getElementById('notifyToggle');

    const presetButtons = document.querySelectorAll('.timer-preset-btn');
    const quickAddButtons = document.querySelectorAll('.countdown-quick-btn');

    // SVG Circle Radius & Circumference (r = 110)
    const RADIUS = 110;
    const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
    circleFill.style.strokeDasharray = `${CIRCUMFERENCE}`;

    // Format milliseconds to HH:MM:SS or MM:SS
    function formatCountdown(ms) {
        if (ms < 0) ms = 0;
        const totalSec = Math.ceil(ms / 1000);
        const s = totalSec % 60;
        const totalMin = Math.floor(totalSec / 60);
        const m = totalMin % 60;
        const h = Math.floor(totalMin / 60);

        const pad = (n) => String(n).padStart(2, '0');
        if (h > 0) {
            return `${pad(h)}:${pad(m)}:${pad(s)}`;
        }
        return `${pad(m)}:${pad(s)}`;
    }

    // Web Audio API Synthesis for zero-dependency sound
    let audioCtx = null;
    function getAudioContext() {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                audioCtx = new AudioContextClass();
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    function playTone(type) {
        if (!soundEnabled) return;
        const ctx = getAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;

        if (type === 'chime') {
            // Pleasant multi-chord chime: C5, E5, G5, C6
            const freqs = [523.25, 659.25, 783.99, 1046.50];
            freqs.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + idx * 0.12);

                gain.gain.setValueAtTime(0, now + idx * 0.12);
                gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.12 + 0.03);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 1.2);

                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + idx * 0.12);
                osc.stop(now + idx * 0.12 + 1.3);
            });
        } else if (type === 'beep') {
            // Triple digital beep
            for (let i = 0; i < 3; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const start = now + i * 0.18;
                osc.type = 'square';
                osc.frequency.setValueAtTime(880, start); // A5

                gain.gain.setValueAtTime(0, start);
                gain.gain.linearRampToValueAtTime(0.15, start + 0.01);
                gain.gain.linearRampToValueAtTime(0, start + 0.10);

                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(start);
                osc.stop(start + 0.12);
            }
        } else if (type === 'bell') {
            // Deep resonant bell
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);

            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 2.1);
        }
    }

    // Update Progress Ring and Display
    function updateDisplay(ms) {
        digitsElem.textContent = formatCountdown(ms);

        const ratio = totalDurationMs > 0 ? Math.max(0, Math.min(1, ms / totalDurationMs)) : 0;
        const offset = CIRCUMFERENCE * (1 - ratio);
        circleFill.style.strokeDashoffset = `${offset}`;

        // Ring color based on percentage
        const pct = Math.round(ratio * 100);
        percentElem.textContent = `${pct}% remaining`;

        circleFill.classList.remove('amber', 'red');
        if (ratio <= 0.10) {
            circleFill.classList.add('red');
        } else if (ratio <= 0.25) {
            circleFill.classList.add('amber');
        }

        // Title sync when running
        if (state === 'running') {
            document.title = `(${formatCountdown(ms)}) Countdown — utilities`;
        }
    }

    // Main animation frame tick
    function tick() {
        if (state !== 'running') return;
        const now = performance.now();
        remainingMs = Math.max(0, endTime - now);

        updateDisplay(remainingMs);

        if (remainingMs <= 0) {
            triggerComplete();
            return;
        }

        animFrameId = requestAnimationFrame(tick);
    }

    // Set UI status
    function setStatus(newState) {
        state = newState;
        statusPill.className = 'time-status-pill ' + (
            newState === 'running' ? 'running' : (
                newState === 'paused' ? 'paused' : (
                    newState === 'complete' ? 'complete' : ''
                )
            )
        );

        statusText.textContent = newState === 'running' ? 'Running' : (
            newState === 'paused' ? 'Paused' : (
                newState === 'complete' ? 'Time\'s Up' : 'Ready'
            )
        );

        if (newState === 'running') {
            btnStartPause.className = 'timer-btn timer-btn-amber';
            btnStartPause.innerHTML = '<span>⏸</span> Pause';
            btnReset.disabled = false;
        } else if (newState === 'paused') {
            btnStartPause.className = 'timer-btn timer-btn-primary';
            btnStartPause.innerHTML = '<span>▶</span> Resume';
            btnReset.disabled = false;
        } else if (newState === 'complete') {
            btnStartPause.className = 'timer-btn timer-btn-primary';
            btnStartPause.innerHTML = '<span>↺</span> Restart';
            btnReset.disabled = false;
        } else {
            btnStartPause.className = 'timer-btn timer-btn-primary';
            btnStartPause.innerHTML = '<span>▶</span> Start';
            btnReset.disabled = remainingMs === totalDurationMs;
        }
    }

    // Start / Resume
    function start() {
        if (state === 'complete' || remainingMs <= 0) {
            remainingMs = totalDurationMs;
            dismissAlert();
        }

        dismissAlert();
        endTime = performance.now() + remainingMs;
        setStatus('running');
        animFrameId = requestAnimationFrame(tick);
    }

    // Pause
    function pause() {
        if (state !== 'running') return;
        cancelAnimationFrame(animFrameId);
        remainingMs = Math.max(0, endTime - performance.now());
        setStatus('paused');
        updateDisplay(remainingMs);
        document.title = `[Paused] Countdown — utilities`;
    }

    // Toggle Start / Pause
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
        dismissAlert();
        remainingMs = totalDurationMs;
        setStatus('idle');
        updateDisplay(remainingMs);
        document.title = originalDocTitle;
    }

    // Complete / Alarm triggered
    function triggerComplete() {
        cancelAnimationFrame(animFrameId);
        setStatus('complete');
        remainingMs = 0;
        updateDisplay(0);

        // Show banner
        alertBanner.hidden = false;

        // Play initial sound
        playTone(soundTone);

        // Repeat chime every 2.8 seconds
        if (alarmIntervalId) clearInterval(alarmIntervalId);
        alarmIntervalId = setInterval(() => {
            playTone(soundTone);
        }, 2800);

        // Title bar flash
        let flash = false;
        if (titleIntervalId) clearInterval(titleIntervalId);
        titleIntervalId = setInterval(() => {
            document.title = flash ? `⏰ TIME'S UP! — utilities` : `🔔 00:00 — utilities`;
            flash = !flash;
        }, 600);

        // Desktop notification if requested
        if (notifyToggle.checked && 'Notification' in window && Notification.permission === 'granted') {
            try {
                new Notification('Timer Finished!', {
                    body: `Your countdown has ended.`,
                    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⏳</text></svg>'
                });
            } catch (err) {}
        }
    }

    // Dismiss alert
    function dismissAlert() {
        alertBanner.hidden = true;
        if (alarmIntervalId) {
            clearInterval(alarmIntervalId);
            alarmIntervalId = null;
        }
        if (titleIntervalId) {
            clearInterval(titleIntervalId);
            titleIntervalId = null;
        }
        document.title = originalDocTitle;
    }

    // Set duration in milliseconds
    function setDuration(ms, presetBtnToActivate) {
        cancelAnimationFrame(animFrameId);
        dismissAlert();
        totalDurationMs = ms;
        remainingMs = ms;

        // Update inputs
        const totalSec = Math.floor(ms / 1000);
        const s = totalSec % 60;
        const totalMin = Math.floor(totalSec / 60);
        const m = totalMin % 60;
        const h = Math.floor(totalMin / 60);
        inputHours.value = h;
        inputMinutes.value = m;
        inputSeconds.value = s;

        // Preset active state
        presetButtons.forEach(b => b.classList.remove('active'));
        if (presetBtnToActivate) {
            presetBtnToActivate.classList.add('active');
        }

        setStatus('idle');
        updateDisplay(remainingMs);
    }

    // Quick Add (+1m, +5m, +10m)
    function addMinutes(min) {
        const addedMs = min * 60 * 1000;
        totalDurationMs += addedMs;
        remainingMs += addedMs;
        if (state === 'running') {
            endTime += addedMs;
        }
        updateDisplay(remainingMs);
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

    // Event Listeners
    btnStartPause.addEventListener('click', toggleStartPause);
    btnReset.addEventListener('click', reset);
    btnFullscreen.addEventListener('click', toggleFullscreen);
    btnExitFullscreen.addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', onFullscreenChange);

    btnDismissAlert.addEventListener('click', dismissAlert);

    // Preset buttons
    presetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const min = parseFloat(btn.dataset.min);
            if (!isNaN(min) && min > 0) {
                setDuration(min * 60 * 1000, btn);
            }
        });
    });

    // Quick add buttons
    quickAddButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const min = parseFloat(btn.dataset.add);
            if (!isNaN(min) && min > 0) {
                addMinutes(min);
            }
        });
    });

    // Custom duration form
    btnSetCustom.addEventListener('click', () => {
        const h = parseInt(inputHours.value, 10) || 0;
        const m = parseInt(inputMinutes.value, 10) || 0;
        const s = parseInt(inputSeconds.value, 10) || 0;

        const totalMs = ((h * 3600) + (m * 60) + s) * 1000;
        if (totalMs > 0) {
            setDuration(totalMs, null);
        } else {
            alert('Please specify a duration greater than 0.');
        }
    });

    // Sound settings
    soundToggle.addEventListener('change', () => {
        soundEnabled = soundToggle.checked;
    });

    soundToneSelect.addEventListener('change', () => {
        soundTone = soundToneSelect.value;
    });

    btnTestSound.addEventListener('click', () => {
        playTone(soundTone);
    });

    notifyToggle.addEventListener('change', () => {
        if (notifyToggle.checked && 'Notification' in window) {
            if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
                Notification.requestPermission().then(permission => {
                    if (permission !== 'granted') {
                        notifyToggle.checked = false;
                    }
                });
            } else if (Notification.permission === 'denied') {
                alert('Notification permission is blocked in your browser settings.');
                notifyToggle.checked = false;
            }
        }
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

        if (e.code === 'Space') {
            e.preventDefault();
            toggleStartPause();
        } else if (e.code === 'KeyR') {
            e.preventDefault();
            reset();
        } else if (e.code === 'KeyF') {
            e.preventDefault();
            toggleFullscreen();
        } else if (e.code === 'KeyM') {
            e.preventDefault();
            soundEnabled = !soundEnabled;
            soundToggle.checked = soundEnabled;
        } else if (e.code === 'Escape') {
            if (state === 'complete') {
                dismissAlert();
            }
        }
    });

    // Initial setup: Pomodoro 25m
    const initialPreset = document.querySelector('.timer-preset-btn[data-min="25"]');
    setDuration(25 * 60 * 1000, initialPreset);
})();
