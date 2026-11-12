
# vid2gif

A frontend-only video editing tool built with native browser APIs. I didn't build this shit, it's vibecoded

## Features

- Load local video files.
- Preview and scrub videos.
- Trim video segments.
- Crop video dimensions.
- Aspect ratio presets: 1:1, 4:5, 16:9 and 9:16.
- Convert video segments into GIF.
- Configure GIF FPS and resolution.
- Download processed files.

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

No backend or build process is required.

## Privacy

Video files are processed locally in the browser.
No video upload endpoint exists.
