# Counsel Extension Icons

## Icon Design

The Counsel icon represents an AI legal assistant. The icon features:

- A **rounded rectangle** (6px corner radius) in Counsel blue (#1a73e8)
- Three horizontal **white lines** representing a document/text — the core of legal drafting
- The lines are arranged as: full width, full width, partial width — suggesting ongoing work

## Generating PNG Icons

Since actual PNG files are generated from SVG, use one of these methods:

### Option 1: Online Converters
1. Open `icon.svg` in a browser
2. Use an online SVG-to-PNG converter (e.g., svgtopng.com)
3. Export at 16×16, 48×48, and 128×128

### Option 2: Command Line (Inkscape)
```bash
inkscape icon.svg -w 16 -h 16 -o icon16.png
inkscape icon.svg -w 48 -h 48 -o icon48.png
inkscape icon.svg -w 128 -h 128 -o icon128.png
```

### Option 3: Node.js (sharp)
```bash
npx sharp-cli -i icon.svg -o icon16.png resize 16 16
npx sharp-cli -i icon.svg -o icon48.png resize 48 48
npx sharp-cli -i icon.svg -o icon128.png resize 128 128
```

### Option 4: Browser Console
Open `icon.html` in Chrome, press F12, and run this in the console:
```javascript
[16, 48, 128].forEach(size => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, size, size);
    canvas.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `icon${size}.png`;
      a.click();
    });
  };
  img.src = document.querySelector('svg').outerHTML;
});
```

## Colors

- Primary: `#1a73e8` (Google Blue)
- White: `#ffffff`
