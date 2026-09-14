import os
import re
import sys
import json
import time
import requests

def download_file(url, destination):
    if os.path.exists(destination) and os.path.getsize(destination) > 0:
        print(f"Already exists ({os.path.getsize(destination)} bytes): {destination}")
        return True

    os.makedirs(os.path.dirname(destination), exist_ok=True)
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })

    # Extract file ID
    file_id_match = re.search(r'id=([a-zA-Z0-9_-]+)', url)
    if not file_id_match:
        print(f"Could not extract ID from {url}")
        return False
    file_id = file_id_match.group(1)

    dl_url = f"https://drive.google.com/uc?id={file_id}&export=download"

    try:
        response = session.get(dl_url, stream=True, timeout=30)
        
        # Check if Google Drive asks for confirmation (large file)
        confirm_token = None
        for key, value in response.cookies.items():
            if key.startswith('download_warning'):
                confirm_token = value
                break
        
        if not confirm_token:
            # Check content for confirm code if html
            content_type = response.headers.get('content-type', '')
            if 'html' in content_type:
                html_text = response.text
                match = re.search(r'confirm=([0-9A-Za-z_]+)', html_text)
                if match:
                    confirm_token = match.group(1)
                else:
                    match2 = re.search(r'name="confirm"\s+value="([^"]+)"', html_text)
                    if match2:
                        confirm_token = match2.group(1)
                    else:
                        match3 = re.search(r'id="download-form"\s+action="([^"]+)"', html_text)
                        if match3:
                            dl_url = match3.group(1)

        if confirm_token:
            response = session.get(f"{dl_url}&confirm={confirm_token}", stream=True, timeout=30)

        response.raise_for_status()

        total_size = int(response.headers.get('content-length', 0))
        temp_dest = destination + ".part"
        downloaded = 0

        with open(temp_dest, 'wb') as f:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)

        if os.path.exists(temp_dest):
            os.replace(temp_dest, destination)
            print(f"Downloaded ({downloaded} bytes): {destination}")
            return True
        return False

    except Exception as e:
        print(f"Error downloading {destination}: {e}")
        return False

def main():
    log_file = r"C:\Users\Gaming Krew\.gemini\antigravity\brain\e8ffbc79-bfaa-450b-a1ae-103caee8005b\.system_generated\tasks\task-14.log"
    with open(log_file, "r", encoding="utf-8") as f:
        text = f.read()

    start = text.find('[')
    end = text.rfind(']') + 1
    items = json.loads(text[start:end])

    target_dir = os.path.abspath("Design_Files")
    print(f"Total files to process: {len(items)}")

    failed = []
    for i, item in enumerate(items, 1):
        rel_path = item["path"]
        dest = os.path.join(target_dir, rel_path)
        print(f"[{i}/{len(items)}] Checking {rel_path}...")
        success = download_file(item["url"], dest)
        if not success:
            failed.append((rel_path, item["url"]))
        time.sleep(0.5)

    if failed:
        print("\n--- Failed Downloads ---")
        for rel_path, url in failed:
            print(f"Failed: {rel_path} ({url})")
    else:
        print("\nAll files downloaded successfully!")

if __name__ == "__main__":
    main()
