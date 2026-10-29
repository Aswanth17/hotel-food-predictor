"""
One-time fix script: Seeds demo hotel accounts for hotels 1-5
and public holidays if they are missing.
Run from backend/ directory.
"""
import sqlite3
import bcrypt
from config import Config

def seed():
    conn = sqlite3.connect(Config.DATABASE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    c = conn.cursor()

    # ── 1. Seed demo accounts for hotels 1–5 ──────────────────────────────────
    demo_accounts = [
        (1, "grand@hotel.com",     "password123"),
        (2, "royalpalm@hotel.com", "password123"),
        (3, "highland@hotel.com",  "password123"),
        (4, "azurebay@hotel.com",  "password123"),
        (5, "sapphire@hotel.com",  "password123"),
    ]

    seeded = 0
    for hotel_id, email, plain_pw in demo_accounts:
        # Check whether hotel exists
        hotel_row = c.execute("SELECT id FROM hotels WHERE id = ?", (hotel_id,)).fetchone()
        if not hotel_row:
            print(f"  SKIP: hotel {hotel_id} not found in hotels table")
            continue

        # Check if account already exists for this hotel_id
        existing = c.execute("SELECT id, email FROM hotel_accounts WHERE hotel_id = ?", (hotel_id,)).fetchone()
        if existing:
            print(f"  EXISTS: hotel_id={hotel_id} already has account email={existing['email']}")
            continue

        # Check if email is taken by another account
        email_taken = c.execute("SELECT id FROM hotel_accounts WHERE email = ?", (email,)).fetchone()
        if email_taken:
            print(f"  EMAIL CONFLICT: {email} already used by another account – skipping hotel {hotel_id}")
            continue

        pw_hash = bcrypt.hashpw(plain_pw.encode(), bcrypt.gensalt()).decode()
        c.execute(
            "INSERT INTO hotel_accounts (hotel_id, email, password_hash, is_active) VALUES (?,?,?,1)",
            (hotel_id, email, pw_hash)
        )
        print(f"  SEEDED: hotel_id={hotel_id}  {email}")
        seeded += 1

    conn.commit()
    print(f"\nDemo accounts: {seeded} newly seeded.")

    # ── 2. Seed public holidays if missing ───────────────────────────────────
    ph_count = c.execute("SELECT COUNT(*) FROM public_holidays").fetchone()[0]
    if ph_count == 0:
        public_holidays_data = [
            ("New Year's Day",     "2026-01-01", "Public Holiday", "IN", "New Year celebration"),
            ("Republic Day",       "2026-01-26", "Public Holiday", "IN", "Indian Republic Day"),
            ("Holi",               "2026-03-21", "Festival",       "IN", "Festival of Colors"),
            ("Good Friday",        "2026-04-03", "Public Holiday", "IN", "Good Friday"),
            ("Eid ul-Fitr",        "2026-04-02", "Festival",       "IN", "End of Ramadan"),
            ("Independence Day",   "2026-08-15", "Public Holiday", "IN", "Indian Independence Day"),
            ("Gandhi Jayanti",     "2026-10-02", "Public Holiday", "IN", "Gandhi's Birthday"),
            ("Dussehra",           "2026-10-22", "Festival",       "IN", "Victory of good over evil"),
            ("Diwali",             "2026-11-08", "Festival",       "IN", "Festival of Lights"),
            ("Christmas",          "2026-12-25", "Public Holiday", "IN", "Christmas Day"),
            ("New Year's Eve",     "2026-12-31", "Festival",       "IN", "New Year Eve celebration"),
        ]
        c.executemany(
            "INSERT OR IGNORE INTO public_holidays (holiday_name, holiday_date, category, country, description) VALUES (?,?,?,?,?)",
            public_holidays_data
        )
        conn.commit()
        print(f"Seeded {len(public_holidays_data)} public holidays.")
    else:
        print(f"Public holidays already seeded: {ph_count} rows.")

    # ── 3. Show final state ──────────────────────────────────────────────────
    print("\n=== hotel_accounts (final) ===")
    for row in c.execute("SELECT ha.id, ha.hotel_id, ha.email, h.name FROM hotel_accounts ha JOIN hotels h ON ha.hotel_id = h.id ORDER BY ha.hotel_id"):
        print(f"  account_id={row[0]} hotel_id={row[1]} email={row[2]} name={row[3]}")

    print("\n=== public_holidays ===")
    for row in c.execute("SELECT holiday_name, holiday_date, category FROM public_holidays ORDER BY holiday_date"):
        print(f"  {row[1]}  {row[0]} ({row[2]})")

    conn.close()

if __name__ == '__main__':
    seed()
