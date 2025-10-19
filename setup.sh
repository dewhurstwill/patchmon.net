#!/bin/bash
# PatchMon Self-Hosting Installation Script
# Automated deployment script for self-hosted PatchMon instances
# Usage: ./self-hosting-install.sh
# Interactive self-hosting installation script

set -e

# Create main installation log file
INSTALL_LOG="/var/log/patchmon-install.log"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] === PatchMon Self-Hosting Installation Started ===" >> "$INSTALL_LOG"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Script PID: $$" >> "$INSTALL_LOG"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running as user: $(whoami)" >> "$INSTALL_LOG"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Current directory: $(pwd)" >> "$INSTALL_LOG"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Script arguments: $@" >> "$INSTALL_LOG"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Script path: $0" >> "$INSTALL_LOG"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ======================================" >> "$INSTALL_LOG"

# Create immediate debug log for troubleshooting
DEBUG_LOG="/tmp/patchmon_debug_$(date +%Y%m%d_%H%M%S).log"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] === PatchMon Script Started ===" >> "$DEBUG_LOG"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Script PID: $$" >> "$DEBUG_LOG"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running as user: $(whoami)" >> "$DEBUG_LOG"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Current directory: $(pwd)" >> "$DEBUG_LOG"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Script arguments: $@" >> "$DEBUG_LOG"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Script path: $0" >> "$DEBUG_LOG"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ======================================" >> "$DEBUG_LOG"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Global variables
SCRIPT_VERSION="self-hosting-install.sh v1.3.0-selfhost-2025-10-19-1"
DEFAULT_GITHUB_REPO="https://github.com/PatchMon/PatchMon.git"
FQDN=""
CUSTOM_FQDN=""
EMAIL=""

# Logging function
function log_message() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local log_file="/var/log/patchmon-install.log"
    
    echo "[${timestamp}] ${message}" >> "$log_file"
    echo "[${timestamp}] ${message}"
}
DEPLOYMENT_BRANCH="main"
GITHUB_REPO=""
DB_SAFE_DB_DB_USER=""
DB_PASS=""
JWT_SECRET=""
BACKEND_PORT=""
APP_DIR=""
SERVICE_USE_LETSENCRYPT="true"  # Will be set based on user input
SERVER_PROTOCOL_SEL="https"
SERVER_PORT_SEL=""  # Will be set to BACKEND_PORT in init_instance_vars
SETUP_NGINX="true"
UPDATE_MODE="false"
SELECTED_INSTANCE=""
SELECTED_SERVICE_NAME=""

# Functions
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_question() {
    echo -e "${BLUE}❓ $1${NC}"
}

print_success() {
    echo -e "${GREEN}🎉 $1${NC}"
}

# Interactive input functions
read_input() {
    local prompt="$1"
    local var_name="$2"
    local default_value="$3"
    
    if [ -n "$default_value" ]; then
        echo -n -e "${BLUE}$prompt${NC} [${YELLOW}$default_value${NC}]: "
    else
        echo -n -e "${BLUE}$prompt${NC}: "
    fi
    
    read -r input
    if [ -z "$input" ] && [ -n "$default_value" ]; then
        eval "$var_name='$default_value'"
    else
        eval "$var_name='$input'"
    fi
}

read_yes_no() {
    local prompt="$1"
    local var_name="$2"
    local default_value="$3"
    
    while true; do
        if [ -n "$default_value" ]; then
            echo -n -e "${BLUE}$prompt${NC} [${YELLOW}$default_value${NC}]: "
        else
            echo -n -e "${BLUE}$prompt${NC} (y/n): "
        fi
        read -r input
        
        if [ -z "$input" ] && [ -n "$default_value" ]; then
            input="$default_value"
        fi
        
        case $input in
            [Yy]|[Yy][Ee][Ss])
                eval "$var_name='y'"
                break
                ;;
            [Nn]|[Nn][Oo])
                eval "$var_name='n'"
                break
                ;;
            *)
                print_error "Please answer yes (y) or no (n)"
                ;;
        esac
    done
}

print_banner() {
    echo -e "${BLUE}====================================================${NC}"
    echo -e "${BLUE}        PatchMon Self-Hosting Installation${NC}"
    echo -e "${BLUE}Running: $SCRIPT_VERSION${NC}"
    echo -e "${BLUE}====================================================${NC}"
}

# Interactive setup functions
check_timezone() {
    print_info "Checking current timezone..."
    current_tz=$(timedatectl show --property=Timezone --value 2>/dev/null || echo "Unknown")
    
    if [ "$current_tz" != "Unknown" ]; then
        current_datetime=$(date)
        print_info "Current timezone: $current_tz"
        print_info "Current date/time: $current_datetime"
        read_yes_no "Is this timezone and date/time correct?" TIMEZONE_CORRECT "y"
        
        if [ "$TIMEZONE_CORRECT" = "n" ]; then
            print_info "Available timezones:"
            timedatectl list-timezones | head -20
            print_warning "Showing first 20 timezones. Use 'timedatectl list-timezones' to see all."
            read_input "Enter your timezone (e.g., America/New_York, Europe/London)" NEW_TIMEZONE
            
            if [ -n "$NEW_TIMEZONE" ]; then
                print_info "Setting timezone to $NEW_TIMEZONE..."
                timedatectl set-timezone "$NEW_TIMEZONE"
                print_status "Timezone updated to $NEW_TIMEZONE"
                
                # Show updated date/time
                updated_datetime=$(date)
                print_info "Updated date/time: $updated_datetime"
            fi
        fi
    else
        print_warning "Could not detect timezone. Please set it manually if needed."
        current_datetime=$(date)
        print_info "Current date/time: $current_datetime"
    fi
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root"
        print_info "Please run: sudo $0"
        exit 1
    fi
}

# Function to run commands as a specific user with better error handling
run_as_user() {
    local user="$1"
    local command="$2"
    
    if ! command -v sudo >/dev/null 2>&1; then
        print_error "sudo is required but not installed. Please install sudo first."
        exit 1
    fi
    
    if ! id "$user" &>/dev/null; then
        print_error "User '$user' does not exist"
        exit 1
    fi
    
    sudo -u "$user" bash -c "$command"
}

# Detect and use the best available package manager
detect_package_manager() {
    # Prefer apt over apt-get for modern Debian/Ubuntu systems
    if command -v apt >/dev/null 2>&1; then
        PKG_MANAGER="apt"
        PKG_UPDATE="apt update"
        PKG_UPGRADE="apt upgrade -y"
        PKG_INSTALL="apt install -y"
    elif command -v apt-get >/dev/null 2>&1; then
        PKG_MANAGER="apt-get"
        PKG_UPDATE="apt-get update"
        PKG_UPGRADE="apt-get upgrade -y"
        PKG_INSTALL="apt-get install -y"
    else
        print_error "No supported package manager found (apt or apt-get required)"
        print_info "This script requires a Debian/Ubuntu-based system"
        exit 1
    fi
    
    print_info "Using package manager: $PKG_MANAGER"
}

check_prerequisites() {
    print_info "Running and checking prerequisites..."
    
    # Check if running as root
    check_root
    
    # Detect package manager
    detect_package_manager
    
    print_info "Installing updates..."
    $PKG_UPDATE -y
    $PKG_UPGRADE
    
    print_info "Installing prerequisite applications..."
    # Install sudo if not present (needed for user switching)
    if ! command -v sudo >/dev/null 2>&1; then
        print_info "Installing sudo (required for user switching)..."
        $PKG_INSTALL sudo
    fi
    
    $PKG_INSTALL wget curl jq git netcat-openbsd
    
    print_status "Prerequisites installed successfully"
}

