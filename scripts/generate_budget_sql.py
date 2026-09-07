#!/usr/bin/env python3
"""Generate SQL INSERT statements from budget.csv into transactions table."""

import csv
import re
from datetime import date
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent / "supabase" / "data"

MONTH_MAP = {
    "nov": 11, "déc": 12, "janv": 1, "févr": 2, "mars": 3,
    "avr": 4, "mai": 5, "juin": 6, "juil": 7, "août": 8,
    "sept": 9, "oct": 10,
}


def load_categories():
    cats = {}
    with open(BASE / "categories_rows.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            cats[(row["name"].strip(), row["type"].strip())] = row["id"].strip()
    return cats


def load_designations():
    desigs = {}
    with open(BASE / "designations_rows.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            desigs[row["name"].strip()] = row["id"].strip()
    return desigs


def parse_month_headers(header_row):
    months = []
    for col in header_row[3:]:
        col = col.strip()
        if not col:
            continue
        parts = col.split()
        if len(parts) != 2:
            continue
        month_abbr = parts[0].rstrip(".")
        year = int(parts[1])
        month_num = MONTH_MAP.get(month_abbr)
        if month_num:
            months.append(date(year, month_num, 1))
    return months


def clean_amount(raw):
    digits = re.sub(r"[^\d]", "", raw)
    if not digits:
        return None
    val = float(digits)
    return val if val > 0 else None


def find_designation_id(name, desigs):
    did = desigs.get(name)
    if did:
        return did, None
    if name == "Dons pour leur sevices":
        did = desigs.get("Dons pour leur services")
        if did:
            return did, None
    return None, name


def generate():
    cats = load_categories()
    desigs = load_designations()
    transactions = []

    with open(BASE / "budget.csv", newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)
        months = parse_month_headers(header)

        for row in reader:
            if len(row) < 3:
                continue

            entry_type = row[0].strip().lower()
            cat_name = row[1].strip()
            desig_name = row[2].strip()

            if not entry_type or not cat_name:
                entry_type = "sortie"
                cat_name = "Dons"

            if entry_type in ("entrée", "entree"):
                entry_type = "entree"
            elif entry_type == "sortie":
                pass
            else:
                continue

            cat_id = cats.get((cat_name, entry_type))
            if not cat_id:
                continue

            desig_id, desig_custom = find_designation_id(desig_name, desigs)

            for i, month_date in enumerate(months):
                col_idx = 3 + i
                if col_idx >= len(row):
                    continue
                raw = row[col_idx].strip()
                if not raw:
                    continue

                amount = clean_amount(raw)
                if amount is None:
                    continue

                transactions.append({
                    "type": entry_type,
                    "category_id": cat_id,
                    "designation_id": desig_id,
                    "designation_custom": desig_custom,
                    "amount": amount,
                    "date": month_date.isoformat(),
                })

    values = []
    for t in transactions:
        desig_id_sql = f"'{t['designation_id']}'" if t["designation_id"] else "NULL"
        if t["designation_custom"]:
            escaped = t["designation_custom"].replace("'", "''")
            desig_custom_sql = f"'{escaped}'"
        else:
            desig_custom_sql = "NULL"

        values.append(
            f"  ('{t['type']}', '{t['category_id']}', "
            f"{desig_id_sql}, {desig_custom_sql}, "
            f"{t['amount']:.2f}, NULL, '{t['date']}')"
        )

    sql = (
        "INSERT INTO transactions "
        "(type, category_id, designation_id, designation_custom, amount, note, transaction_date)\n"
        "VALUES\n"
        + ",\n".join(values)
        + ";\n"
    )

    out_path = BASE / "budget_transactions.sql"
    out_path.write_text(sql, encoding="utf-8")
    print(f"Done — {len(transactions)} transactions written to {out_path}")


if __name__ == "__main__":
    generate()
