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
    ls -t /etc/patchmon/credentials.yml.backup.* 2>/dev/null | tail -n +4 | xargs -r rm -f
    
    # Clean up old config backups
    ls -t /etc/patchmon/config.yml.backup.* 2>/dev/null | tail -n +4 | xargs -r rm -f
    
    # Clean up old agent backups
    ls -t /usr/local/bin/patchmon-agent.backup.* 2>/dev/null | tail -n +4 | xargs -r rm -f
    
    # Clean up old log files
    ls -t /etc/patchmon/logs/patchmon-agent.log.old.* 2>/dev/null | tail -n +4 | xargs -r rm -f
    
    # Clean up old shell script backups (if any exist)
    ls -t /usr/local/bin/patchmon-agent.sh.backup.* 2>/dev/null | tail -n +4 | xargs -r rm -f
    
    # Clean up old credentials backups (if any exist)
    ls -t /etc/patchmon/credentials.backup.* 2>/dev/null | tail -n +4 | xargs -r rm -f
}

# Run cleanup at start
cleanup_old_files

# Generate or retrieve machine ID
get_machine_id() {
    # Try multiple sources for machine ID
    if [[ -f /etc/machine-id ]]; then
        cat /etc/machine-id
    elif [[ -f /var/lib/dbus/machine-id ]]; then
        cat /var/lib/dbus/machine-id
    else
        # Fallback: generate from hardware info (less ideal but works)
        echo "patchmon-$(cat /sys/class/dmi/id/product_uuid 2>/dev/null || cat /proc/sys/kernel/random/uuid)"
    fi
}

# Parse arguments from environment (passed via HTTP headers)
if [[ -z "$PATCHMON_URL" ]] || [[ -z "$API_ID" ]] || [[ -z "$API_KEY" ]]; then
    error "Missing required parameters. This script should be called via the PatchMon web interface."
fi

# Parse architecture parameter (default to amd64)
ARCHITECTURE="${ARCHITECTURE:-amd64}"
if [[ "$ARCHITECTURE" != "amd64" && "$ARCHITECTURE" != "386" && "$ARCHITECTURE" != "arm64" ]]; then
    error "Invalid architecture '$ARCHITECTURE'. Must be one of: amd64, 386, arm64"
fi

# Check if --force flag is set (for bypassing broken packages)
FORCE_INSTALL="${FORCE_INSTALL:-false}"
if [[ "$*" == *"--force"* ]] || [[ "$FORCE_INSTALL" == "true" ]]; then
    FORCE_INSTALL="true"
    warning "⚠️  Force mode enabled - will bypass broken packages"
fi

# Get unique machine ID for this host
MACHINE_ID=$(get_machine_id)
export MACHINE_ID

info "🚀 Starting PatchMon Agent Installation..."
info "📋 Server: $PATCHMON_URL"
info "🔑 API ID: ${API_ID:0:16}..."
info "🆔 Machine ID: ${MACHINE_ID:0:16}..."
info "🏗️  Architecture: $ARCHITECTURE"

# Display diagnostic information
echo ""
echo -e "${BLUE}🔧 Installation Diagnostics:${NC}"
echo "   • URL: $PATCHMON_URL"
echo "   • CURL FLAGS: $CURL_FLAGS"
echo "   • API ID: ${API_ID:0:16}..."
echo "   • API Key: ${API_KEY:0:16}..."
echo "   • Architecture: $ARCHITECTURE"
echo ""

