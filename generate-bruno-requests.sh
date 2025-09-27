#!/bin/bash

# Script to generate Bruno request files from frontend-supabase-api-calls.md
# This script parses the markdown file and creates .bru files for each API call

# Set the base directory
BASE_DIR="/Users/justin.loveless/Code/justinloveless"
BRUNO_DIR="$BASE_DIR/bruno/Supabase Requests/generated"
MARKDOWN_FILE="$BASE_DIR/documentation/frontend-supabase-api-calls.md"

# Create the generated directory if it doesn't exist
mkdir -p "$BRUNO_DIR"

# Function to sanitize filename
sanitize_filename() {
    echo "$1" | sed 's/[^a-zA-Z0-9._-]/_/g' | sed 's/__*/_/g' | sed 's/^_\|_$//g' | sed 's/^_*//g' | sed 's/_*$//g'
}

# Function to format JSON body with proper quoting
format_json_body() {
    local body="$1"
    # Remove backticks first
    body=$(echo "$body" | sed 's/`//g')
    
    # Handle optional properties (property?: -> "property":)
    body=$(echo "$body" | sed 's/\([a-zA-Z_][a-zA-Z0-9_]*\)?:/"\1":/g')
    
    # Handle ALL remaining regular properties (property: -> "property":)
    body=$(echo "$body" | sed 's/\([a-zA-Z_][a-zA-Z0-9_]*\):/"\1":/g')
    
    # Quote simple string values (: string -> : "string")
    body=$(echo "$body" | sed 's/: \([a-zA-Z_][a-zA-Z0-9_]*\)/: "\1"/g')
    
    echo "$body"
}