select_branch() {
    print_info "Fetching available releases from GitHub repository..."
    
    # Create temporary directory for git operations
    TEMP_DIR="/tmp/patchmon_branches_$$"
    mkdir -p "$TEMP_DIR"
    cd "$TEMP_DIR"
    
    # Try to clone the repository normally
    if git clone "$DEFAULT_GITHUB_REPO" . 2>/dev/null; then
        # Get list of tags sorted by version (semantic versioning)
        # Using git tag with version sorting
        tags=$(git tag -l --sort=-v:refname 2>/dev/null | head -3)
        
        if [ -n "$tags" ]; then
            print_info "Available releases and branches:"
            echo ""
            
            # Display last 3 release tags
            option_count=1
            declare -A options_map
            
            while IFS= read -r tag; do
                if [ -n "$tag" ]; then
                    # Get tag date and commit info
                    tag_date=$(git log -1 --format="%ci" "$tag" 2>/dev/null || echo "Unknown")
                    
                    # Format the date
                    if [ "$tag_date" != "Unknown" ]; then
                        formatted_date=$(date -d "$tag_date" "+%Y-%m-%d %H:%M" 2>/dev/null || echo "$tag_date")
                    else
                        formatted_date="Unknown"
                    fi
                    
                    # Mark the first one as latest
                    if [ $option_count -eq 1 ]; then
                        printf "%2d. %-20s (Latest Release - %s)\n" "$option_count" "$tag" "$formatted_date"
                    else
                        printf "%2d. %-20s (Release - %s)\n" "$option_count" "$tag" "$formatted_date"
                    fi
                    
                    # Store the tag for later selection
                    options_map[$option_count]="$tag"
                    option_count=$((option_count + 1))
                fi
            done <<< "$tags"
            
            # Add main branch as an option
            main_commit=$(git log -1 --format="%ci" "origin/main" 2>/dev/null || echo "Unknown")
            if [ "$main_commit" != "Unknown" ]; then
                formatted_main_date=$(date -d "$main_commit" "+%Y-%m-%d %H:%M" 2>/dev/null || echo "$main_commit")
            else
                formatted_main_date="Unknown"
            fi
            printf "%2d. %-20s (Development Branch - %s)\n" "$option_count" "main" "$formatted_main_date"
            options_map[$option_count]="main"
            
            echo ""
            
            # Default to option 1 (latest release tag)
            default_option=1
            
            while true; do
                read_input "Select version/branch number" SELECTION_NUMBER "$default_option"
                
                if [[ "$SELECTION_NUMBER" =~ ^[0-9]+$ ]]; then
                    selected_option="${options_map[$SELECTION_NUMBER]}"
                    if [ -n "$selected_option" ]; then
                        DEPLOYMENT_BRANCH="$selected_option"
                        
                        # Show confirmation
                        if [ "$selected_option" = "main" ]; then
                            print_status "Selected branch: main (latest development code)"
                            print_info "Last commit: $formatted_main_date"
                        else
                            print_status "Selected release: $selected_option"
                            tag_date=$(git log -1 --format="%ci" "$selected_option" 2>/dev/null || echo "Unknown")
                            if [ "$tag_date" != "Unknown" ]; then
                                formatted_date=$(date -d "$tag_date" "+%Y-%m-%d %H:%M" 2>/dev/null || echo "$tag_date")
                                print_info "Release date: $formatted_date"
                            fi
                        fi
                        break
                    else
                        print_error "Invalid selection number. Please try again."
                    fi
                else
                    print_error "Please enter a valid number."
                fi
            done
        else
            print_warning "No release tags found, using default: main"
            DEPLOYMENT_BRANCH="main"
        fi
    else
        print_warning "Could not connect to GitHub repository"
        print_warning "This might be due to:"
        print_warning "  • Network connectivity issues"
        print_warning "  • Firewall blocking git access"
        print_warning "  • GitHub repository access restrictions"
        print_warning "Using default branch: main"
        DEPLOYMENT_BRANCH="main"
    fi
    
    # Clean up
    cd /
    rm -rf "$TEMP_DIR"
}

interactive_setup() {
    print_banner
    
    print_info "Welcome to PatchMon Self-Hosting Installation!"
    print_info "This script will guide you through the installation process."
    echo ""
    
    # Check prerequisites
    check_prerequisites
    echo ""
    
    # Check timezone
    check_timezone
    echo ""
    
    # Get basic information
    print_question "Let's gather some information about your installation:"
    echo ""
    
    read_input "Enter your domain name or IP address (e.g., patchmon.yourdomain.com or 192.168.1.100)" FQDN "patchmon.internal"
    
    echo ""
    print_info "🔒 SSL/HTTPS Configuration:"
    print_info "   • Public hosting (accessible from internet): Enable SSL for security"
    print_info "   • Local hosting (internal network only): SSL not required"
    echo ""
    read_yes_no "Are you hosting this publicly on the internet and want SSL/HTTPS with Let's Encrypt?" SSL_ENABLED "n"
    
    if [ "$SSL_ENABLED" = "y" ]; then
        read_input "Enter your email address for Let's Encrypt SSL certificate" EMAIL
    else
        EMAIL=""
    fi
    
    
    # Select branch
    echo ""
    select_branch
    echo ""
    
    # Confirm settings
    print_info "Please confirm your settings:"
    echo "  Domain/IP: $FQDN"
    echo "  SSL Enabled: $SSL_ENABLED"
    if [ "$SSL_ENABLED" = "y" ]; then
        echo "  Email: $EMAIL"
    fi
    echo "  Branch: $DEPLOYMENT_BRANCH"
    echo ""
    
    read_yes_no "Proceed with installation?" CONFIRM_INSTALL "y"
    
    if [ "$CONFIRM_INSTALL" = "n" ]; then
        print_info "Installation cancelled by user."
        exit 0
    fi
    
    print_success "Starting installation process..."
    echo ""
}

# Generate random password
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

# Generate JWT secret
generate_jwt_secret() {
    openssl rand -base64 64 | tr -d "=+/" | cut -c1-50
}

# Generate Redis password
generate_redis_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

# Find next available Redis database
find_next_redis_db() {
    print_info "Finding next available Redis database..."
    
    # Start from database 0 and keep checking until we find an empty one
    local db_num=0
    local max_attempts=16  # Redis default is 16 databases
    
    while [ $db_num -lt $max_attempts ]; do
        # Test if database is empty
        local key_count
        local redis_output
        
        # Try to get database size
        redis_output=$(redis-cli -h localhost -p 6379 -n "$db_num" DBSIZE 2>&1)
        
        # Check for errors
        if echo "$redis_output" | grep -q "ERR"; then
            if echo "$redis_output" | grep -q "invalid DB index"; then
                print_warning "Reached maximum database limit at database $db_num"
                break
            else
                print_error "Error checking database $db_num: $redis_output"
                return 1
            fi
        fi
        
        key_count="$redis_output"
        
        # If database is empty, use it
        if [ "$key_count" = "0" ]; then
            print_status "Found available Redis database: $db_num (empty)"
            echo "$db_num"
            return 0
        fi
        
        print_info "Database $db_num has $key_count keys, checking next..."
        db_num=$((db_num + 1))
    done
    
    print_warning "No available Redis databases found (checked 0-$max_attempts)"
    print_info "Using database 0 (may have existing data)"
    echo "0"
    return 0
}

# Initialize instance variables
init_instance_vars() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] init_instance_vars function started" >> "$DEBUG_LOG"
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Creating safe database name from FQDN: $FQDN" >> "$DEBUG_LOG"
    
    # Create safe database name from FQDN
    DB_SAFE_NAME=$(echo "$FQDN" | sed 's/[^a-zA-Z0-9]/_/g' | sed 's/^_*//' | sed 's/_*$//')
    
    # Check if FQDN starts with a digit (likely an IP address)
    if [[ "$FQDN" =~ ^[0-9] ]]; then
        # Generate 2 random letters for IP address prefixing
        RANDOM_PREFIX=$(tr -dc 'a-z' < /dev/urandom | head -c 2)
        DB_SAFE_NAME="${RANDOM_PREFIX}${DB_SAFE_NAME}"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] IP address detected, prefixed with: $RANDOM_PREFIX" >> "$DEBUG_LOG"
        print_info "IP address detected ($FQDN), using prefix '$RANDOM_PREFIX' for database/service names"
    fi
    
    DB_NAME="${DB_SAFE_NAME}"
    DB_USER="${DB_SAFE_NAME}"
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] DB_SAFE_NAME: $DB_SAFE_NAME" >> "$DEBUG_LOG"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] DB_NAME: $DB_NAME" >> "$DEBUG_LOG"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] DB_USER: $DB_USER" >> "$DEBUG_LOG"
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Generating password..." >> "$DEBUG_LOG"
    DB_PASS=$(generate_password)
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Generating JWT secret..." >> "$DEBUG_LOG"
    JWT_SECRET=$(generate_jwt_secret)
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Generating Redis password..." >> "$DEBUG_LOG"
    REDIS_PASSWORD=$(generate_redis_password)
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Finding next available Redis database..." >> "$DEBUG_LOG"
    REDIS_DB=$(find_next_redis_db)
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Generating random backend port..." >> "$DEBUG_LOG"
    
    # Generate random backend port (3001-3999)
    BACKEND_PORT=$((3001 + RANDOM % 999))
    
    # Set SERVER_PORT_SEL to 443 for HTTPS (external port) or backend port for HTTP
    if [ "$SERVER_PROTOCOL_SEL" = "https" ]; then
        SERVER_PORT_SEL=443
    else
        SERVER_PORT_SEL=$BACKEND_PORT
    fi
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] BACKEND_PORT: $BACKEND_PORT" >> "$DEBUG_LOG"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] SERVER_PORT_SEL: $SERVER_PORT_SEL" >> "$DEBUG_LOG"
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Setting application directory and service name..." >> "$DEBUG_LOG"
    
    # Set application directory and service name
    APP_DIR="/opt/${FQDN}"
    SERVICE_NAME="${FQDN}"
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] APP_DIR: $APP_DIR" >> "$DEBUG_LOG"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] SERVICE_NAME: $SERVICE_NAME" >> "$DEBUG_LOG"
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Creating dedicated user name..." >> "$DEBUG_LOG"
    
    # Create dedicated user name (safe for system users)
    INSTANCE_USER=$(echo "$DB_SAFE_NAME" | cut -c1-32)
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] INSTANCE_USER: $INSTANCE_USER" >> "$DEBUG_LOG"
    
    print_info "Initialized variables for $FQDN"
    print_info "Database: $DB_NAME"
    print_info "Backend Port: $BACKEND_PORT"
    print_info "App Directory: $APP_DIR"
    print_info "Instance User: $INSTANCE_USER"
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] init_instance_vars function completed successfully" >> "$DEBUG_LOG"
}

