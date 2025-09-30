#!/bin/bash

# PatchMon Agent Installation Script
# Usage: curl -ks {PATCHMON_URL}/api/v1/hosts/install -H "X-API-ID: {API_ID}" -H "X-API-KEY: {API_KEY}" | bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
error() {
    echo -e "${RED}❌ ERROR: $1${NC}" >&2
    exit 1
}

info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   error "This script must be run as root (use sudo)"
fi

# Clean up old files (keep only last 3 of each type)
cleanup_old_files() {
    # Clean up old credential backups
    ls -t /etc/patchmon/credentials.backup.* 2>/dev/null | tail -n +4 | xargs -r rm -f
    
    # Clean up old agent backups
    ls -t /usr/local/bin/patchmon-agent.sh.backup.* 2>/dev/null | tail -n +4 | xargs -r rm -f
    
    # Clean up old log files
    ls -t /var/log/patchmon-agent.log.old.* 2>/dev/null | tail -n +4 | xargs -r rm -f
}

# Run cleanup at start
cleanup_old_files

# Parse arguments from environment (passed via HTTP headers)
if [[ -z "$PATCHMON_URL" ]] || [[ -z "$API_ID" ]] || [[ -z "$API_KEY" ]]; then
    error "Missing required parameters. This script should be called via the PatchMon web interface."
fi

info "🚀 Starting PatchMon Agent Installation..."
info "📋 Server: $PATCHMON_URL"
info "🔑 API ID: ${API_ID:0:16}..."

# Install required dependencies
info "📦 Installing required dependencies..."

# Detect package manager and install jq and curl
if command -v apt-get >/dev/null 2>&1; then
    # Debian/Ubuntu
    apt-get update >/dev/null 2>&1
    apt-get install -y jq curl >/dev/null 2>&1
elif command -v yum >/dev/null 2>&1; then
    # CentOS/RHEL 7
    yum install -y jq curl >/dev/null 2>&1
elif command -v dnf >/dev/null 2>&1; then
    # CentOS/RHEL 8+/Fedora
    dnf install -y jq curl >/dev/null 2>&1
elif command -v zypper >/dev/null 2>&1; then
    # openSUSE
    zypper install -y jq curl >/dev/null 2>&1
elif command -v pacman >/dev/null 2>&1; then
    # Arch Linux
    pacman -S --noconfirm jq curl >/dev/null 2>&1
elif command -v apk >/dev/null 2>&1; then
    # Alpine Linux
    apk add --no-cache jq curl >/dev/null 2>&1
else
    warning "Could not detect package manager. Please ensure 'jq' and 'curl' are installed manually."
fi

# Step 1: Handle existing configuration directory
info "📁 Setting up configuration directory..."

# Check if configuration directory already exists
if [[ -d "/etc/patchmon" ]]; then
    warning "⚠️  Configuration directory already exists at /etc/patchmon"
    warning "⚠️  Preserving existing configuration files"
    
    # List existing files for user awareness
    info "📋 Existing files in /etc/patchmon:"
    ls -la /etc/patchmon/ 2>/dev/null | grep -v "^total" | while read -r line; do
        echo "   $line"
    done
else
    info "📁 Creating new configuration directory..."
    mkdir -p /etc/patchmon
fi

# Step 2: Create credentials file
info "🔐 Creating API credentials file..."

# Check if credentials file already exists
if [[ -f "/etc/patchmon/credentials" ]]; then
    warning "⚠️  Credentials file already exists at /etc/patchmon/credentials"
    warning "⚠️  Moving existing file out of the way for fresh installation"
    
    # Clean up old credential backups (keep only last 3)
    ls -t /etc/patchmon/credentials.backup.* 2>/dev/null | tail -n +4 | xargs -r rm -f
    
    # Move existing file out of the way
    mv /etc/patchmon/credentials /etc/patchmon/credentials.backup.$(date +%Y%m%d_%H%M%S)
    info "📋 Moved existing credentials to: /etc/patchmon/credentials.backup.$(date +%Y%m%d_%H%M%S)"
fi

cat > /etc/patchmon/credentials << EOF
# PatchMon API Credentials
# Generated on $(date)
PATCHMON_URL="$PATCHMON_URL"
API_ID="$API_ID"
API_KEY="$API_KEY"
EOF
chmod 600 /etc/patchmon/credentials

# Step 3: Download the agent script using API credentials
info "📥 Downloading PatchMon agent script..."

# Check if agent script already exists
if [[ -f "/usr/local/bin/patchmon-agent.sh" ]]; then
    warning "⚠️  Agent script already exists at /usr/local/bin/patchmon-agent.sh"
    warning "⚠️  Moving existing file out of the way for fresh installation"
    
    # Clean up old agent backups (keep only last 3)
    ls -t /usr/local/bin/patchmon-agent.sh.backup.* 2>/dev/null | tail -n +4 | xargs -r rm -f
    
    # Move existing file out of the way
    mv /usr/local/bin/patchmon-agent.sh /usr/local/bin/patchmon-agent.sh.backup.$(date +%Y%m%d_%H%M%S)
    info "📋 Moved existing agent to: /usr/local/bin/patchmon-agent.sh.backup.$(date +%Y%m%d_%H%M%S)"
fi

