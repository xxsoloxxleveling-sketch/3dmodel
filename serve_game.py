import http.server
import socketserver
import os
import socket
import webbrowser
import sys

# Ensure UTF-8 output on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def guess_type(self, path):
        if path.endswith('.glb'):
            return 'model/gltf-binary'
        if path.endswith('.gltf'):
            return 'model/gltf+json'
        if path.endswith('.js'):
            return 'application/javascript'
        if path.endswith('.css'):
            return 'text/css'
        return super().guess_type(path)

    def end_headers(self):
        # Enable CORS and caching headers for high performance
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, format, *args):
        # Suppress verbose terminal request logging for a clean console
        pass

def get_lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

def main():
    lan_ip = get_lan_ip()
    local_url = f"http://localhost:{PORT}"
    network_url = f"http://{lan_ip}:{PORT}"

    print("=" * 70)
    print("STARTER FARMHOUSE 3D - PLAYABLE WALKTHROUGH SERVER")
    print("=" * 70)
    print(f"\n>> Play on PC / Mac (Local Browser):")
    print(f"   {local_url}\n")
    print(f">> Play on Android / Mobile Phone (Same Wi-Fi Network):")
    print(f"   {network_url}\n")
    print("Press Ctrl+C to stop the server.")
    print("=" * 70)

    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(("", PORT), CustomHTTPRequestHandler) as httpd:
            if "--no-browser" not in sys.argv:
                try:
                    webbrowser.open(local_url)
                except Exception:
                    pass
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")

if __name__ == "__main__":
    main()