# Update system packages
update_system() {
    print_info "Updating system packages..."
    $PKG_UPDATE -y
    $PKG_UPGRADE
}

# Install essential tools
install_essential_tools() {
    print_info "Installing essential tools..."
    $PKG_INSTALL curl netcat-openbsd git jq
}

# Install Node.js (if not already installed)
install_nodejs() {
    # Force PATH refresh to ensure we get the latest Node.js
    export PATH="/usr/bin:/usr/local/bin:$PATH"
    hash -r  # Clear bash command cache
    
    NODE_VERSION=""
    if command -v node >/dev/null 2>&1; then
        NODE_VERSION=$(node --version 2>/dev/null | sed 's/v//')
        print_info "Node.js already installed: v$NODE_VERSION"
        
        # Check if version is 18 or higher
        if [ "$(echo "$NODE_VERSION" | cut -d. -f1)" -ge 18 ]; then
            print_status "Node.js version is sufficient (v$NODE_VERSION)"
            # Clean npm cache to avoid issues
            npm cache clean --force 2>/dev/null || true
            return 0
        else
            print_warning "Node.js version $NODE_VERSION is too old, updating..."
        fi
    fi
    
    print_info "Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    $PKG_INSTALL nodejs
    
    # Verify installation
    NODE_VERSION=$(node --version | sed 's/v//')
    NPM_VERSION=$(npm --version)
    print_status "Node.js installed: v$NODE_VERSION"
    print_status "npm installed: v$NPM_VERSION"
    
    # Clean npm cache to avoid issues
    npm cache clean --force 2>/dev/null || true
}

# Install PostgreSQL
install_postgresql() {
    print_info "Installing PostgreSQL..."
    
    if systemctl is-active --quiet postgresql; then
        print_status "PostgreSQL already running"
    else
        $PKG_INSTALL postgresql postgresql-contrib
        systemctl start postgresql
        systemctl enable postgresql
        print_status "PostgreSQL installed and started"
    fi
}

# Install Redis
install_redis() {
    print_info "Installing Redis..."
    
    if systemctl is-active --quiet redis-server; then
        print_status "Redis already running"
    else
        $PKG_INSTALL redis-server
        systemctl start redis-server
        systemctl enable redis-server
        print_status "Redis installed and started"
    fi
}

# Configure Redis with user authentication
configure_redis() {
    print_info "Configuring Redis with user authentication..."
    
    # Check if Redis is running
    if ! systemctl is-active --quiet redis-server; then
        print_error "Redis is not running. Please start Redis first."
        return 1
    fi
    
    # Generate Redis username based on instance
    REDIS_USER="patchmon_${DB_SAFE_NAME}"
    
    # Generate separate user password (more secure than reusing admin password)
    REDIS_USER_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    
    print_info "Creating Redis user: $REDIS_USER for database $REDIS_DB"
    
    # Create Redis configuration backup
    if [ -f /etc/redis/redis.conf ]; then
        cp /etc/redis/redis.conf /etc/redis/redis.conf.backup.$(date +%Y%m%d_%H%M%S)
        print_info "Created Redis configuration backup"
    fi
    
    # Configure Redis with ACL authentication
    print_info "Configuring Redis with ACL authentication"
    
    # Ensure ACL file exists and is configured
    if [ ! -f /etc/redis/users.acl ]; then
        touch /etc/redis/users.acl
        chown redis:redis /etc/redis/users.acl
        chmod 640 /etc/redis/users.acl
        print_status "Created Redis ACL file"
    fi
    
    # Configure ACL file in redis.conf
    if ! grep -q "^aclfile" /etc/redis/redis.conf; then
        echo "aclfile /etc/redis/users.acl" >> /etc/redis/redis.conf
        print_status "Added ACL file configuration to Redis"
    fi
    
    # Remove any requirepass configuration (incompatible with ACL)
    if grep -q "^requirepass" /etc/redis/redis.conf; then
        sed -i 's/^requirepass.*/# &/' /etc/redis/redis.conf
        print_status "Disabled requirepass (incompatible with ACL)"
    fi
    
    # Remove any user definitions from redis.conf (should be in ACL file)
    if grep -q "^user " /etc/redis/redis.conf; then
        sed -i '/^user /d' /etc/redis/redis.conf
        print_status "Removed user definitions from redis.conf"
    fi
    
    # Create admin user in ACL file if it doesn't exist
    if ! grep -q "^user admin" /etc/redis/users.acl; then
        echo "user admin on sanitize-payload >$REDIS_PASSWORD ~* &* +@all" >> /etc/redis/users.acl
        print_status "Added admin user to ACL file"
    fi
    
    # Restart Redis to apply ACL configuration
    print_info "Restarting Redis to apply ACL configuration..."
    systemctl restart redis-server
    
    # Wait for Redis to start
    sleep 3
    
    # Test admin connection
    if ! redis-cli -h 127.0.0.1 -p 6379 --user admin --pass "$REDIS_PASSWORD" --no-auth-warning ping > /dev/null 2>&1; then
        print_error "Failed to configure Redis ACL authentication"
        return 1
    fi
    
    print_status "Redis ACL authentication configuration successful"
    
    # Create Redis user with ACL
    print_info "Creating Redis ACL user: $REDIS_USER"
    
    # Create user with password and permissions - capture output for error handling
    local acl_result
    acl_result=$(redis-cli -h 127.0.0.1 -p 6379 --user admin --pass "$REDIS_PASSWORD" --no-auth-warning ACL SETUSER "$REDIS_USER" on ">${REDIS_USER_PASSWORD}" ~* +@all 2>&1)
    
    if [ "$acl_result" = "OK" ]; then
        print_status "Redis user '$REDIS_USER' created successfully"
        
        # Save ACL users to file to persist across restarts
        local save_result
        save_result=$(redis-cli -h 127.0.0.1 -p 6379 --user admin --pass "$REDIS_PASSWORD" --no-auth-warning ACL SAVE 2>&1)
        
        if [ "$save_result" = "OK" ]; then
            print_status "Redis ACL users saved to file"
        else
            print_warning "Failed to save ACL users to file: $save_result"
        fi
        
        # Verify user was actually created
        local verify_result
        verify_result=$(redis-cli -h 127.0.0.1 -p 6379 --user admin --pass "$REDIS_PASSWORD" --no-auth-warning ACL GETUSER "$REDIS_USER" 2>&1)
        
        if [ "$verify_result" = "(nil)" ]; then
            print_error "User creation reported OK but user does not exist"
            return 1
        fi
    else
        print_error "Failed to create Redis user: $acl_result"
        return 1
    fi
    
    # Test user connection
    print_info "Testing Redis user connection..."
    if redis-cli -h 127.0.0.1 -p 6379 --user "$REDIS_USER" --pass "$REDIS_USER_PASSWORD" --no-auth-warning -n "$REDIS_DB" ping > /dev/null 2>&1; then
        print_status "Redis user connection test successful"
    else
        print_error "Redis user connection test failed"
        return 1
    fi
    
    # Mark the selected database as in-use
    redis-cli -h 127.0.0.1 -p 6379 --user "$REDIS_USER" --pass "$REDIS_USER_PASSWORD" --no-auth-warning -n "$REDIS_DB" SET "patchmon:initialized" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > /dev/null
    print_status "Marked Redis database $REDIS_DB as in-use"
    
    # Update .env with the USER PASSWORD, not admin password
    echo "REDIS_USER=$REDIS_USER" >> .env
    echo "REDIS_PASSWORD=$REDIS_USER_PASSWORD" >> .env
    echo "REDIS_DB=$REDIS_DB" >> .env
    
    print_status "Redis user password: $REDIS_USER_PASSWORD"
    
    return 0
}