# Function to generate Bruno request file
generate_bruno_file() {
    local number="$1"
    local name="$2"
    local method="$3"
    local url="$4"
    local headers="$5"
    local query_params="$6"
    local body="$7"
    local description="$8"
    
    # Determine folder structure based on current section and subsection
    local folder_path="$BRUNO_DIR"
    
    if [ -n "$current_section" ]; then
        local section_folder=$(sanitize_filename "$current_section")
        folder_path="$folder_path/$section_folder"
        mkdir -p "$folder_path"
        
        # Create folder.bru for the section
        if [ ! -f "$folder_path/folder.bru" ]; then
            cat > "$folder_path/folder.bru" << EOF
meta {
  name: $current_section
  seq: 1
}
EOF
        fi
    fi
    
    if [ -n "$current_subsection" ]; then
        local subsection_folder=$(sanitize_filename "$current_subsection")
        folder_path="$folder_path/$subsection_folder"
        mkdir -p "$folder_path"
        
        # Create folder.bru for the subsection
        if [ ! -f "$folder_path/folder.bru" ]; then
            cat > "$folder_path/folder.bru" << EOF
meta {
  name: $current_subsection
  seq: 1
}
EOF
        fi
    fi
    
    local filename=$(sanitize_filename "${number}_${name}")
    local filepath="$folder_path/${filename}.bru"
    
    echo "Generating: $filepath"
    
    cat > "$filepath" << EOF
meta {
  name: ${number}. ${name}
  type: http
  seq: ${number}
}

$(echo "$method" | tr '[:upper:]' '[:lower:]') {
  url: $(echo "$url" | sed 's/`//g')
EOF

    # Add body if present
    if [ -n "$body" ] && [ "$body" != "null" ]; then
        echo "  body: json" >> "$filepath"
        echo "  auth: inherit" >> "$filepath"
    else
        echo "  body: none" >> "$filepath"
        echo "  auth: inherit" >> "$filepath"
    fi
    echo "}" >> "$filepath"
    
    # Add query params if present
    if [ -n "$query_params" ] && [ "$query_params" != "null" ]; then
        echo "" >> "$filepath"
        echo "params:query {" >> "$filepath"
        echo "$query_params" | sed 's/`//g' | sed 's/, /\n  /g' | sed 's/^/  /' >> "$filepath"
        echo "}" >> "$filepath"
    fi
    
    # Add body content if present
    if [ -n "$body" ] && [ "$body" != "null" ]; then
        echo "" >> "$filepath"
        echo "body:json {" >> "$filepath"
        format_json_body "$body" >> "$filepath"
        echo "}" >> "$filepath"
    fi
    
    # Add headers if present
    if [ -n "$headers" ] && [ "$headers" != "null" ]; then
        echo "" >> "$filepath"
        echo "headers {" >> "$filepath"
        # Format headers and replace placeholders with Bruno environment variables
        echo "$headers" | sed 's/`//g' | sed 's/, /\n  /g' | sed 's/^/  /' | \
        sed 's/Bearer <access_token>/Bearer {{accessToken}}/g' | \
        sed 's/apikey: <anon_key>/apikey: {{supabaseAnonKey}}/g' >> "$filepath"
        echo "}" >> "$filepath"
    fi
    
    # Add description as comment (commented out to avoid Bruno parsing issues)
    # if [ -n "$description" ] && [ "$description" != "null" ]; then
    #     echo "" >> "$filepath"
    #     echo "// $description" >> "$filepath"
    # fi
}

# Global variables for section tracking
current_section=""
current_subsection=""

# Parse the markdown file and extract API calls
parse_markdown() {
    local current_number=""
    local current_name=""
    local current_method=""
    local current_url=""
    local current_headers=""
    local current_query_params=""
    local current_body=""
    local current_description=""
    
    while IFS= read -r line; do
        # Check for main section headers (##)
        if [[ $line =~ ^##\ [^#] ]]; then
            current_section=$(echo "$line" | sed 's/^## //')
            current_subsection=""
            echo "Processing section: $current_section"
        fi
        
        # Check for subsection headers (### without numbers)
        if [[ $line =~ ^###\ [^#] ]] && [[ ! $line =~ ^###\ [0-9]+\. ]]; then
            current_subsection=$(echo "$line" | sed 's/^### //')
            echo "Processing subsection: $current_subsection"
        fi
        
        # Check for API call headers (both ### and #### with numbers)
        if [[ $line =~ ^#{3,4}\ [0-9]+\. ]]; then
            # Save previous request if we have one
            if [ -n "$current_number" ] && [ -n "$current_name" ]; then
                generate_bruno_file "$current_number" "$current_name" "$current_method" "$current_url" "$current_headers" "$current_query_params" "$current_body" "$current_description"
            fi
            
            # Extract number and name (handle both ### and ####)
            current_number=$(echo "$line" | sed 's/^#\{3,4\} \([0-9]*\)\. \(.*\)$/\1/')
            current_name=$(echo "$line" | sed 's/^#\{3,4\} \([0-9]*\)\. \(.*\)$/\2/')
            current_method=""
            current_url=""
            current_headers=""
            current_query_params=""
            current_body=""
            current_description=""
        fi
        
        # Check for HTTP Method
        if echo "$line" | grep -q "^- \*\*HTTP Method\*\*:"; then
            current_method=$(echo "$line" | sed 's/^- \*\*HTTP Method\*\*: //')
        fi
        
        # Check for REST URL
        if echo "$line" | grep -q "^- \*\*REST URL\*\*:"; then
            current_url=$(echo "$line" | sed 's/^- \*\*REST URL\*\*: //')
        fi
        
        # Check for Headers
        if echo "$line" | grep -q "^- \*\*Headers\*\*:"; then
            current_headers=$(echo "$line" | sed 's/^- \*\*Headers\*\*: //')
        fi
        
        # Check for Query Params
        if echo "$line" | grep -q "^- \*\*Query Params\*\*:"; then
            current_query_params=$(echo "$line" | sed 's/^- \*\*Query Params\*\*: //')
        fi
        
        # Check for Body
        if echo "$line" | grep -q "^- \*\*Body\*\*:"; then
            current_body=$(echo "$line" | sed 's/^- \*\*Body\*\*: //')
        fi
        
        # Check for Description
        if echo "$line" | grep -q "^- \*\*Description\*\*:"; then
            current_description=$(echo "$line" | sed 's/^- \*\*Description\*\*: //')
        fi
        
    done < "$MARKDOWN_FILE"
    
    # Don't forget the last request
    if [ -n "$current_number" ] && [ -n "$current_name" ]; then
        generate_bruno_file "$current_number" "$current_name" "$current_method" "$current_url" "$current_headers" "$current_query_params" "$current_body" "$current_description"
    fi
}

# Create a folder.bru file for the generated folder
create_folder_bru() {
    cat > "$BRUNO_DIR/folder.bru" << EOF
meta {
  name: Generated API Calls
  seq: 1
}
EOF
}

# Main execution
echo "Starting Bruno request generation..."
echo "Source: $MARKDOWN_FILE"
echo "Destination: $BRUNO_DIR"

# Create folder.bru
create_folder_bru

# Parse and generate files
parse_markdown

echo "Generation complete!"
echo "Generated files in: $BRUNO_DIR"
echo "Total files created: $(ls -1 "$BRUNO_DIR"/*.bru 2>/dev/null | wc -l)"