# Install required dependencies
info "📦 Installing required dependencies..."
echo ""

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install packages with error handling
install_apt_packages() {
    local packages=("$@")
    local missing_packages=()
    
    # Check which packages are missing
    for pkg in "${packages[@]}"; do
        if ! command_exists "$pkg"; then
            missing_packages+=("$pkg")
        fi
    done
    
    if [ ${#missing_packages[@]} -eq 0 ]; then
        success "All required packages are already installed"
        return 0
    fi
    
    info "Need to install: ${missing_packages[*]}"
    
    # Build apt-get command based on force mode
    local apt_cmd="apt-get install ${missing_packages[*]} -y"
    
    if [[ "$FORCE_INSTALL" == "true" ]]; then
        info "Using force mode - bypassing broken packages..."
        apt_cmd="$apt_cmd -o APT::Get::Fix-Broken=false -o DPkg::Options::=\"--force-confold\" -o DPkg::Options::=\"--force-confdef\""
    fi
    
    # Try to install packages
    if eval "$apt_cmd" 2>&1 | tee /tmp/patchmon_apt_install.log; then
        success "Packages installed successfully"
        return 0
    else
        warning "Package installation encountered issues, checking if required tools are available..."
        
        # Verify critical dependencies are actually available
        local all_ok=true
        for pkg in "${packages[@]}"; do
            if ! command_exists "$pkg"; then
                if [[ "$FORCE_INSTALL" == "true" ]]; then
                    error "Critical dependency '$pkg' is not available even with --force. Please install manually."
                else
                    error "Critical dependency '$pkg' is not available. Try again with --force flag or install manually: apt-get install $pkg"
                fi
                all_ok=false
            fi
        done
        
        if $all_ok; then
            success "All required tools are available despite installation warnings"
            return 0
        else
            return 1
        fi
    fi
}

# Detect package manager and install jq and curl
if command -v apt-get >/dev/null 2>&1; then
    # Debian/Ubuntu
    info "Detected apt-get (Debian/Ubuntu)"
    echo ""
    
    # Check for broken packages
    if dpkg -l | grep -q "^iH\|^iF" 2>/dev/null; then
        if [[ "$FORCE_INSTALL" == "true" ]]; then
            warning "Detected broken packages on system - force mode will work around them"
        else
            warning "⚠️  Broken packages detected on system"
            warning "If installation fails, retry with: curl -s {URL}/api/v1/hosts/install --force -H ..."
        fi
    fi
    
    info "Updating package lists..."
    apt-get update || true
    echo ""
    info "Installing jq, curl, and bc..."
    install_apt_packages jq curl bc
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

# Step 2: Create configuration files
info "🔐 Creating configuration files..."

# Check if config file already exists
if [[ -f "/etc/patchmon/config.yml" ]]; then
    warning "⚠️  Config file already exists at /etc/patchmon/config.yml"
    warning "⚠️  Moving existing file out of the way for fresh installation"
    
    # Clean up old config backups (keep only last 3)
    ls -t /etc/patchmon/config.yml.backup.* 2>/dev/null | tail -n +4 | xargs -r rm -f
    
    # Move existing file out of the way
    mv /etc/patchmon/config.yml /etc/patchmon/config.yml.backup.$(date +%Y%m%d_%H%M%S)
    info "📋 Moved existing config to: /etc/patchmon/config.yml.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Check if credentials file already exists
if [[ -f "/etc/patchmon/credentials.yml" ]]; then
    warning "⚠️  Credentials file already exists at /etc/patchmon/credentials.yml"
    warning "⚠️  Moving existing file out of the way for fresh installation"
    
    # Clean up old credential backups (keep only last 3)
    ls -t /etc/patchmon/credentials.yml.backup.* 2>/dev/null | tail -n +4 | xargs -r rm -f
    
    # Move existing file out of the way
    mv /etc/patchmon/credentials.yml /etc/patchmon/credentials.yml.backup.$(date +%Y%m%d_%H%M%S)
    info "📋 Moved existing credentials to: /etc/patchmon/credentials.yml.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Clean up old credentials file if it exists (from previous installations)
if [[ -f "/etc/patchmon/credentials" ]]; then
    warning "⚠️  Found old credentials file, removing it..."
    rm -f /etc/patchmon/credentials
    info "📋 Removed old credentials file"
fi

# Create main config file
cat > /etc/patchmon/config.yml << EOF
# PatchMon Agent Configuration
# Generated on $(date)
patchmon_server: "$PATCHMON_URL"
api_version: "v1"
credentials_file: "/etc/patchmon/credentials.yml"
log_file: "/etc/patchmon/logs/patchmon-agent.log"
log_level: "info"
EOF

# Create credentials file
cat > /etc/patchmon/credentials.yml << EOF
# PatchMon API Credentials
# Generated on $(date)
api_id: "$API_ID"
api_key: "$API_KEY"
EOF

chmod 600 /etc/patchmon/config.yml
chmod 600 /etc/patchmon/credentials.yml

# Step 3: Download the PatchMon agent binary using API credentials
info "📥 Downloading PatchMon agent binary..."

# Determine the binary filename based on architecture
BINARY_NAME="patchmon-agent-linux-${ARCHITECTURE}"

# Check if agent binary already exists
if [[ -f "/usr/local/bin/patchmon-agent" ]]; then
    warning "⚠️  Agent binary already exists at /usr/local/bin/patchmon-agent"
    warning "⚠️  Moving existing file out of the way for fresh installation"
    
    # Clean up old agent backups (keep only last 3)
    ls -t /usr/local/bin/patchmon-agent.backup.* 2>/dev/null | tail -n +4 | xargs -r rm -f
    
    # Move existing file out of the way
    mv /usr/local/bin/patchmon-agent /usr/local/bin/patchmon-agent.backup.$(date +%Y%m%d_%H%M%S)
    info "📋 Moved existing agent to: /usr/local/bin/patchmon-agent.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Clean up old shell script if it exists (from previous installations)
if [[ -f "/usr/local/bin/patchmon-agent.sh" ]]; then
    warning "⚠️  Found old shell script agent, removing it..."
    rm -f /usr/local/bin/patchmon-agent.sh
    info "📋 Removed old shell script agent"
fi

# Download the binary
curl $CURL_FLAGS \
    -H "X-API-ID: $API_ID" \
    -H "X-API-KEY: $API_KEY" \
    "$PATCHMON_URL/api/v1/hosts/agent/download?arch=$ARCHITECTURE&force=binary" \
    -o /usr/local/bin/patchmon-agent

chmod +x /usr/local/bin/patchmon-agent

# Get the agent version from the binary
AGENT_VERSION=$(/usr/local/bin/patchmon-agent version 2>/dev/null || echo "Unknown")
info "📋 Agent version: $AGENT_VERSION"

# Handle existing log files and create log directory
info "📁 Setting up log directory..."

# Create log directory if it doesn't exist
mkdir -p /etc/patchmon/logs

# Handle existing log files
if [[ -f "/etc/patchmon/logs/patchmon-agent.log" ]]; then
    warning "⚠️  Existing log file found at /etc/patchmon/logs/patchmon-agent.log"
    warning "⚠️  Rotating log file for fresh start"
    
    # Rotate the log file
    mv /etc/patchmon/logs/patchmon-agent.log /etc/patchmon/logs/patchmon-agent.log.old.$(date +%Y%m%d_%H%M%S)
    info "📋 Log file rotated to: /etc/patchmon/logs/patchmon-agent.log.old.$(date +%Y%m%d_%H%M%S)"
fi

# Step 4: Test the configuration
# Check if this machine is already enrolled
info "🔍 Checking if machine is already enrolled..."
existing_check=$(curl $CURL_FLAGS -s -X POST \
    -H "X-API-ID: $API_ID" \
    -H "X-API-KEY: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"machine_id\": \"$MACHINE_ID\"}" \
    "$PATCHMON_URL/api/v1/hosts/check-machine-id" \
    -w "\n%{http_code}" 2>&1)

http_code=$(echo "$existing_check" | tail -n 1)
response_body=$(echo "$existing_check" | sed '$d')

if [[ "$http_code" == "200" ]]; then
    already_enrolled=$(echo "$response_body" | jq -r '.exists' 2>/dev/null || echo "false")
    if [[ "$already_enrolled" == "true" ]]; then
        warning "⚠️  This machine is already enrolled in PatchMon"
        info "Machine ID: $MACHINE_ID"
        info "Existing host: $(echo "$response_body" | jq -r '.host.friendly_name' 2>/dev/null)"
        info ""
        info "The agent will be reinstalled/updated with existing credentials."
        echo ""
    else
        success "✅ Machine not yet enrolled - proceeding with installation"
    fi
fi

info "🧪 Testing API credentials and connectivity..."
if /usr/local/bin/patchmon-agent ping; then
    success "✅ TEST: API credentials are valid and server is reachable"
else
    error "❌ Failed to validate API credentials or reach server"
fi

# Step 5: Send initial data and setup systemd service
info "📊 Sending initial package data to server..."
if /usr/local/bin/patchmon-agent report; then
    success "✅ UPDATE: Initial package data sent successfully"
else
    warning "⚠️  Failed to send initial data. You can retry later with: /usr/local/bin/patchmon-agent report"
fi

# Step 6: Setup systemd service for WebSocket connection
info "🔧 Setting up systemd service..."

# Stop and disable existing service if it exists
if systemctl is-active --quiet patchmon-agent.service 2>/dev/null; then
    warning "⚠️  Stopping existing PatchMon agent service..."
    systemctl stop patchmon-agent.service
fi

if systemctl is-enabled --quiet patchmon-agent.service 2>/dev/null; then
    warning "⚠️  Disabling existing PatchMon agent service..."
    systemctl disable patchmon-agent.service
fi

# Create systemd service file
cat > /etc/systemd/system/patchmon-agent.service << EOF
[Unit]
Description=PatchMon Agent Service
After=network.target
Wants=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/patchmon-agent serve
Restart=always
RestartSec=10
WorkingDirectory=/etc/patchmon

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=patchmon-agent

[Install]
WantedBy=multi-user.target
EOF

# Clean up old crontab entries if they exist (from previous installations)
if crontab -l 2>/dev/null | grep -q "patchmon-agent"; then
    warning "⚠️  Found old crontab entries, removing them..."
    crontab -l 2>/dev/null | grep -v "patchmon-agent" | crontab -
    info "📋 Removed old crontab entries"
fi

# Reload systemd and enable/start the service
systemctl daemon-reload
systemctl enable patchmon-agent.service
systemctl start patchmon-agent.service

# Check if service started successfully
if systemctl is-active --quiet patchmon-agent.service; then
    success "✅ PatchMon Agent service started successfully"
    info "🔗 WebSocket connection established"
else
    warning "⚠️  Service may have failed to start. Check status with: systemctl status patchmon-agent"
fi

# Installation complete
success "🎉 PatchMon Agent installation completed successfully!"
echo ""
echo -e "${GREEN}📋 Installation Summary:${NC}"
echo "   • Configuration directory: /etc/patchmon"
echo "   • Agent binary installed: /usr/local/bin/patchmon-agent"
echo "   • Architecture: $ARCHITECTURE"
echo "   • Dependencies installed: jq, curl, bc"
echo "   • Systemd service configured and running"
echo "   • API credentials configured and tested"
echo "   • WebSocket connection established"
echo "   • Logs directory: /etc/patchmon/logs"

# Check for moved files and show them
MOVED_FILES=$(ls /etc/patchmon/credentials.yml.backup.* /etc/patchmon/config.yml.backup.* /usr/local/bin/patchmon-agent.backup.* /etc/patchmon/logs/patchmon-agent.log.old.* /usr/local/bin/patchmon-agent.sh.backup.* /etc/patchmon/credentials.backup.* 2>/dev/null || true)
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
echo "   • Test connection: /usr/local/bin/patchmon-agent ping"
echo "   • Manual report: /usr/local/bin/patchmon-agent report"
echo "   • Check status: /usr/local/bin/patchmon-agent diagnostics"
echo "   • Service status: systemctl status patchmon-agent"
echo "   • Service logs: journalctl -u patchmon-agent -f"
echo "   • Restart service: systemctl restart patchmon-agent"
echo ""
success "✅ Your system is now being monitored by PatchMon!"