# Install nginx
install_nginx() {
    print_info "Installing nginx..."
    
    if systemctl is-active --quiet nginx; then
        print_status "nginx already running"
    else
        $PKG_INSTALL nginx
        systemctl start nginx
        systemctl enable nginx
        print_status "nginx installed and started"
    fi
}

# Install certbot for Let's Encrypt
install_certbot() {
    print_info "Installing certbot for Let's Encrypt..."
    
    if command -v certbot >/dev/null 2>&1; then
        print_status "certbot already installed"
    else
        $PKG_INSTALL certbot python3-certbot-nginx
        print_status "certbot installed"
    fi
}

# Create dedicated user for this instance
create_instance_user() {
    print_info "Creating dedicated user: $INSTANCE_USER"
    
    # Create application directory first (as root)
    mkdir -p "$APP_DIR"
    
    # Check if user already exists
    if id "$INSTANCE_USER" &>/dev/null; then
        print_warning "User $INSTANCE_USER already exists, skipping creation"
        # Ensure directory ownership is correct for existing user
        chown -R "$INSTANCE_USER:$INSTANCE_USER" "$APP_DIR"
        chmod 755 "$APP_DIR"
        return 0
    fi
    
    # Create user with no login shell and no home directory
    useradd --system --no-create-home --shell /bin/false "$INSTANCE_USER"
    
    # Set ownership and permissions
    chown -R "$INSTANCE_USER:$INSTANCE_USER" "$APP_DIR"
    chmod 755 "$APP_DIR"
    
    print_status "Dedicated user $INSTANCE_USER created successfully"
}

# Setup Node.js environment isolation for this instance
setup_nodejs_isolation() {
    print_info "Setting up Node.js environment isolation for $INSTANCE_USER..."
    
    # Create npm directories as root first
    mkdir -p "$APP_DIR/.npm" "$APP_DIR/.npm-global"
    
    # Create .npmrc file with proper configuration
    cat > "$APP_DIR/.npmrc" << EOF
cache=$APP_DIR/.npm
prefix=$APP_DIR/.npm-global
init-module=$APP_DIR/.npm-global/.npm-init.js
tmp=$APP_DIR/.npm/tmp
EOF
    
    # Set ownership to the dedicated user
    chown -R "$INSTANCE_USER:$INSTANCE_USER" "$APP_DIR/.npm" "$APP_DIR/.npm-global" "$APP_DIR/.npmrc"
    
    print_status "Node.js environment isolation configured for $INSTANCE_USER"
}

