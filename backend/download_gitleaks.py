import os
import sys
import json
import urllib.request
import zipfile
import tarfile
import io

def setup_gitleaks():
    version = "8.18.2"
    is_windows = sys.platform == "win32"
    
    # Determine the release asset URL based on target platform
    if is_windows:
        asset_name = f"gitleaks_{version}_windows_x64.zip"
    else:
        asset_name = f"gitleaks_{version}_linux_x64.tar.gz"
        
    download_url = f"https://github.com/gitleaks/gitleaks/releases/download/v{version}/{asset_name}"
    
    target_dir = os.path.join(os.path.dirname(__file__), "tools")
    os.makedirs(target_dir, exist_ok=True)
    
    dest_name = "gitleaks.exe" if is_windows else "gitleaks"
    dest_path = os.path.join(target_dir, dest_name)
    
    print(f"Downloading Gitleaks binary from: {download_url}")
    
    req = urllib.request.Request(
        download_url,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            content = response.read()
            
        print("Extracting archive...")
        if is_windows:
            with zipfile.ZipFile(io.BytesIO(content)) as zip_ref:
                for filename in zip_ref.namelist():
                    if filename == "gitleaks.exe" or filename.endswith("/gitleaks.exe"):
                        with open(dest_path, "wb") as f:
                            f.write(zip_ref.read(filename))
                        print(f"Successfully installed Gitleaks binary to: {dest_path}")
                        return
        else:
            with tarfile.open(fileobj=io.BytesIO(content), mode="r:gz") as tar_ref:
                for member in tar_ref.getmembers():
                    if member.name == "gitleaks":
                        f = tar_ref.extractfile(member)
                        if f:
                            with open(dest_path, "wb") as out_f:
                                out_f.write(f.read())
                            
                            try:
                                os.chmod(dest_path, 0o755)
                            except Exception:
                                pass
                                
                            print(f"Successfully installed Gitleaks binary to: {dest_path}")
                            return
                            
        print("Could not find gitleaks binary inside the archive.")
        sys.exit(1)
    except Exception as e:
        print(f"Error downloading or extracting Gitleaks: {e}")
        sys.exit(1)

if __name__ == "__main__":
    setup_gitleaks()
