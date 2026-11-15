
# utilities

A local-first collection of browser utilities. The first tool is Video to GIF,
with video preview, trimming, cropping, and GIF export. It also includes
Markdown to PDF and LaTeX to PDF document tools.

The four pages are separate HTML files: `index.html` for the overview,
`video-to-gif.html`, `markdown-to-pdf.html`, and `latex-to-pdf.html`. The
overview carousel and shared sidebar are driven by the `utilitiesCatalog`
registry in `app.js`.

## Features

- Load local video files.
- Preview and scrub videos.
- Trim video segments.
- Crop video dimensions.
- Aspect ratio presets: 1:1, 4:5, 16:9 and 9:16.
- Convert video segments into GIF.
- Configure GIF FPS and resolution.
- Download processed files.
- Live Markdown preview with browser PDF export.
- LaTeX.js-powered document parsing with math, sections, lists, links, symbols,
  and multi-column preview plus browser PDF export.

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
18 from its browser CDN while the editor continues to use native browser APIs.

## Privacy

Video files are processed locally in the browser.
No video upload endpoint exists.

The LaTeX utility compiles through LaTeX.js in the browser. It supports a broad
LaTeX subset, but packages or engine-specific features that LaTeX.js does not
implement will need a full TeX engine such as pdfLaTeX, XeLaTeX, or LuaLaTeX.