# Setup database for instance
setup_database() {
    print_info "Setting up database: $DB_NAME"
    
    # Check if sudo is available for user switching
    if command -v sudo >/dev/null 2>&1; then
        # Check if user exists
        user_exists=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" || echo "0")
        
        if [ "$user_exists" = "1" ]; then
            print_info "Database user $DB_USER already exists, skipping creation"
        else
            print_info "Creating database user $DB_USER"
            sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
        fi
        
        # Check if database exists
        db_exists=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" || echo "0")
        
        if [ "$db_exists" = "1" ]; then
            print_info "Database $DB_NAME already exists, skipping creation"
        else
            print_info "Creating database $DB_NAME"
            sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
        fi
        
        # Always grant privileges (in case they were revoked)
        sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
    else
        # Alternative method for systems without sudo (run as postgres user directly)
        print_warning "sudo not available, using alternative method for PostgreSQL setup"
        
        # Check if user exists
        user_exists=$(su - postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'\"" || echo "0")
        
        if [ "$user_exists" = "1" ]; then
            print_info "Database user $DB_USER already exists, skipping creation"
        else
            print_info "Creating database user $DB_USER"
            su - postgres -c "psql -c \"CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';\""
        fi
        
        # Check if database exists
        db_exists=$(su - postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='$DB_NAME'\"" || echo "0")
        
        if [ "$db_exists" = "1" ]; then
            print_info "Database $DB_NAME already exists, skipping creation"
        else
            print_info "Creating database $DB_NAME"
            su - postgres -c "psql -c \"CREATE DATABASE $DB_NAME OWNER $DB_USER;\""
        fi
        
        # Always grant privileges (in case they were revoked)
        su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;\""
    fi
    
    print_status "Database setup complete for $DB_NAME"
}

# Clone application repository
clone_application() {
    print_info "Cloning PatchMon application..."
    
    if [ -d "$APP_DIR" ]; then
        print_warning "Directory $APP_DIR already exists, removing..."
        rm -rf "$APP_DIR"
    fi
    
    git clone -b "$DEPLOYMENT_BRANCH" "$GITHUB_REPO" "$APP_DIR"
    
    # Set ownership to the dedicated user
    chown -R "$INSTANCE_USER:$INSTANCE_USER" "$APP_DIR"
    
    cd "$APP_DIR"
    
    print_status "Application cloned to $APP_DIR with ownership set to $INSTANCE_USER"
}

# Setup Node.js environment
setup_node_environment() {
    print_info "Setting up Node.js environment..."
    
    cd "$APP_DIR"
    
    # Set Node.js environment
    export NODE_ENV=production
    export PATH="/usr/bin:/usr/local/bin:$PATH"
    
    print_status "Node.js environment configured"
}

# Install dependencies
install_dependencies() {
    print_info "Installing dependencies as user $INSTANCE_USER..."
    
    cd "$APP_DIR"
    
    # Clean up any existing node_modules to avoid conflicts
    rm -rf node_modules
    
    # Create tmp directory for npm
    mkdir -p "$APP_DIR/.npm/tmp"
    
    # Fix npm cache ownership issues (common problem)
    chown -R "$INSTANCE_USER:$INSTANCE_USER" "$APP_DIR/.npm"
    
    # Clean npm cache to avoid permission issues
    run_as_user "$INSTANCE_USER" "cd $APP_DIR && npm cache clean --force" 2>/dev/null || true
    
    # Install root dependencies as the dedicated user
    print_info "Installing root dependencies..."
    if ! run_as_user "$INSTANCE_USER" "
        cd $APP_DIR
        export NPM_CONFIG_CACHE=$APP_DIR/.npm
        export NPM_CONFIG_PREFIX=$APP_DIR/.npm-global
        export NPM_CONFIG_TMP=$APP_DIR/.npm/tmp
        npm install --omit=dev --no-audit --no-fund --no-save --ignore-scripts
    "; then
        print_error "Failed to install root dependencies"
        return 1
    fi
    
    # Install backend dependencies as the dedicated user
    print_info "Installing backend dependencies..."
    cd backend
    rm -rf node_modules
    if ! run_as_user "$INSTANCE_USER" "
        cd $APP_DIR/backend
        export NPM_CONFIG_CACHE=$APP_DIR/.npm
        export NPM_CONFIG_PREFIX=$APP_DIR/.npm-global
        export NPM_CONFIG_TMP=$APP_DIR/.npm/tmp
        npm install --omit=dev --no-audit --no-fund --no-save --ignore-scripts
    "; then
        print_error "Failed to install backend dependencies"
        return 1
    fi
    cd ..
    
    # Install frontend dependencies as the dedicated user (including dev dependencies for build)
    print_info "Installing frontend dependencies..."
    cd frontend
    rm -rf node_modules
    if ! run_as_user "$INSTANCE_USER" "
        cd $APP_DIR/frontend
        export NPM_CONFIG_CACHE=$APP_DIR/.npm
        export NPM_CONFIG_PREFIX=$APP_DIR/.npm-global
        export NPM_CONFIG_TMP=$APP_DIR/.npm/tmp
        npm install --no-audit --no-fund --no-save --ignore-scripts
    "; then
        print_error "Failed to install frontend dependencies"
        return 1
    fi
    
    # Build frontend
    print_info "Building frontend..."
    if ! run_as_user "$INSTANCE_USER" "
        cd $APP_DIR/frontend
        export NPM_CONFIG_CACHE=$APP_DIR/.npm
        export NPM_CONFIG_PREFIX=$APP_DIR/.npm-global
        export NPM_CONFIG_TMP=$APP_DIR/.npm/tmp
        npm run build
    "; then
        print_error "Failed to build frontend"
        return 1
    fi
    cd ..
    
    # Ensure ownership is maintained
    chown -R "$INSTANCE_USER:$INSTANCE_USER" "$APP_DIR"
    
    print_status "Dependencies installed and frontend built as $INSTANCE_USER"
}

# Create environment files
create_env_files() {
    print_info "Creating environment files..."
    
    cd "$APP_DIR"
    
    # Backend .env
    cat > backend/.env << EOF
# Database Configuration
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"
PM_DB_CONN_MAX_ATTEMPTS=30
PM_DB_CONN_WAIT_INTERVAL=2

# JWT Configuration
JWT_SECRET="$JWT_SECRET"
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Server Configuration
PORT=$BACKEND_PORT
NODE_ENV=production

# API Configuration
API_VERSION=v1

# CORS Configuration
CORS_ORIGIN="$SERVER_PROTOCOL_SEL://$FQDN"

# Session Configuration
SESSION_INACTIVITY_TIMEOUT_MINUTES=30

# User Configuration
DEFAULT_USER_ROLE=user

# Rate Limiting (times in milliseconds)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=5000
AUTH_RATE_LIMIT_WINDOW_MS=600000
AUTH_RATE_LIMIT_MAX=500
AGENT_RATE_LIMIT_WINDOW_MS=60000
AGENT_RATE_LIMIT_MAX=1000

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_USER=$REDIS_USER
REDIS_PASSWORD=$REDIS_PASSWORD
REDIS_DB=$REDIS_DB

# Logging
LOG_LEVEL=info
ENABLE_LOGGING=true
EOF

    # Frontend .env
    cat > frontend/.env << EOF
VITE_API_URL=$SERVER_PROTOCOL_SEL://$FQDN/api/v1
VITE_APP_NAME=PatchMon
VITE_APP_VERSION=1.3.0
EOF

    print_status "Environment files created"
}

# Run database migrations
run_migrations() {
    print_info "Running database migrations as user $INSTANCE_USER..."
    
    cd "$APP_DIR/backend"
    # Suppress Prisma CLI output (still logged to install log via tee)
    run_as_user "$INSTANCE_USER" "cd $APP_DIR/backend && npx prisma migrate deploy" >/dev/null 2>&1 || true
    run_as_user "$INSTANCE_USER" "cd $APP_DIR/backend && npx prisma generate" >/dev/null 2>&1 || true
    
    print_status "Database migrations completed as $INSTANCE_USER"
}

# Admin account creation removed - handled by application's first-time setup

# Create systemd service
create_systemd_service() {
    print_info "Creating systemd service for user $INSTANCE_USER..."
    
    cat > "/etc/systemd/system/$SERVICE_NAME.service" << EOF
[Unit]
Description=PatchMon Service for $FQDN
After=network.target postgresql.service

[Service]
Type=simple
User=$INSTANCE_USER
Group=$INSTANCE_USER
WorkingDirectory=$APP_DIR/backend
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PATH=/usr/bin:/usr/local/bin
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$APP_DIR

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable "$SERVICE_NAME"
    
    print_status "Systemd service created: $SERVICE_NAME (running as $INSTANCE_USER)"
}

# Setup nginx configuration
setup_nginx() {
    print_info "Setting up nginx configuration..."
    log_message "Setting up nginx configuration for $FQDN"
    
    if [ "$USE_LETSENCRYPT" = "true" ]; then
        # HTTP-only config first for Certbot challenge
        cat > "/etc/nginx/sites-available/$FQDN" << EOF
server {
    listen 80;
    server_name $FQDN;
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}
EOF
    else
        # HTTP-only configuration for local hosting
        cat > "/etc/nginx/sites-available/$FQDN" << EOF
server {
    listen 80;
    server_name $FQDN;
    
    # Frontend
    location / {
        root $APP_DIR/frontend/dist;
        try_files \$uri \$uri/ /index.html;
        
        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
    }
    
    # API routes
    location /api/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # Health check
    location /health {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/health;
        access_log off;
    }
}
EOF
    fi

    # Enable site
    ln -sf "/etc/nginx/sites-available/$FQDN" "/etc/nginx/sites-enabled/"
    
    # Remove default site if it exists
    rm -f /etc/nginx/sites-enabled/default
    
    # Test nginx configuration
    nginx -t
    
    # Reload nginx
    systemctl reload nginx
    
    print_status "nginx configuration created for $FQDN"
}

# Setup Let's Encrypt SSL
setup_letsencrypt() {
    print_info "Setting up Let's Encrypt SSL certificate..."
    
    # Check if a valid certificate already exists
    if certbot certificates 2>/dev/null | grep -q "$FQDN" && certbot certificates 2>/dev/null | grep -A 10 "$FQDN" | grep -q "VALID"; then
        print_status "Valid SSL certificate already exists for $FQDN, skipping certificate generation"
        
        # Update Nginx config with existing HTTPS configuration
        cat > "/etc/nginx/sites-available/$FQDN" << EOF
server {
    listen 80;
    server_name $FQDN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $FQDN;
    
    ssl_certificate /etc/letsencrypt/live/$FQDN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$FQDN/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # Frontend
    location / {
        root $APP_DIR/frontend/dist;
        try_files \$uri \$uri/ /index.html;
        
        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
    }
    
    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
        
        # Enable the site
        ln -sf "/etc/nginx/sites-available/$FQDN" "/etc/nginx/sites-enabled/"
        
        # Test nginx configuration
        if nginx -t; then
            print_status "Nginx configuration updated for existing SSL certificate"
            systemctl reload nginx
        else
            print_error "Nginx configuration test failed"
            return 1
        fi
        
        return 0
    fi
    
    print_info "No valid certificate found, generating new SSL certificate..."
    
    # Wait a moment for nginx to be ready
    sleep 5
    
    # Obtain SSL certificate
    log_message "Obtaining SSL certificate for $FQDN using Let's Encrypt"
    certbot --nginx -d "$FQDN" --non-interactive --agree-tos --email "$EMAIL" --redirect
    log_message "SSL certificate obtained successfully"
    
    # Update Nginx config with full HTTPS configuration
    cat > "/etc/nginx/sites-available/$FQDN" << EOF
server {
    listen 80;
    server_name $FQDN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $FQDN;
    
    ssl_certificate /etc/letsencrypt/live/$FQDN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$FQDN/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    
    # Frontend
    location / {
        root $APP_DIR/frontend/dist;
        try_files \$uri \$uri/ /index.html;
        
        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    }
    
    # API routes
    location /api/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # Health check
    location /health {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/health;
        access_log off;
    }
}
EOF
    
    nginx -t
    nginx -s reload
    
    # Setup auto-renewal
    echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
    
    print_status "SSL certificate obtained and auto-renewal configured"
}

# Start services
start_services() {
    print_info "Starting services..."
    
    # Start PatchMon service
    systemctl start "$SERVICE_NAME"
    
    # Wait for service to start
    sleep 10
    
    # Check if service is running
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        print_status "PatchMon service started successfully"
    else
        print_error "Failed to start PatchMon service"
        systemctl status "$SERVICE_NAME"
        return 1
    fi
}

# Populate server settings in database
populate_server_settings() {
    print_info "Populating server settings in database..."
    
    cd "$APP_DIR/backend"
    
    # Create settings update script
    cat > update_settings.js << EOF
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateSettings() {
  try {
    // Check if settings record exists, create or update
    const existingSettings = await prisma.settings.findFirst();
    
    const settingsData = {
      server_url: '$SERVER_PROTOCOL_SEL://$FQDN',
      server_protocol: '$SERVER_PROTOCOL_SEL',
      server_host: '$FQDN',
      server_port: $SERVER_PORT_SEL,
      update_interval: 60,
      auto_update: true
    };
    
    if (existingSettings) {
      // Update existing settings
      await prisma.settings.update({
        where: { id: existingSettings.id },
        data: settingsData
      });
    } else {
      // Create new settings record
      await prisma.settings.create({
        data: settingsData
      });
    }
    
    console.log('✅ Database settings updated successfully');
  } catch (error) {
    console.error('❌ Error updating settings:', error.message);
    process.exit(1);
  } finally {
    await prisma.\$disconnect();
  }
}

updateSettings();
EOF

    # Run the settings update script as the dedicated user
    run_as_user "$INSTANCE_USER" "cd $APP_DIR/backend && node update_settings.js"
    
    # Clean up temporary script
    rm -f update_settings.js
    
    print_status "Server settings populated successfully"
}

# Create agent version
create_agent_version() {
    echo -e "${BLUE}🤖 Creating agent version...${NC}"
    log_message "Creating agent version in database..."
    cd $APP_DIR/backend
    
    # Priority 1: Get version from agent script (most accurate for agent versions)
    local current_version="N/A"
    if [ -f "$APP_DIR/agents/patchmon-agent.sh" ]; then
        current_version=$(grep '^AGENT_VERSION=' "$APP_DIR/agents/patchmon-agent.sh" | cut -d'"' -f2 2>/dev/null || echo "N/A")
        if [ "$current_version" != "N/A" ] && [ -n "$current_version" ]; then
            print_info "Detected agent version from script: $current_version"
        fi
    fi
    
    # Priority 2: Use fallback version if not found
    if [ "$current_version" = "N/A" ] || [ -z "$current_version" ]; then
        current_version="1.3.0"
        print_warning "Could not determine version, using fallback: $current_version"
    fi
    
    print_info "Creating/updating agent version: $current_version"
    print_info "This will ensure the latest agent script is available in the database"
    
    # Test connection before creating agent version
    if ! PGPASSWORD="$DB_PASS" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
        print_error "Cannot connect to database before creating agent version"
        exit 1
    fi
    
    # Copy agent script to backend directory
    if [ -f "$APP_DIR/agents/patchmon-agent.sh" ]; then
        cp "$APP_DIR/agents/patchmon-agent.sh" "$APP_DIR/backend/"
        
        print_status "Agent version management removed - using file-based approach"
# Ensure we close the conditional and the function properly
    fi

    return 0
}
# Create deployment summary
create_deployment_summary() {
    print_info "Writing deployment summary into deployment-info.txt..."
    
    # Reuse the unified deployment info file
    SUMMARY_FILE="$APP_DIR/deployment-info.txt"
    
    cat >> "$SUMMARY_FILE" << EOF

----------------------------------------------------
        Deployment Summary (Appended)
----------------------------------------------------

Deployment Information:
- Email: $EMAIL
- Branch: $DEPLOYMENT_BRANCH
- Deployed: $(date)
- Deployment Duration: $(($(date +%s) - $DEPLOYMENT_START_TIME)) seconds

Service Status:
- PatchMon Service: $(systemctl is-active $SERVICE_NAME)
- Nginx Service: $(systemctl is-active nginx)
- PostgreSQL Service: $(systemctl is-active postgresql)
- SSL Certificate: $(if [ "$USE_LETSENCRYPT" = "true" ]; then echo "Enabled"; else echo "Disabled"; fi)

Diagnostic Commands:
- Service Status: systemctl status $SERVICE_NAME
- Service Logs: journalctl -u $SERVICE_NAME -f
- Nginx Status: systemctl status nginx
- Nginx Logs: journalctl -u nginx -f
- Database Status: systemctl status postgresql
- SSL Certificate: certbot certificates
- Disk Usage: df -h $APP_DIR
- Process Status: ps aux | grep $SERVICE_NAME

Troubleshooting:
- Check deployment log: cat $APP_DIR/patchmon-install.log
- Check service logs: journalctl -u $SERVICE_NAME --since "1 hour ago"
- Check nginx config: nginx -t
- Check database connection: sudo -u $DB_USER psql -d $DB_NAME -c "SELECT 1;"
- Check port binding: netstat -tlnp | grep $BACKEND_PORT

====================================================
EOF

    # Ensure permissions
    chmod 644 "$SUMMARY_FILE"
    chown "$INSTANCE_USER:$INSTANCE_USER" "$SUMMARY_FILE"
    
    # Copy the entire installation log into the instance folder
    if [ -f "$INSTALL_LOG" ]; then
        cp "$INSTALL_LOG" "$APP_DIR/patchmon-install.log" || true
        chown "$INSTANCE_USER:$INSTANCE_USER" "$APP_DIR/patchmon-install.log" || true
        chmod 644 "$APP_DIR/patchmon-install.log" || true
    fi
    
    print_status "Unified deployment info saved to: $SUMMARY_FILE"
}

# Email notification function removed for self-hosting deployment

# Save deployment information to file
save_deployment_info() {
    print_info "Saving deployment information to file..."
    
    # Create deployment info file
    INFO_FILE="$APP_DIR/deployment-info.txt"
    
    cat > "$INFO_FILE" << EOF
====================================================
        PatchMon Deployment Information
====================================================

Instance Details:
- FQDN: $FQDN
- URL: $SERVER_PROTOCOL_SEL://$FQDN
- Deployed: $(date)
- Deployment Type: $(if [ "$USE_LETSENCRYPT" = "true" ]; then echo "Public with SSL"; else echo "Local/Internal"; fi)
- SSL Enabled: $USE_LETSENCRYPT
- Service Name: $SERVICE_NAME

Directories:
- App Directory: $APP_DIR
- Backend: $APP_DIR/backend
- Frontend (built): $APP_DIR/frontend/dist
- Node.js isolation dir: $APP_DIR/.npm

Database Information:
- Name: $DB_NAME
- User: $DB_USER
- Password: $DB_PASS
- Host: localhost
- Port: 5432

Redis Information:
- Host: localhost
- Port: 6379
- User: $REDIS_USER
- Password: $REDIS_PASSWORD
- Database: $REDIS_DB

Networking:
- Backend Port: $BACKEND_PORT
- Nginx Config: /etc/nginx/sites-available/$FQDN

Logs & Files:
- Deployment Log: $LOG_FILE
- Systemd Service: /etc/systemd/system/$SERVICE_NAME.service

Common Commands:
- Restart backend service: sudo systemctl restart $SERVICE_NAME
- Check backend status:   systemctl status $SERVICE_NAME
- Tail backend logs:      journalctl -u $SERVICE_NAME -f
- Test nginx config:      nginx -t && systemctl reload nginx
- Check DB connection:    sudo -u $DB_USER psql -d $DB_NAME -c "SELECT 1;"

First-Time Setup:
- Visit the web interface: $SERVER_PROTOCOL_SEL://$FQDN
- Create the admin account through the web UI (no pre-created credentials)

Notes:
- Default role permissions (admin/user) are created automatically on backend startup
- Keep this file for future reference of your environment

====================================================
EOF

    # Set permissions (readable by root and instance user)
    chmod 644 "$INFO_FILE"
    chown "$INSTANCE_USER:$INSTANCE_USER" "$INFO_FILE"
    
    print_status "Deployment information saved to: $INFO_FILE"
}

# Restart PatchMon service
restart_patchmon() {
    print_info "Restarting PatchMon service..."
    
    # Restart PatchMon service
    systemctl restart "$SERVICE_NAME"
    
    # Wait for service to restart
    sleep 5
    
    # Check if service is running
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        print_status "PatchMon service restarted successfully"
    else
        print_error "Failed to restart PatchMon service"
        systemctl status "$SERVICE_NAME"
        return 1
    fi
}

# Setup logging for deployment
setup_deployment_logging() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] setup_deployment_logging function started" >> "$DEBUG_LOG"
    
    print_info "Setting up deployment logging..."
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] APP_DIR variable: $APP_DIR" >> "$DEBUG_LOG"
    
    # Use the main installation log file
    LOG_FILE="$INSTALL_LOG"
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Using main log file: $LOG_FILE" >> "$DEBUG_LOG"
    
    print_info "Deployment log: $LOG_FILE"
    
    # Function to log with timestamp
    log_output() {
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
    }
    
    # Redirect all output to both terminal and log file
    exec > >(tee -a "$LOG_FILE")
    exec 2>&1
    
    log_output "=== PatchMon Deployment Started ==="
    log_output "Script started at: $(date)"
    log_output "Script PID: $$"
    log_output "Running as user: $(whoami)"
    log_output "Current directory: $(pwd)"
    log_output "Script arguments: $@"
    log_output "FQDN: $FQDN"
    log_output "Email: $EMAIL"
    log_output "Branch: $DEPLOYMENT_BRANCH"
    log_output "SSL Enabled: $USE_LETSENCRYPT"
    log_output "====================================="
}

