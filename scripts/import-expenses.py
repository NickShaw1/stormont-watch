"""
Import MLA expenses from Excel file into Neon database.
Matches by last name against members table.

Usage:
  pip install openpyxl psycopg2-binary python-dotenv --break-system-packages
  python import-expenses.py

Place this script in the root of your Stormont project.
Reads DATABASE_URL from .env.local
"""

import os
import sys
from openpyxl import load_workbook
from dotenv import load_dotenv

# Load .env.local
load_dotenv('.env.local')

DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    print('ERROR: DATABASE_URL not found in .env.local')
    sys.exit(1)

# Financial year and period — update these when re-running for new data
FINANCIAL_YEAR = '2025-2026'
PERIOD = 'April 2025 - December 2025'
EXCEL_PATH = 'expenses.xlsx'

# Read Excel
wb = load_workbook(EXCEL_PATH, read_only=True)
ws = wb.active

rows = []
for row in ws.iter_rows(values_only=True):
    # Only rows where first column is an integer (the key)
    if isinstance(row[0], int) and row[1]:
        rows.append({
            'key': row[0],
            'name_raw': row[1],
            'constituency_office': float(row[2] or 0),
            'other_expenses': float(row[3] or 0),
            'allowances': float(row[4] or 0),
            'staff_costs': float(row[5] or 0),
            'total': float(row[6] or 0),
        })

print(f'Read {len(rows)} rows from Excel')

# Connect to database
import psycopg2
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# Fetch all members — build lookup by last name
cur.execute("SELECT person_id, full_name FROM members")
members = cur.fetchall()

# Build last name lookup
# full_name is like "Mr John Smith" or "Ms Claire Sugden"
def get_last_name(full_name):
    # Strip prefix
    import re
    name = re.sub(r'^(Mr|Mrs|Miss|Ms|Dr|Lord|Lady|Sir|Rt Hon Sir|Rt Hon)\s+', '', full_name, flags=re.IGNORECASE).strip()
    # Last word is last name
    parts = name.split()
    return parts[-1].lower() if parts else ''

def get_first_name(full_name):
    import re
    name = re.sub(r'^(Mr|Mrs|Miss|Ms|Dr|Lord|Lady|Sir|Rt Hon Sir|Rt Hon)\s+', '', full_name, flags=re.IGNORECASE).strip()
    parts = name.split()
    return parts[0].lower() if len(parts) > 1 else ''

# Build lookup: last_name -> list of (person_id, full_name)
last_name_lookup = {}
for person_id, full_name in members:
    ln = get_last_name(full_name)
    if ln not in last_name_lookup:
        last_name_lookup[ln] = []
    last_name_lookup[ln].append((person_id, full_name))

# Parse Excel name format: "Surname, Firstname" or "Surname Firstname"
def parse_excel_name(name_raw):
    name_raw = name_raw.strip()
    if ',' in name_raw:
        parts = name_raw.split(',', 1)
        last = parts[0].strip().lower()
        first = parts[1].strip().lower().split()[0] if parts[1].strip() else ''
    else:
        parts = name_raw.split()
        last = parts[0].strip().lower()
        first = parts[1].strip().lower() if len(parts) > 1 else ''
    return last, first

# Match each Excel row to a person_id
matched = []
unmatched = []

for row in rows:
    last, first = parse_excel_name(row['name_raw'])
    candidates = last_name_lookup.get(last, [])
    
    if len(candidates) == 1:
        # Unique last name match
        person_id = candidates[0][0]
        matched.append((person_id, row))
    elif len(candidates) > 1:
        # Multiple people with same last name — match on first name too
        found = None
        for person_id, full_name in candidates:
            db_first = get_first_name(full_name).lower()
            if db_first.startswith(first[:3]):  # first 3 chars of first name
                found = person_id
                break
        if found:
            matched.append((found, row))
        else:
            unmatched.append(row['name_raw'])
    else:
        unmatched.append(row['name_raw'])

print(f'Matched: {len(matched)}, Unmatched: {len(unmatched)}')

if unmatched:
    print('UNMATCHED NAMES — these will not be imported:')
    for name in unmatched:
        print(f'  - {name}')
    print()

# Insert into database
inserted = 0
for person_id, row in matched:
    cur.execute("""
        INSERT INTO expenses (
            person_id, financial_year, period,
            constituency_office, other_expenses, allowances,
            staff_costs, total, updated_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
        ON CONFLICT (person_id, financial_year)
        DO UPDATE SET
            period = EXCLUDED.period,
            constituency_office = EXCLUDED.constituency_office,
            other_expenses = EXCLUDED.other_expenses,
            allowances = EXCLUDED.allowances,
            staff_costs = EXCLUDED.staff_costs,
            total = EXCLUDED.total,
            updated_at = NOW()
    """, (
        person_id,
        FINANCIAL_YEAR,
        PERIOD,
        row['constituency_office'],
        row['other_expenses'],
        row['allowances'],
        row['staff_costs'],
        row['total'],
    ))
    inserted += 1

conn.commit()
cur.close()
conn.close()

print(f'Successfully inserted/updated {inserted} expense records')
print(f'Financial year: {FINANCIAL_YEAR}')
print(f'Period: {PERIOD}')
