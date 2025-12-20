#!/bin/bash
set -e

APP_NAME="pocketlab"
APP_DIR="pocketlab-app"
INSTALL_DIR="$HOME/.local/bin"
BASE_URL="https://miketoscano.com/pocketlab"

# Progress bar function
show_progress() {
    local current=$1
    local total=$2
    local message=$3
    local width=50
    local percentage=$((current * 100 / total))
    local filled=$((width * current / total))
    local empty=$((width - filled))
    
    printf "\r%s [" "$message"
    printf "%${filled}s" | tr ' ' '='
    printf "%${empty}s" | tr ' ' ' '
    printf "] %d%%" "$percentage"
    
    if [ $current -eq $total ]; then
        echo ""
    fi
}

# Prompt user for action
echo "PocketLab Setup"
echo "==============="
echo ""
echo "Choose an action:"
echo "  (i) Install/Update"
echo "  (u) Uninstall"
echo ""
read -r -n 1 -p "Enter choice [i/u]: " REPLY </dev/tty
echo ""
echo ""

if [[ $REPLY =~ ^[Uu]$ ]]; then
    # Uninstall
    if [ ! -d "$INSTALL_DIR/$APP_DIR" ]; then
        echo "❌ $APP_NAME is not installed."
        exit 1
    fi
    
    echo "Uninstalling $APP_NAME..."
    echo ""
    
    show_progress 1 3 "Removing application files"
    sleep 0.3
    rm -rf "$INSTALL_DIR/$APP_DIR"
    show_progress 2 3 "Removing symlink        "
    sleep 0.3
    rm -f "$INSTALL_DIR/$APP_NAME"
    show_progress 3 3 "Cleanup complete        "
    
    echo ""
    echo "✓ $APP_NAME has been uninstalled successfully!"
    exit 0
fi

if [[ ! $REPLY =~ ^[Ii]$ ]]; then
    echo "Invalid choice. Exiting."
    exit 1
fi

# Install/Update
# Check if already installed
if [ -f "$INSTALL_DIR/$APP_DIR/$APP_NAME" ]; then
    echo "Updating $APP_NAME..."
    IS_UPDATE=true
else
    echo "Installing $APP_NAME..."
    IS_UPDATE=false
fi

# Create install directory if it doesn't exist
mkdir -p "$INSTALL_DIR"

echo ""

# Download and extract
TMP_DIR=$(mktemp -d)
cd "$TMP_DIR"

show_progress 1 6 "Downloading $APP_NAME      "
sleep 0.3
curl -fsSL "$BASE_URL/releases/latest/pocketlab-linux.tar.gz" -o pocketlab.tar.gz 2>/dev/null
show_progress 2 6 "Download complete          "

show_progress 3 6 "Extracting archive         "
sleep 0.3
tar -xzf pocketlab.tar.gz
show_progress 4 6 "Extraction complete        "

# Install
show_progress 5 6 "Installing files           "
rm -rf "$INSTALL_DIR/$APP_DIR"
mkdir -p "$INSTALL_DIR/$APP_DIR"
cp -r bundle/* "$INSTALL_DIR/$APP_DIR/"
chmod +x "$INSTALL_DIR/$APP_DIR/$APP_NAME"

# Create symlink
ln -sf "$INSTALL_DIR/$APP_DIR/$APP_NAME" "$INSTALL_DIR/$APP_NAME"
show_progress 6 6 "Installation complete      "

# Cleanup
cd - > /dev/null
rm -rf "$TMP_DIR"

echo ""
if [ "$IS_UPDATE" = true ]; then
    echo "✓ $APP_NAME updated successfully!"
else
    echo "✓ $APP_NAME installed successfully!"
fi
echo ""

# Check if directory is in PATH
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    echo "⚠️  Add $INSTALL_DIR to your PATH to run '$APP_NAME' from anywhere:"
    echo ""
    echo "    echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.bashrc"
    echo "    source ~/.bashrc"
    echo ""
    echo "Or run directly: $INSTALL_DIR/$APP_NAME"
else
    echo "Run with: $APP_NAME"
fi
