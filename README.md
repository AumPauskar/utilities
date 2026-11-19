# utilities

A local-first collection of browser utilities. Tools include Video to GIF,
Markdown to PDF, LaTeX to PDF, PDF Compress, Image Compress, Stopwatch,
and Countdown Timer.

Each tool runs in a separate HTML file (`video-to-gif.html`, `markdown-to-pdf.html`,
`latex-to-pdf.html`, `pdf-compress.html`, `img-compress.html`, `stopwatch.html`,
and `countdown-timer.html`), unified by `index.html` for the overview.
The shared sidebar and landing carousel are driven by the `utilitiesCatalog`
registry in `app.js`.

## Features

- Load local video files, scrub, trim, crop, and convert to GIF.
- Live Markdown preview with browser PDF export.
- LaTeX.js-powered document parsing with equations, sections, and PDF export.
- PDF compression with in-browser image downsampling.
- Bulk image compression and format conversion (JPEG, PNG, WebP).
- High-precision Stopwatch with split lap times, statistics (fastest, slowest, average), keyboard shortcuts, and CSV/clipboard export.
- Countdown Timer with productivity presets (Pomodoro, Short/Long Break, Deep Work), custom duration pickers, circular progress ring, audio chime/bell alerts via Web Audio API, and fullscreen mode.
- **Kindle & Low-Power Fallback** (`kindle.html`, `stopwatch-kindle.html`, `countdown-timer-kindle.html`): High-contrast black-and-white mode with zero external dependencies, ES3/ES5 JavaScript, and 1-second refresh rates optimized specifically for Amazon Kindle experimental browsers and e-ink displays.

## Kindle & Low-Power Edition

Older Amazon Kindles (Paperwhite, Voyage, Touch, Keyboard) struggle with modern web frameworks, complex CSS Grid layouts, and continuous 60fps animations that flash e-ink screens.

This project includes a dedicated, lightweight fallback:
- **Zero CDNs or external assets**: Completely standalone single-file pages.
- **Pure ES3/ES5 JavaScript**: No modern arrow functions, classes, or syntax that crash legacy WebKit/NetFront browsers.
- **1-Second Screen Refresh**: Eliminates rapid screen repaints, saving battery and preventing e-ink screen flickering.
- **High-Contrast E-Ink Typography**: Solid black and white styling with clear borders and large tap targets.
- **Automatic Detection**: Browsers with `Kindle` in their user agent are automatically routed to the lightweight edition, with manual switcher buttons available on both versions.

## Running locally

Open the project using VS Code.

You can use the Live Server extension, or run:

```bash
python -m http.server 8000
```

Visit:

http://localhost:8000

## Deployment

This project is compatible with GitHub Pages.

No backend or build process is required. The shared navigation shell uses React
18 from its browser CDN while each tool runs locally in the client using browser APIs.

## Privacy

All processing happens locally on your device in the browser.
No files or data are ever uploaded.