# Main deployment function
deploy_instance() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] deploy_instance function started" >> "$DEBUG_LOG"
    
    log_message "=== SELF-HOSTING-INSTALL.SH DEPLOYMENT STARTED ==="
    log_message "Script version: $SCRIPT_VERSION"
    log_message "FQDN: $FQDN"
    log_message "Email: $EMAIL"
    log_message "SSL Enabled: $USE_LETSENCRYPT"
    
    print_banner
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Skipping early logging setup - will do after variables initialized" >> "$DEBUG_LOG"
    
    # Record deployment start time
    DEPLOYMENT_START_TIME=$(date +%s)
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] About to validate parameters" >> "$DEBUG_LOG"
    
    # Parameters are already validated in interactive_setup
    print_info "All parameters validated successfully"
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Parameter validation passed" >> "$DEBUG_LOG"
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Checking if instance already exists at /opt/$FQDN" >> "$DEBUG_LOG"
    
    # Check if instance already exists
    if [ -d "/opt/$FQDN" ]; then
        print_error "Instance for $FQDN already exists at /opt/$FQDN"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Instance already exists" >> "$DEBUG_LOG"
        exit 1
    fi
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Instance check passed - no existing instance found" >> "$DEBUG_LOG"
    
    print_info "🚀 Deploying PatchMon instance for $FQDN"
    print_info "📧 Email: $EMAIL"
    print_info "🌿 Branch: $DEPLOYMENT_BRANCH"
    print_info "🔒 SSL: $USE_LETSENCRYPT"
    if [ "$USE_LETSENCRYPT" = "true" ]; then
        print_info "📧 SSL Email: $EMAIL"
    fi
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] About to call init_instance_vars function" >> "$DEBUG_LOG"
    
    # Initialize variables
    init_instance_vars
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] init_instance_vars function completed" >> "$DEBUG_LOG"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Variables initialized, APP_DIR: $APP_DIR" >> "$DEBUG_LOG"
    
    # Setup logging (after variables are initialized)
    setup_deployment_logging
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Deployment logging setup completed" >> "$DEBUG_LOG"
    
    # Display generated credentials
    echo -e "${BLUE}🔐 Auto-generated credentials:${NC}"
    echo -e "${YELLOW}Database Name: $DB_NAME${NC}"
    echo -e "${YELLOW}Database User: $DB_USER${NC}"
    echo -e "${YELLOW}Database Password: $DB_PASS${NC}"
    echo -e "${YELLOW}Redis User: $REDIS_USER${NC}"
    echo -e "${YELLOW}Redis Password: $REDIS_PASSWORD${NC}"
    echo -e "${YELLOW}Redis Database: $REDIS_DB${NC}"
    echo -e "${YELLOW}JWT Secret: $JWT_SECRET${NC}"
    echo -e "${YELLOW}Backend Port: $BACKEND_PORT${NC}"
    echo -e "${YELLOW}Instance User: $INSTANCE_USER${NC}"
    echo -e "${YELLOW}Node.js Isolation: $APP_DIR/.npm${NC}"
    echo ""
    
    # System setup (prerequisites already installed in interactive_setup)
    install_nodejs
    install_postgresql
    install_redis
    configure_redis
    install_nginx
    
    # Only install certbot if SSL is enabled
    if [ "$USE_LETSENCRYPT" = "true" ]; then
        install_certbot
    fi
    
    # Instance-specific setup
    create_instance_user
    setup_nodejs_isolation
    setup_database
    clone_application
    setup_node_environment
    install_dependencies
    create_env_files
    run_migrations
    # Admin account creation removed - handled by application's first-time setup
    
    # Service and web server setup
    create_systemd_service
    setup_nginx
    
    # SSL setup (if enabled)
    if [ "$USE_LETSENCRYPT" = "true" ]; then
        setup_letsencrypt
    else
        print_info "SSL disabled - skipping SSL certificate setup"
    fi
    
    # Start services
    start_services
    
    # Populate server settings in database
    populate_server_settings
    
    # Create agent version in database
    create_agent_version
    
    # Restart PatchMon service to ensure it's running properly
    restart_patchmon
    
    # Save deployment information to file
    save_deployment_info
    
    # Create deployment summary
    create_deployment_summary
    
    # Email notifications removed for self-hosting deployment
    
    # Final status
    log_message "=== DEPLOYMENT COMPLETED SUCCESSFULLY ==="
    log_message "Instance URL: $SERVER_PROTOCOL_SEL://$FQDN"
    log_message "Service name: $SERVICE_NAME"
    log_message "Backend port: $BACKEND_PORT"
    log_message "SSL enabled: $USE_LETSENCRYPT"
    
    print_status "🎉 PatchMon instance deployed successfully!"
    echo ""
    print_info "Next steps:"
    echo "  • Visit your URL: $SERVER_PROTOCOL_SEL://$FQDN (ensure DNS is configured)"
    echo "  • Useful deployment information is stored in: $APP_DIR/deployment-info.txt"
    echo ""
    
    # Suppress JSON echo to terminal; details already logged and saved to summary/credentials files
    :
}

