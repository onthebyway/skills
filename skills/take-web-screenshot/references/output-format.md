# Output Format

The capture script writes one full-page JPEG screenshot by default and a `metadata.json` file. PNG output is available with `--format png`.

Example:

```text
screenshots/example/
├── example.com-1600-full.jpg
└── metadata.json
```

Example metadata:

```json
{
  "url": "https://example.com",
  "capturedAt": "2026-06-09T15:22:50.871Z",
  "capture": "full-page",
  "waitUntil": "networkidle",
  "waitMs": 500,
  "browser": "local-chromium",
  "format": "jpeg",
  "quality": 90,
  "screenshots": [
    {
      "file": "example.com-1600-full.jpg",
      "viewport": { "width": 1600, "height": 900 },
      "deviceScaleFactor": 1,
      "capture": "full-page",
      "format": "jpeg"
    }
  ]
}
```

Default width: `1600`.

Common screen-size widths:

- large desktop: `1920`
- desktop/laptop: `1440`
- iPad landscape: `1024`
- iPad portrait: `768`
- iPhone 15/16 portrait: `393`
- iPhone SE portrait: `375`

For downstream skills, pass both the image path and the metadata path.
