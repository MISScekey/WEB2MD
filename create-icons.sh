#!/bin/bash

# Icon Generator Script for Web2MD Extension
# This script creates simple placeholder icons for development

echo "Creating placeholder icons for Web2MD extension..."

# Create icons directory if it doesn't exist
mkdir -p icons

# Generate simple colored rectangles as placeholder icons
# These will need to be replaced with proper icons for production

# Create 16x16 icon
echo "Creating 16x16 icon..."
convert -size 16x16 xc:'#007bff' -pointsize 8 -font Arial-Bold -gravity center -fill white -annotate +0+0 'MD' icons/icon16.png 2>/dev/null || echo "ImageMagick not available - create icons/icon16.png manually"

# Create 48x48 icon  
echo "Creating 48x48 icon..."
convert -size 48x48 xc:'#007bff' -pointsize 18 -font Arial-Bold -gravity center -fill white -annotate +0-8 'WEB' -annotate +0+8 'MD' icons/icon48.png 2>/dev/null || echo "ImageMagick not available - create icons/icon48.png manually"

# Create 128x128 icon
echo "Creating 128x128 icon..."
convert -size 128x128 xc:'#007bff' -pointsize 24 -font Arial-Bold -gravity center -fill white -annotate +0-20 'WEB' -annotate +0+0 '2' -annotate +0+20 'MD' icons/icon128.png 2>/dev/null || echo "ImageMagick not available - create icons/icon128.png manually"

echo "Icon creation complete!"
echo ""
echo "If ImageMagick is not available, please create the following files manually:"
echo "- icons/icon16.png (16x16 pixels)"
echo "- icons/icon48.png (48x48 pixels)"
echo "- icons/icon128.png (128x128 pixels)"
echo ""
echo "You can use online tools like:"
echo "- https://www.favicon-generator.org/"
echo "- https://iconifier.net/"
echo "- https://realfavicongenerator.net/"