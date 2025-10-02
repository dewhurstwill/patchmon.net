#!/bin/bash

# PatchMon Agent Installation Script
# Usage: curl -s {PATCHMON_URL}/api/v1/hosts/install -H "X-API-ID: {API_ID}" -H "X-API-KEY: {API_KEY}" | bash

set -e

# This placeholder will be dynamically replaced by the server when serving this
# script based on the "ignore SSL self-signed" setting. If set to -k, curl will
# ignore certificate validation. Otherwise, it will be empty for secure default.
# CURL_FLAGS is now set via environment variables by the backend

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

# Verify system datetime and timezone
verify_datetime() {
    info "🕐 Verifying system datetime and timezone..."
    
    # Get current system time
    local system_time=$(date)
    local timezone=$(timedatectl show --property=Timezone --value 2>/dev/null || echo "Unknown")
    
    # Display current datetime info
    echo ""
    echo -e "${BLUE}📅 Current System Date/Time:${NC}"
    echo "   • Date/Time: $system_time"
    echo "   • Timezone: $timezone"
    echo ""
    
    # Check if we can read from stdin (interactive terminal)
    if [[ -t 0 ]]; then
        # Interactive terminal - ask user
        read -p "Does this date/time look correct to you? (y/N): " -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            success "✅ Date/time verification passed"
            echo ""
            return 0
        else
            echo ""
            echo -e "${RED}❌ Date/time verification failed${NC}"
            echo ""
            echo -e "${YELLOW}💡 Please fix the date/time and re-run the installation script:${NC}"
            echo "   sudo timedatectl set-time 'YYYY-MM-DD HH:MM:SS'"
            echo "   sudo timedatectl set-timezone 'America/New_York'  # or your timezone"
            echo "   sudo timedatectl list-timezones  # to see available timezones"
            echo ""
            echo -e "${BLUE}ℹ️  After fixing the date/time, re-run this installation script.${NC}"
            error "Installation cancelled - please fix date/time and re-run"
        fi
    else
        # Non-interactive (piped from curl) - show warning and continue
        echo -e "${YELLOW}⚠️  Non-interactive installation detected${NC}"
        echo ""
        echo "Please verify the date/time shown above is correct."
        echo "If the date/time is incorrect, it may cause issues with:"
        echo "   • Logging timestamps"
        echo "   • Scheduled updates"
        echo "   • Data synchronization"
        echo ""
        echo -e "${GREEN}✅ Continuing with installation...${NC}"
        success "✅ Date/time verification completed (assumed correct)"
        echo ""
    fi
}

# Run datetime verification
verify_datetime

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

# Display diagnostic information
echo ""
echo -e "${BLUE}🔧 Installation Diagnostics:${NC}"
echo "   • URL: $PATCHMON_URL"
echo "   • CURL FLAGS: $CURL_FLAGS"
echo "   • API ID: ${API_ID:0:16}..."
echo "   • API Key: ${API_KEY:0:16}..."
echo ""

# Install required dependencies
info "📦 Installing required dependencies..."
echo ""

# Detect package manager and install jq and curl
if command -v apt-get >/dev/null 2>&1; then
    # Debian/Ubuntu
    info "Detected apt-get (Debian/Ubuntu)"
    echo ""
    info "Updating package lists..."
    apt-get update
    echo ""
    info "Installing jq, curl, and bc..."
    apt-get install jq curl bc -y
elif command -v yum >/dev/null 2>&1; then
    # CentOS/RHEL 7
    info "Detected yum (CentOS/RHEL 7)"
    echo ""
    info "Installing jq, curl, and bc..."
    yum install -y jq curl bc
elif command -v dnf >/dev/null 2>&1; then
    # CentOS/RHEL 8+/Fedora
    info "Detected dnf (CentOS/RHEL 8+/Fedora)"
    echo ""
    info "Installing jq, curl, and bc..."
    dnf install -y jq curl bc
elif command -v zypper >/dev/null 2>&1; then
    # openSUSE
    info "Detected zypper (openSUSE)"
    echo ""
    info "Installing jq, curl, and bc..."
    zypper install -y jq curl bc
elif command -v pacman >/dev/null 2>&1; then
    # Arch Linux
    info "Detected pacman (Arch Linux)"
    echo ""
    info "Installing jq, curl, and bc..."
    pacman -S --noconfirm jq curl bc
elif command -v apk >/dev/null 2>&1; then
    # Alpine Linux
    info "Detected apk (Alpine Linux)"
    echo ""
    info "Installing jq, curl, and bc..."
    apk add --no-cache jq curl bc
else
    warning "Could not detect package manager. Please ensure 'jq', 'curl', and 'bc' are installed manually."
fi

echo ""
success "Dependencies installation completed"
echo ""

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

curl $CURL_FLAGS \
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
    success "✅ TEST: API credentials are valid and server is reachable"
else
    error "❌ Failed to validate API credentials or reach server"
fi

# Step 5: Send initial data and setup automated updates
info "📊 Sending initial package data to server..."
if /usr/local/bin/patchmon-agent.sh update; then
    success "✅ UPDATE: Initial package data sent successfully"
    info "✅ Automated updates configured by agent"
else
    warning "⚠️  Failed to send initial data. You can retry later with: /usr/local/bin/patchmon-agent.sh update"
fi

# Installation complete
success "🎉 PatchMon Agent installation completed successfully!"
echo ""
echo -e "${GREEN}📋 Installation Summary:${NC}"
echo "   • Configuration directory: /etc/patchmon"
echo "   • Agent installed: /usr/local/bin/patchmon-agent.sh"
echo "   • Dependencies installed: jq, curl, bc"
echo "   • Automated updates configured via crontab"
echo "   • API credentials configured and tested"
echo "   • Update schedule managed by agent"

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
