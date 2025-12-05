#!/bin/bash

# Setup Autostart for SpotiUI Kiosk
# Usage: ./setup-autostart.sh [API_URL]

API_URL=${1:-http://localhost:3001}
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
AUTOSTART_DIR="$HOME/.config/autostart"
DESKTOP_FILE="$AUTOSTART_DIR/spotiui.desktop"

echo "🔧 Setting up Autostart for SpotiUI..."
echo "📂 Installation Dir: $DIR"
echo "🔗 API URL: $API_URL"

# Create autostart directory if not exists
if [ ! -d "$AUTOSTART_DIR" ]; then
    echo "Creating $AUTOSTART_DIR..."
    mkdir -p "$AUTOSTART_DIR"
fi

# Create the .desktop file
cat <<EOF > "$DESKTOP_FILE"
[Desktop Entry]
Type=Application
Name=SpotiUI Kiosk
Comment=Start SpotiUI Kiosk Mode
Exec=$DIR/run-native-kiosk.sh $API_URL
X-GNOME-Autostart-enabled=true
Terminal=false
EOF

# Make sure the kiosk script is executable
chmod +x "$DIR/run-native-kiosk.sh"

echo "✅ Autostart entry created at: $DESKTOP_FILE"
echo "🎉 Reboot your Raspberry Pi to test it!"
