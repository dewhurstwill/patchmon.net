#!/bin/sh

# Enable strict error handling
set -e

# Function to log messages with timestamp
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" >&2
}

# Function to extract version from agent script
get_agent_version() {
    local file="$1"
    if [ -f "$file" ]; then
        grep -m 1 '^AGENT_VERSION=' "$file" | cut -d'"' -f2 2>/dev/null || echo "0.0.0"
    else
        echo "0.0.0"
    fi
}

# Function to compare versions (returns 0 if $1 > $2)
version_greater() {
    # Use sort -V for version comparison
    test "$(printf '%s\n' "$1" "$2" | sort -V | tail -n1)" = "$1" && test "$1" != "$2"
}

# Check and update agent files if necessary
update_agents() {
    local backup_agent="/app/agents_backup/patchmon-agent.sh"
    local current_agent="/app/agents/patchmon-agent.sh"
    
    # Check if agents directory exists
    if [ ! -d "/app/agents" ]; then
        log "ERROR: /app/agents directory not found"
        return 1
    fi
    
    # Check if backup exists
    if [ ! -d "/app/agents_backup" ]; then
        log "WARNING: agents_backup directory not found, skipping agent update"
        return 0
    fi
    
    # Get versions
    local backup_version=$(get_agent_version "$backup_agent")
    local current_version=$(get_agent_version "$current_agent")
    
    log "Agent version check:"
    log "  Image version: ${backup_version}"
    log "  Volume version: ${current_version}"
    
    # Determine if update is needed
    local needs_update=0
    
    # Case 1: No agents in volume (first time setup)
    if [ -z "$(find /app/agents -maxdepth 1 -type f -name '*.sh' 2>/dev/null | head -n 1)" ]; then
        log "Agents directory is empty - performing initial copy"
        needs_update=1
    # Case 2: Backup version is newer
    elif version_greater "$backup_version" "$current_version"; then
        log "Newer agent version available (${backup_version} > ${current_version})"
        needs_update=1
    else
        log "Agents are up to date"
        needs_update=0
    fi
    
    # Perform update if needed
    if [ $needs_update -eq 1 ]; then
        log "Updating agents to version ${backup_version}..."
        
        # Create backup of existing agents if they exist
        if [ -f "$current_agent" ]; then
            local backup_timestamp=$(date +%Y%m%d_%H%M%S)
            local backup_name="/app/agents/patchmon-agent.sh.backup.${backup_timestamp}"
            cp "$current_agent" "$backup_name" 2>/dev/null || true
            log "Previous agent backed up to: $(basename $backup_name)"
        fi
        
        # Copy new agents
        cp -r /app/agents_backup/* /app/agents/
        
        # Verify update
        local new_version=$(get_agent_version "$current_agent")
        if [ "$new_version" = "$backup_version" ]; then
            log "✅ Agents successfully updated to version ${new_version}"
        else
            log "⚠️ Warning: Agent update may have failed (expected: ${backup_version}, got: ${new_version})"
        fi
    fi
}

# Main execution
log "PatchMon Backend Container Starting..."
log "Environment: ${NODE_ENV:-production}"

# Update agents (version-aware)
update_agents

log "Running database migrations..."
npx prisma migrate deploy

log "Starting application..."
if [ "${NODE_ENV}" = "development" ]; then
    exec npm run dev
else
    exec npm start
fi
