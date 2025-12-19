#!/bin/bash
set -e

APP_NAME="pocketlab"
INSTALL_DIR="$HOME/.local/bin"
BASE_URL="https://miketoscano.com/pocketlab"

# Prompt user for action
echo "PocketLab Setup"
echo "==============="
echo ""
echo "Choose an action:"
echo "  (i) Install/Update"
echo "  (u) Uninstall"
echo ""
read -p "Enter choice [i/u]: " -n 1 -r
echo ""
echo ""

if [[ $REPLY =~ ^[Uu]$ ]]; then
    # Uninstall
    if [ ! -d "$INSTALL_DIR/$APP_NAME" ]; then
        echo "❌ $APP_NAME is not installed."
        exit 1
    fi
    
    echo "Uninstalling $APP_NAME..."
    rm -rf "$INSTALL_DIR/$APP_NAME"
    rm -f "$INSTALL_DIR/pocketlab"
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
if [ -f "$INSTALL_DIR/$APP_NAME/pocketlab" ]; then
    echo "Updating $APP_NAME..."
    IS_UPDATE=true
else
    echo "Installing $APP_NAME..."
    IS_UPDATE=false
fi

# Create install directory if it doesn't exist
mkdir -p "$INSTALL_DIR"

# Download and extract
TMP_DIR=$(mktemp -d)
cd "$TMP_DIR"
echo "Downloading $APP_NAME..."
curl -fsSL "$BASE_URL/releases/latest/pocketlab-linux.tar.gz" -o pocketlab.tar.gz
echo "Extracting..."
tar -xzf pocketlab.tar.gz

# Install
echo "Installing to $INSTALL_DIR/$APP_NAME..."
rm -rf "$INSTALL_DIR/$APP_NAME"
mkdir -p "$INSTALL_DIR/$APP_NAME"
cp -r bundle/* "$INSTALL_DIR/$APP_NAME/"
chmod +x "$INSTALL_DIR/$APP_NAME/pocketlab"

# Create symlink
ln -sf "$INSTALL_DIR/$APP_NAME/pocketlab" "$INSTALL_DIR/pocketlab"

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
    echo "Or run directly: $INSTALL_DIR/pocketlab"
else
    echo "Run with: pocketlab"
fi
