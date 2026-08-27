import os
import sys
import json
import urllib.request
import zipfile
import io

def setup_nuclei():
    # 1. Fetch latest release info from GitHub API
    api_url = "https://api.github.com/repos/projectdiscovery/nuclei/releases/latest"
    print(f"Fetching latest Nuclei release metadata from: {api_url}")
    
    req = urllib.request.Request(
        api_url, 
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            metadata = json.loads(response.read().decode())
    except Exception as e:
        print(f"Error fetching metadata: {e}")
        sys.exit(1)
        
    # 2. Search for the linux_amd64.zip asset
    download_url = None
    version_tag = metadata.get("tag_name", "unknown")
    print(f"Found latest release tag: {version_tag}")
    
    for asset in metadata.get("assets", []):
        name = asset.get("name", "")
        if name.endswith("linux_amd64.zip"):
            download_url = asset.get("browser_download_url")
            break
            
    if not download_url:
        print("Could not find a linux_amd64.zip asset in the latest release.")
        sys.exit(1)
        
    # 3. Create target directory
    target_dir = os.path.join(os.path.dirname(__file__), "tools")
    os.makedirs(target_dir, exist_ok=True)
    dest_path = os.path.join(target_dir, "nuclei")
    
    # 4. Download and extract
    print(f"Downloading Nuclei binary from: {download_url}")
    download_req = urllib.request.Request(
        download_url,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    )
    
    try:
        with urllib.request.urlopen(download_req) as response:
            zip_content = response.read()
            
        print("Extracting zip archive...")
        with zipfile.ZipFile(io.BytesIO(zip_content)) as zip_ref:
            # Locate the nuclei executable inside zip
            for filename in zip_ref.namelist():
                if filename == "nuclei" or filename.endswith("/nuclei"):
                    with open(dest_path, "wb") as f:
                        f.write(zip_ref.read(filename))
                    
                    # Try making it executable (Linux/macOS)
                    try:
                        os.chmod(dest_path, 0o755)
                    except Exception:
                        pass
                        
                    print(f"Successfully installed Nuclei binary to: {dest_path}")
                    return
        print("Could not find 'nuclei' executable inside the downloaded zip.")
        sys.exit(1)
    except Exception as e:
        print(f"Error downloading or extracting: {e}")
        sys.exit(1)

if __name__ == "__main__":
    setup_nuclei()
