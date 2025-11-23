import os
import shutil
import requests
from pathlib import Path
from zipfile import ZipFile

def download_file(url, dest):
    response = requests.get(url)
    response.raise_for_status()  # Ensure we notice bad responses
    with open(dest, 'wb') as file:
        file.write(response.content)

def main():
    # Determine the scripts directory based on the operating system
    SCRIPT_DIR = Path(__file__).parent.resolve()

    # Change to the script's directory (not necessary if using absolute paths with Path)
    # os.chdir(SCRIPT_DIR)  # Optional: change the current working directory

    # Remove old files
    for file in SCRIPT_DIR.glob('eurofxref*'):
        try:
            if file.is_file():
                file.unlink()
        except Exception as e:
            print(f"Error removing file {file}: {e}")

    # Download the new file
    url = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref.zip'
    zip_path = SCRIPT_DIR / 'eurofxref.zip'

    try:
        download_file(url, zip_path)
    except Exception as e:
        print(f"Error downloading the file: {e}")
        return

    # Unzip and clean up
    try:
        with ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(SCRIPT_DIR)
        zip_path.unlink()  # Remove the zip file
    except Exception as e:
        print(f"Error unzipping the file: {e}")

if __name__ == "__main__":
    main()
