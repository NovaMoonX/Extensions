#!/bin/bash

# Script to create a new Chrome extension tutorial folder

if [ -z "$1" ]; then
  echo "Usage: $0 <extension-name>"
  echo "Example: $0 'Hello World'"
  exit 1
fi

# Convert name to kebab-case
folder_name=$(echo "$1" | tr '[:upper:]' '[:lower:]' | sed 's/ /-/g')

# Create folder
mkdir -p "$folder_name"
cd "$folder_name"

# Initialize npm and install chrome-types
npm init -y > /dev/null
npm install chrome-types

# Create manifest.json
cat > manifest.json << EOF
{
  "name": "$1",
  "version": "1.0",
  "manifest_version": 3,
  "action": {
    "default_popup": "index.html"
  }
}
EOF

# Create popup.js
cat > popup.js << 'EOF'
document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup loaded');
});
EOF

# Create index.html
cat > index.html << EOF
<!DOCTYPE html>
<html>
  <body>
    <h1>$1</h1>
    <script src="popup.js"></script>
  </body>
</html>
EOF

echo "✓ Extension folder created: $folder_name"