curl -ks \
    -H "X-API-ID: $API_ID" \
    -H "X-API-KEY: $API_KEY" \
    "$PATCHMON_URL/api/v1/hosts/agent/download" \
    -o /usr/local/bin/patchmon-agent.sh

chmod +x /usr/local/bin/patchmon-agent.sh

# Get the agent version from the downloaded script
AGENT_VERSION=$(grep '^AGENT_VERSION=' /usr/local/bin/patchmon-agent.sh | cut -d'"' -f2 2>/dev/null || echo "Unknown")
info "📋 Agent version: $AGENT_VERSION"

# Handle existing log files
if [[ -f "/var/log/patchmon-agent.log" ]]; then
    warning "⚠️  Existing log file found at /var/log/patchmon-agent.log"
    warning "⚠️  Rotating log file for fresh start"
    
    # Rotate the log file
    mv /var/log/patchmon-agent.log /var/log/patchmon-agent.log.old.$(date +%Y%m%d_%H%M%S)
    info "📋 Log file rotated to: /var/log/patchmon-agent.log.old.$(date +%Y%m%d_%H%M%S)"
fi

# Step 4: Test the configuration
info "🧪 Testing API credentials and connectivity..."
if /usr/local/bin/patchmon-agent.sh test; then
    success "✅ API credentials are valid and server is reachable"
else
    error "❌ Failed to validate API credentials or reach server"
fi

# Step 5: Send initial data
info "📊 Sending initial package data to server..."
if /usr/local/bin/patchmon-agent.sh update; then
    success "✅ Initial package data sent successfully"
else
    warning "⚠️  Failed to send initial data. You can retry later with: /usr/local/bin/patchmon-agent.sh update"
fi

# Step 6: Get update interval policy from server and setup crontab
info "⏰ Getting update interval policy from server..."
UPDATE_INTERVAL=$(curl -ks \
    -H "X-API-ID: $API_ID" \
    -H "X-API-KEY: $API_KEY" \
    "$PATCHMON_URL/api/v1/settings/update-interval" | \
    grep -o '"updateInterval":[0-9]*' | cut -d':' -f2 2>/dev/null || echo "60")

info "📋 Update interval: $UPDATE_INTERVAL minutes"

# Setup crontab (smart duplicate detection)
info "📅 Setting up automated updates..."

# Check if PatchMon cron entries already exist
if crontab -l 2>/dev/null | grep -q "/usr/local/bin/patchmon-agent.sh update"; then
    warning "⚠️  Existing PatchMon cron entries found"
    warning "⚠️  These will be replaced with new schedule"
fi

# Function to setup crontab without duplicates
setup_crontab() {
    local update_interval="$1"
    local patchmon_pattern="/usr/local/bin/patchmon-agent.sh update"
    
    # Get current crontab, remove any existing patchmon entries
    local current_cron=$(crontab -l 2>/dev/null | grep -v "$patchmon_pattern" || true)
    
    # Determine new cron entry
    local new_entry
    if [[ "$update_interval" -eq 60 ]]; then
        # Hourly updates - use a random minute to spread load
        local current_minute=$(date +%M)
        new_entry="$current_minute * * * * $patchmon_pattern >/dev/null 2>&1"
        info "📋 Configuring hourly updates at minute $current_minute"
    else
        # Custom interval updates
        new_entry="*/$update_interval * * * * $patchmon_pattern >/dev/null 2>&1"
        info "📋 Configuring updates every $update_interval minutes"
    fi
    
    # Combine existing cron (without patchmon entries) + new entry
    {
        if [[ -n "$current_cron" ]]; then
            echo "$current_cron"
        fi
        echo "$new_entry"
    } | crontab -
    
    success "✅ Crontab configured successfully (duplicates removed)"
}

setup_crontab "$UPDATE_INTERVAL"

# Installation complete
success "🎉 PatchMon Agent installation completed successfully!"
echo ""
echo -e "${GREEN}📋 Installation Summary:${NC}"
echo "   • Configuration directory: /etc/patchmon"
echo "   • Agent installed: /usr/local/bin/patchmon-agent.sh"
echo "   • Dependencies installed: jq, curl"
echo "   • Crontab configured for automatic updates"
echo "   • API credentials configured and tested"

# Check for moved files and show them
MOVED_FILES=$(ls /etc/patchmon/credentials.backup.* /usr/local/bin/patchmon-agent.sh.backup.* /var/log/patchmon-agent.log.old.* 2>/dev/null || true)
if [[ -n "$MOVED_FILES" ]]; then
    echo ""
    echo -e "${YELLOW}📋 Files Moved for Fresh Installation:${NC}"
    echo "$MOVED_FILES" | while read -r moved_file; do
        echo "   • $moved_file"
    done
    echo ""
    echo -e "${BLUE}💡 Note: Old files are automatically cleaned up (keeping last 3)${NC}"
fi

echo ""
echo -e "${BLUE}🔧 Management Commands:${NC}"
echo "   • Test connection: /usr/local/bin/patchmon-agent.sh test"
echo "   • Manual update: /usr/local/bin/patchmon-agent.sh update"
echo "   • Check status: /usr/local/bin/patchmon-agent.sh diagnostics"
echo ""
success "✅ Your system is now being monitored by PatchMon!"