# Detect existing PatchMon installations
detect_installations() {
    local installations=()
    
    # Find all directories in /opt that contain PatchMon installations
    if [ -d "/opt" ]; then
        for dir in /opt/*/; do
            local dirname=$(basename "$dir")
            # Skip backup directories
            if [[ "$dirname" =~ \.backup\. ]]; then
                continue
            fi
            # Check if it's a PatchMon installation
            if [ -f "$dir/backend/package.json" ] && grep -q "patchmon" "$dir/backend/package.json" 2>/dev/null; then
                installations+=("$dirname")
            fi
        done
    fi
    
    echo "${installations[@]}"
}

# Select installation to update
select_installation_to_update() {
    local installations=($(detect_installations))
    
    if [ ${#installations[@]} -eq 0 ]; then
        print_error "No existing PatchMon installations found in /opt"
        exit 1
    fi
    
    print_info "Found ${#installations[@]} existing installation(s):"
    echo ""
    
    local i=1
    declare -A install_map
    for install in "${installations[@]}"; do
        # Get current version if possible
        local version="unknown"
        if [ -f "/opt/$install/backend/package.json" ]; then
            version=$(grep '"version"' "/opt/$install/backend/package.json" | head -1 | sed 's/.*"version": "\([^"]*\)".*/\1/')
        fi
        
        # Get service status - try multiple naming conventions
        # Convention 1: Just the install name (e.g., patchmon.internal)
        local service_name="$install"
        # Convention 2: patchmon. prefix (e.g., patchmon.patchmon.internal)
        local alt_service_name1="patchmon.$install"
        # Convention 3: patchmon- prefix with underscores (e.g., patchmon-patchmon_internal)
        local alt_service_name2="patchmon-$(echo "$install" | tr '.' '_')"
        local status="unknown"
        
        # Try convention 1 first (most common)
        if systemctl is-active --quiet "$service_name" 2>/dev/null; then
            status="running"
        elif systemctl is-enabled --quiet "$service_name" 2>/dev/null; then
            status="stopped"
        # Try convention 2
        elif systemctl is-active --quiet "$alt_service_name1" 2>/dev/null; then
            status="running"
            service_name="$alt_service_name1"
        elif systemctl is-enabled --quiet "$alt_service_name1" 2>/dev/null; then
            status="stopped"
            service_name="$alt_service_name1"
        # Try convention 3
        elif systemctl is-active --quiet "$alt_service_name2" 2>/dev/null; then
            status="running"
            service_name="$alt_service_name2"
        elif systemctl is-enabled --quiet "$alt_service_name2" 2>/dev/null; then
            status="stopped"
            service_name="$alt_service_name2"
        fi
        
        printf "%2d. %-30s (v%-10s - %s)\n" "$i" "$install" "$version" "$status"
        install_map[$i]="$install"
        # Store the service name for later use
        declare -g "service_map_$i=$service_name"
        i=$((i + 1))
    done
    
    echo ""
    
    while true; do
        read_input "Select installation number to update" SELECTION "1"
        
        if [[ "$SELECTION" =~ ^[0-9]+$ ]] && [ -n "${install_map[$SELECTION]}" ]; then
            SELECTED_INSTANCE="${install_map[$SELECTION]}"
            # Get the stored service name
            local varname="service_map_$SELECTION"
            SELECTED_SERVICE_NAME="${!varname}"
            print_status "Selected: $SELECTED_INSTANCE"
            print_info "Service: $SELECTED_SERVICE_NAME"
            return 0
        else
            print_error "Invalid selection. Please enter a number from 1 to ${#installations[@]}"
        fi
    done
}

