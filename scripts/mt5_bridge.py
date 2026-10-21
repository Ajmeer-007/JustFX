"""
MetaTrader 5 Read-Only History Bridge Companion for JustFX.

This script runs locally on the user's Windows PC alongside MetaTrader 5.
It reads closed trade history in READ-ONLY mode and securely syncs with the
local JustFX Dashboard API.

STRICT SAFETY RULES:
- Read-only access: NO order placement, modification, or position closure.
- Zero account modification permissions.
- Transmits data only to local JustFX endpoint (http://localhost:3000/api/mt5/sync).
"""

import sys
import os
import json
from datetime import datetime, timedelta
import urllib.request
import urllib.error

API_URL = os.environ.get("JUSTFX_API_URL", "http://localhost:3000/api/mt5/sync")
BRIDGE_TOKEN = os.environ.get("MT5_BRIDGE_TOKEN", "justfx_local_mt5_bridge_token_dev")

def sync_mt5():
    try:
        import MetaTrader5 as mt5
    except ImportError:
        print("[!] MetaTrader5 Python package is not installed.")
        print("[i] To enable direct desktop MT5 sync, run: pip install MetaTrader5")
        print("[i] Alternatively, you can directly upload your MT5 CSV statement in the dashboard.")
        return False

    print("[*] Initializing connection to local MetaTrader 5 terminal (Read-Only)...")
    if not mt5.initialize():
        print(f"[x] MT5 initialization failed: {mt5.last_error()}")
        print("[i] Ensure MetaTrader 5 terminal is installed and open on this computer.")
        return False

    account_info = mt5.account_info()
    if account_info is None:
        print("[x] Failed to get MT5 account info.")
        mt5.shutdown()
        return False

    print(f"[+] Connected to MT5 Account: {account_info.login} (Server: {account_info.server})")

    # Fetch closed deals for the last 90 days
    from_date = datetime.now() - timedelta(days=90)
    to_date = datetime.now()

    deals = mt5.history_deals_get(from_date, to_date)
    if deals is None or len(deals) == 0:
        print("[i] No closed deals found in the specified range.")
        mt5.shutdown()
        return True

    print(f"[*] Found {len(deals)} history deals. Formatting data...")
    payload_deals = []

    for d in deals:
        # Filter entry OUT (closing deals or completed trades)
        if d.entry == 1 or d.profit != 0:
            payload_deals.append({
                "ticket": str(d.ticket),
                "symbol": d.symbol,
                "tradeType": "BUY" if d.type == 0 else "SELL",
                "volume": d.volume,
                "openTime": datetime.fromtimestamp(d.time).isoformat(),
                "openPrice": d.price,
                "profit": d.profit,
                "commission": d.commission,
                "swap": d.swap
            })

    mt5.shutdown()

    print(f"[*] Sending {len(payload_deals)} closed trades to JustFX Dashboard...")
    try:
        req = urllib.request.Request(
            API_URL,
            data=json.dumps({"trades": payload_deals}).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {BRIDGE_TOKEN}"
            }
        )
        with urllib.request.urlopen(req, timeout=10) as res:
            res_data = json.loads(res.read().decode())
            print(f"[+] Sync successful! Server response: {res_data.get('message', 'OK')}")
            return True
    except Exception as e:
        print(f"[x] Error transmitting to JustFX API: {e}")
        return False

if __name__ == "__main__":
    print("==================================================")
    print("       JustFX MetaTrader 5 History Bridge         ")
    print("==================================================")
    sync_mt5()
