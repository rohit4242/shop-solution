"""Start the two local Logistics demo servers."""
import argparse
import os
import secrets
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
API = ROOT / "src/features/logistics/api"

def free(port):
    with socket.socket() as s:
        return s.connect_ex(("127.0.0.1", port)) != 0

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--production", action="store_true")
    parser.add_argument("--web-port", type=int, default=3000)
    parser.add_argument("--api-port", type=int, default=8000)
    args = parser.parse_args()
    ports = (args.web_port, args.api_port)
    if args.web_port == args.api_port or any(not 1 <= port <= 65535 for port in ports):
        parser.error("Choose two distinct ports between 1 and 65535.")
    if not all(free(port) for port in ports):
        parser.error(f"Ports {args.web_port} and {args.api_port} must be free.")
    if not (ROOT / "node_modules/next/dist/bin/next").exists():
        raise SystemExit("Run pnpm install --frozen-lockfile first.")
    web_url = f"http://127.0.0.1:{args.web_port}"
    env = dict(
        os.environ,
        LOGISTICS_DEMO="1",
        LOGISTICS_DEMO_PASSWORD="logistics-demo",
        LOGISTICS_DEMO_TOKEN=secrets.token_urlsafe(32),
        LOGISTICS_API_TOKEN=secrets.token_urlsafe(32),
        LOGISTICS_API_URL=f"http://127.0.0.1:{args.api_port}",
        NEXT_TELEMETRY_DISABLED="1",
        BETTER_AUTH_URL=web_url,
        BETTER_AUTH_SECRET=secrets.token_urlsafe(48),
    )
    processes = []
    def stop(*_):
        for p in reversed(processes):
            p.terminate()
        for p in reversed(processes):
            try: p.wait(timeout=5)
            except subprocess.TimeoutExpired: p.kill()
    signal.signal(signal.SIGINT, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
    try:
        api_command = [
            sys.executable, "-m", "uvicorn", "demo_api:app", "--host",
            "127.0.0.1", "--port", str(args.api_port),
        ]
        processes.append(subprocess.Popen(api_command, cwd=API, env=env))
        mode = "start" if args.production else "dev"
        next_command = [
            "node", str(ROOT / "node_modules/next/dist/bin/next"), mode,
            "--hostname", "127.0.0.1", "--port", str(args.web_port),
        ]
        if mode == "dev" and sys.platform == "win32":
            next_command.append("--webpack")
        processes.append(subprocess.Popen(next_command, cwd=ROOT, env=env))
        print(
            f"\nOpen {web_url}/logistics\n"
            "Demo: staff@logistics.demo / logistics-demo\n"
            "Ctrl+C stops both servers. In-memory shipments reset on restart.\n",
            flush=True,
        )
        while all(p.poll() is None for p in processes):
            time.sleep(0.25)
        raise SystemExit("A server stopped; inspect the messages above.")
    except KeyboardInterrupt:
        pass
    finally:
        stop()
if __name__ == "__main__":
    main()
