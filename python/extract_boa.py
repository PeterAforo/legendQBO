#!/usr/bin/env python3
"""
Bank of America PDF Statement Extractor for Legends Homecare LLC.

Extracts transactions from Bank of America business checking PDF statements.
Uses pdfplumber for native text extraction with OCR fallback via pytesseract.

Usage:
    python extract_boa.py <pdf_path>

Outputs structured JSON to stdout.
"""

import sys
import json
import re
from datetime import datetime
from dateutil import parser as dateparser

try:
    import pdfplumber
except ImportError:
    print(json.dumps({"error": "pdfplumber not installed"}))
    sys.exit(1)

# OCR fallback imports (optional)
try:
    import pytesseract
    from PIL import Image
    import cv2
    import numpy as np
    HAS_OCR = True
except ImportError:
    HAS_OCR = False


def extract_text_from_pdf(pdf_path):
    """Extract text from each page using pdfplumber, with OCR fallback."""
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            
            # If text extraction yields very little, try OCR
            if len(text.strip()) < 50 and HAS_OCR:
                try:
                    img = page.to_image(resolution=300)
                    pil_img = img.original
                    # Convert to grayscale for better OCR
                    cv_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2GRAY)
                    # Apply thresholding
                    _, cv_img = cv2.threshold(cv_img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                    ocr_text = pytesseract.image_to_string(cv_img)
                    if len(ocr_text.strip()) > len(text.strip()):
                        text = ocr_text
                except Exception:
                    pass  # Stick with pdfplumber text
            
            pages.append({
                "page_number": i + 1,
                "text": text,
            })
    return pages


def parse_date(date_str, year=None):
    """Parse a date string, assuming current/given year if not specified."""
    try:
        dt = dateparser.parse(date_str)
        if dt and year and dt.year == datetime.now().year and year != datetime.now().year:
            dt = dt.replace(year=year)
        return dt
    except Exception:
        return None


def parse_amount(amount_str):
    """Parse a dollar amount string to float."""
    if not amount_str:
        return 0.0
    cleaned = re.sub(r'[,$\s]', '', str(amount_str))
    cleaned = cleaned.replace('(', '-').replace(')', '')
    try:
        return abs(float(cleaned))
    except ValueError:
        return 0.0


def extract_summary(full_text):
    """Extract summary totals from Bank of America statement."""
    summary = {}
    
    # Opening/Beginning balance
    match = re.search(r'(?:Beginning|Opening)\s+balance.*?(\$?[\d,]+\.\d{2})', full_text, re.IGNORECASE)
    if match:
        summary['opening_balance'] = parse_amount(match.group(1))
    
    # Deposits and additions
    match = re.search(r'Deposits\s+and\s+(?:other\s+)?additions.*?(\$?[\d,]+\.\d{2})', full_text, re.IGNORECASE)
    if match:
        summary['total_deposits'] = parse_amount(match.group(1))
    
    # Withdrawals (electronic/other)
    match = re.search(r'(?:Withdrawals|Electronic\s+withdrawals).*?(?:subtracting\s+)?(\$?[\d,]+\.\d{2})', full_text, re.IGNORECASE)
    if match:
        summary['total_withdrawals'] = parse_amount(match.group(1))

    # Checks
    match = re.search(r'Checks\s*.*?(\$?[\d,]+\.\d{2})', full_text, re.IGNORECASE)
    if match:
        summary['total_checks'] = parse_amount(match.group(1))
    
    # Service fees
    match = re.search(r'(?:Service\s+fees|Service\s+charges?).*?(\$?[\d,]+\.\d{2})', full_text, re.IGNORECASE)
    if match:
        summary['total_fees'] = parse_amount(match.group(1))
    
    # Ending/Closing balance
    match = re.search(r'(?:Ending|Closing)\s+balance.*?(\$?[\d,]+\.\d{2})', full_text, re.IGNORECASE)
    if match:
        summary['closing_balance'] = parse_amount(match.group(1))
    
    return summary


def detect_statement_date(full_text):
    """Detect statement month and year from header."""
    # Look for date range like "January 2, 2026 - January 30, 2026"
    match = re.search(r'(\w+\s+\d{1,2},?\s+\d{4})\s*[-–to]+\s*(\w+\s+\d{1,2},?\s+\d{4})', full_text)
    if match:
        try:
            end_date = dateparser.parse(match.group(2))
            if end_date:
                return end_date.month, end_date.year
        except Exception:
            pass
    return None, None


def parse_transactions(pages, statement_year=None):
    """Parse transactions from extracted page text."""
    transactions = []
    current_section = None
    
    # Combine all text for section detection
    section_patterns = {
        'deposits': r'(?:Deposits\s+and\s+(?:other\s+)?additions|DEPOSITS)',
        'withdrawals': r'(?:Withdrawals|Electronic\s+withdrawals|WITHDRAWALS)',
        'checks': r'(?:Checks\s+paid|CHECKS)',
        'fees': r'(?:Service\s+fees|Service\s+charges?|SERVICE\s+FEES)',
        'daily_balances': r'(?:Daily\s+ending\s+balance|DAILY\s+ENDING)',
    }
    
    # Date pattern: MM/DD or Month DD
    date_pattern = re.compile(
        r'^(\d{1,2}/\d{1,2})\s+'
        r'(.+?)\s+'
        r'([\d,]+\.\d{2})\s*$'
    )
    
    # Alternative: date + description on one line, amount on next
    alt_date_pattern = re.compile(
        r'^(\d{1,2}/\d{1,2})\s+(.+?)$'
    )
    
    # Check pattern: Check# + date + amount
    check_pattern = re.compile(
        r'(\d{4,6})\s+(\d{1,2}/\d{1,2})\s+([\d,]+\.\d{2})'
    )
    
    for page in pages:
        lines = page['text'].split('\n')
        page_num = page['page_number']
        
        for i, line in enumerate(lines):
            stripped = line.strip()
            if not stripped:
                continue
            
            # Detect section
            for section_name, pattern in section_patterns.items():
                if re.search(pattern, stripped, re.IGNORECASE):
                    current_section = section_name
                    break
            
            # Skip daily balances section
            if current_section == 'daily_balances':
                continue
            
            # Try check pattern (in checks section)
            if current_section == 'checks':
                check_match = check_pattern.search(stripped)
                if check_match:
                    check_num = check_match.group(1)
                    date_str = check_match.group(2)
                    amount = parse_amount(check_match.group(3))
                    
                    tx_date = parse_check_date(date_str, statement_year)
                    
                    transactions.append({
                        'date': tx_date,
                        'description': f'Check #{check_num}',
                        'check_number': check_num,
                        'money_in': None,
                        'money_out': amount,
                        'amount': amount,
                        'direction': 'Money Out',
                        'section': 'checks',
                        'source_page': page_num,
                        'raw_text': stripped,
                    })
                    continue
            
            # Try standard transaction pattern
            match = date_pattern.match(stripped)
            if match:
                date_str = match.group(1)
                description = match.group(2).strip()
                amount = parse_amount(match.group(3))
                
                tx_date = parse_check_date(date_str, statement_year)
                
                is_deposit = current_section == 'deposits'
                is_fee = current_section == 'fees'
                
                tx = {
                    'date': tx_date,
                    'description': description,
                    'check_number': None,
                    'money_in': amount if is_deposit else None,
                    'money_out': amount if not is_deposit else None,
                    'amount': amount,
                    'direction': 'Money In' if is_deposit else 'Money Out',
                    'section': current_section or ('deposits' if is_deposit else 'withdrawals'),
                    'source_page': page_num,
                    'raw_text': stripped,
                }
                
                if is_fee:
                    tx['section'] = 'fees'
                
                transactions.append(tx)
                continue
            
            # Try multi-column format common in BoA statements
            # Date Description Amount Amount (two columns for deposits/withdrawals)
            multi_col = re.match(
                r'^(\d{1,2}/\d{1,2})\s+(.+?)\s{2,}([\d,]+\.\d{2})(?:\s+([\d,]+\.\d{2}))?$',
                stripped
            )
            if multi_col:
                date_str = multi_col.group(1)
                description = multi_col.group(2).strip()
                amount1 = parse_amount(multi_col.group(3))
                amount2 = parse_amount(multi_col.group(4)) if multi_col.group(4) else None
                
                tx_date = parse_check_date(date_str, statement_year)
                
                if current_section == 'deposits':
                    transactions.append({
                        'date': tx_date,
                        'description': description,
                        'check_number': None,
                        'money_in': amount1,
                        'money_out': None,
                        'amount': amount1,
                        'direction': 'Money In',
                        'section': 'deposits',
                        'source_page': page_num,
                        'raw_text': stripped,
                    })
                else:
                    transactions.append({
                        'date': tx_date,
                        'description': description,
                        'check_number': None,
                        'money_in': None,
                        'money_out': amount1,
                        'amount': amount1,
                        'direction': 'Money Out',
                        'section': current_section or 'withdrawals',
                        'source_page': page_num,
                        'raw_text': stripped,
                    })
    
    return transactions


def parse_check_date(date_str, year=None):
    """Parse MM/DD format date with statement year."""
    try:
        parts = date_str.split('/')
        month = int(parts[0])
        day = int(parts[1])
        yr = year or datetime.now().year
        return datetime(yr, month, day).strftime('%Y-%m-%d')
    except Exception:
        return datetime.now().strftime('%Y-%m-%d')


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python extract_boa.py <pdf_path>"}))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    
    try:
        # Extract text from PDF
        pages = extract_text_from_pdf(pdf_path)
        full_text = '\n'.join(p['text'] for p in pages)
        
        # Detect statement date
        stmt_month, stmt_year = detect_statement_date(full_text)
        
        # Extract summary
        summary = extract_summary(full_text)
        
        # Parse transactions
        transactions = parse_transactions(pages, statement_year=stmt_year)
        
        # Deduplicate by date + description + amount
        seen = set()
        unique_txs = []
        for tx in transactions:
            key = f"{tx['date']}_{tx['description']}_{tx['amount']}"
            if key not in seen:
                seen.add(key)
                unique_txs.append(tx)
        
        result = {
            'transactions': unique_txs,
            'summary': summary,
            'page_count': len(pages),
            'transaction_count': len(unique_txs),
            'statement_month': stmt_month,
            'statement_year': stmt_year,
        }
        
        print(json.dumps(result, default=str))
    
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == '__main__':
    main()