# Update existing installation
update_installation() {
    local instance_dir="/opt/$SELECTED_INSTANCE"
    local service_name="$SELECTED_SERVICE_NAME"
    
    print_info "Updating PatchMon installation: $SELECTED_INSTANCE"
    print_info "Installation directory: $instance_dir"
    print_info "Service name: $service_name"
    
    # Verify it's a git repository
    if [ ! -d "$instance_dir/.git" ]; then
        print_error "Installation directory is not a git repository"
        print_error "Cannot perform git-based update"
        exit 1
    fi
    
    # Add git safe.directory to avoid ownership issues when running as root
    print_info "Configuring git safe.directory..."
    git config --global --add safe.directory "$instance_dir" 2>/dev/null || true
    
    # Load existing .env to get database credentials
    if [ -f "$instance_dir/backend/.env" ]; then
        source "$instance_dir/backend/.env"
        print_status "Loaded existing configuration"
        
        # Parse DATABASE_URL to extract credentials
        # Format: postgresql://user:password@host:port/database
        if [ -n "$DATABASE_URL" ]; then
            # Extract components using regex
            DB_USER=$(echo "$DATABASE_URL" | sed -n 's|postgresql://\([^:]*\):.*|\1|p')
            DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|postgresql://[^:]*:\([^@]*\)@.*|\1|p')
            DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
            DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
            DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
            
            print_info "Database: $DB_NAME (user: $DB_USER)"
        else
            print_error "DATABASE_URL not found in .env file"
            exit 1
        fi
    else
        print_error "Cannot find .env file at $instance_dir/backend/.env"
        exit 1
    fi
    
    # Select branch/version to update to
    select_branch
    
    print_info "Updating to: $DEPLOYMENT_BRANCH"
    echo ""
    
    read_yes_no "Proceed with update? This will pull new code and restart services" CONFIRM_UPDATE "y"
    
    if [ "$CONFIRM_UPDATE" != "y" ]; then
        print_warning "Update cancelled by user"
        exit 0
    fi
    
    # Stop the service
    print_info "Stopping service: $service_name"
    systemctl stop "$service_name" || true
    
    # Create backup directory
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_dir="$instance_dir.backup.$timestamp"
    local db_backup_file="$backup_dir/database_backup_$timestamp.sql"
    
    print_info "Creating backup directory: $backup_dir"
    mkdir -p "$backup_dir"
    
    # Backup database
    print_info "Backing up database: $DB_NAME"
    if PGPASSWORD="$DB_PASS" pg_dump -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -F c -f "$db_backup_file" 2>/dev/null; then
        print_status "Database backup created: $db_backup_file"
    else
        print_warning "Database backup failed, but continuing with code backup"
    fi
    
    # Backup code
    print_info "Backing up code files..."
    cp -r "$instance_dir" "$backup_dir/code"
    print_status "Code backup created"
    
    # Update code
    print_info "Pulling latest code from branch: $DEPLOYMENT_BRANCH"
    cd "$instance_dir"
    
    # Clean up any untracked files that might conflict with incoming changes
    print_info "Cleaning up untracked files to prevent merge conflicts..."
    git clean -fd
    
    # Reset any local changes to ensure clean state
    print_info "Resetting local changes to ensure clean state..."
    git reset --hard HEAD
    
    # Fetch latest changes
    git fetch origin
    
    # Checkout the selected branch/tag
    git checkout "$DEPLOYMENT_BRANCH"
    git pull origin "$DEPLOYMENT_BRANCH" || git pull # For tags, just pull
    
    print_status "Code updated successfully"
    
    # Update dependencies
    print_info "Updating backend dependencies..."
    cd "$instance_dir/backend"
    npm install --production --ignore-scripts
    
    print_info "Updating frontend dependencies..."
    cd "$instance_dir/frontend"
    npm install --ignore-scripts
    
    # Build frontend
    print_info "Building frontend..."
    npm run build
    
    # Run database migrations and generate Prisma client
    print_info "Running database migrations..."
    cd "$instance_dir/backend"
    npx prisma generate
    npx prisma migrate deploy
    
    # Start the service
    print_info "Starting service: $service_name"
    systemctl start "$service_name"
    
    # Wait a moment and check status
    sleep 3
    
    if systemctl is-active --quiet "$service_name"; then
        print_success "✅ Update completed successfully!"
        print_status "Service $service_name is running"
        
        # Get new version
        local new_version=$(grep '"version"' "$instance_dir/backend/package.json" | head -1 | sed 's/.*"version": "\([^"]*\)".*/\1/')
        print_info "Updated to version: $new_version"
        echo ""
        print_info "Backup Information:"
        print_info "  Code backup: $backup_dir/code"
        print_info "  Database backup: $db_backup_file"
        echo ""
        print_info "To restore database if needed:"
        print_info "  PGPASSWORD=\"$DB_PASS\" pg_restore -h \"$DB_HOST\" -U \"$DB_USER\" -d \"$DB_NAME\" -c \"$db_backup_file\""
        echo ""
    else
        print_error "Service failed to start after update"
        echo ""
        print_warning "ROLLBACK INSTRUCTIONS:"
        print_info "1. Restore code:"
        print_info "   sudo rm -rf $instance_dir"
        print_info "   sudo mv $backup_dir/code $instance_dir"
        echo ""
        print_info "2. Restore database:"
        print_info "   PGPASSWORD=\"$DB_PASS\" pg_restore -h \"$DB_HOST\" -U \"$DB_USER\" -d \"$DB_NAME\" -c \"$db_backup_file\""
        echo ""
        print_info "3. Restart service:"
        print_info "   sudo systemctl start $service_name"
        echo ""
        print_info "Check logs: journalctl -u $service_name -f"
        exit 1
    fi
}

# Main script execution
main() {
    # Parse command-line arguments
    if [ "$1" = "--update" ]; then
        UPDATE_MODE="true"
    fi
    
    # Log script entry
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Script started - Update mode: $UPDATE_MODE" >> "$DEBUG_LOG"
    
    # Handle update mode
    if [ "$UPDATE_MODE" = "true" ]; then
        print_banner
        print_info "🔄 PatchMon Update Mode"
        echo ""
        
        # Select installation to update
        select_installation_to_update
        
        # Perform update
        update_installation
        
        exit 0
    fi
    
    # Normal installation mode
    # Run interactive setup
    interactive_setup
    
    # Set GitHub repo (always use public repo for self-hosted deployments)
    GITHUB_REPO="$DEFAULT_GITHUB_REPO"
    
    # Validate SSL setting
    if [ "$SSL_ENABLED" = "y" ] || [ "$SSL_ENABLED" = "yes" ]; then
        USE_LETSENCRYPT="true"
        SERVER_PROTOCOL_SEL="https"
        print_info "SSL enabled - will use Let's Encrypt for HTTPS"
        
        # Validate email for SSL
        if [ -z "$EMAIL" ]; then
            print_error "Email is required when SSL is enabled for Let's Encrypt"
            exit 1
        fi
    else
        USE_LETSENCRYPT="false"
        SERVER_PROTOCOL_SEL="http"
        print_info "SSL disabled - will use HTTP only"
    fi
    
    # Log before calling deploy_instance
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] About to call deploy_instance function" >> "$DEBUG_LOG"
    
    # Run deployment
    deploy_instance
    
    # Log after deploy_instance completes
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] deploy_instance function completed" >> "$DEBUG_LOG"
}

# Show usage/help
show_usage() {
    echo "PatchMon Self-Hosting Installation & Update Script"
    echo "Version: $SCRIPT_VERSION"
    echo ""
    echo "Usage:"
    echo "  $0              # Interactive installation (default)"
    echo "  $0 --update     # Update existing installation"
    echo "  $0 --help       # Show this help message"
    echo ""
    echo "Examples:"
    echo "  # New installation:"
    echo "  sudo bash $0"
    echo ""
    echo "  # Update existing installation:"
    echo "  sudo bash $0 --update"
    echo ""
}

# Check for help flag
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    show_usage
    exit 0
fi

# Run main function
main "$@"
