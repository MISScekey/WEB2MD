# Icon Placeholder Files

This directory contains placeholder icons for the Web2MD extension.

To create actual PNG icons, you can:

1. Use the icon.svg file as a template
2. Convert it to PNG at different sizes:
   - icon16.png (16x16)
   - icon48.png (48x48) 
   - icon128.png (128x128)

3. Use online tools like:
   - https://www.favicon-generator.org/
   - https://realfavicongenerator.net/
   - https://iconifier.net/

4. Or use command line tools like ImageMagick:
   ```bash
   convert icon.svg -resize 16x16 icon16.png
   convert icon.svg -resize 48x48 icon48.png
   convert icon.svg -resize 128x128 icon128.png
   ```

For now, create simple placeholder PNG files or the extension may not load properly.

