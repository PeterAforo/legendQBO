/**
 * Bank of America Business Checking Statement PDF Parser
 * Extracts transactions from BofA statement text (pdf-parse v1 output).
 *
 * pdf-parse v1 outputs text with NO spaces between date/description/amount,
 * e.g. "01/02/26BKOFAMERICA ATM 01/02 ...10,976.00"
 */

export type QboTxType = "Deposit" | "Check" | "Expense";

export interface ParsedTransaction {
  date: string;
  description: string;
  check_number?: string;
  money_in?: number;
  money_out?: number;
  amount: number;
  direction: string;
  section: string;
  raw_text: string;
  payee: string;
  memo: string;
  txType: QboTxType;
}

export interface ParsedSummary {
  total_deposits?: number;
  total_withdrawals?: number;
  total_checks?: number;
  total_fees?: number;
  opening_balance?: number;
  closing_balance?: number;
}

export interface ExtractionResult {
  transactions: ParsedTransaction[];
  summary: ParsedSummary;
}

// With the custom spacedPageRender, text has proper spaces between columns.
// Transaction format: "MM/DD/YY description amount"
const TX_LINE_RE = /^(\d{2}\/\d{2}\/\d{2})\s+(.+?)\s+(-?[\d,]+\.\d{2})$/;

// Check line (two entries per line, with spaces):
// "01/06/26 -960.00 01/08/26 2059 -1,642.00" or "01/08/26 2052 -1,584.00 ..."
const CHECK_ENTRY_RE = /(\d{2}\/\d{2}\/\d{2})\s+(\d{4}\*?)?\s*(-[\d,]+\.\d{2})/g;

const SUMMARY_AMOUNT_RE = /\$?([\d,]+\.\d{2})/;

function parseAmount(s: string): number {
  return parseFloat(s.replace(/,/g, ""));
}

function parseDate(dateStr: string, year: number): string {
  const [mm, dd] = dateStr.split("/");
  return `${year}-${mm}-${dd}`;
}

function detectStatementYear(text: string): number {
  const match = text.match(/(\w+)\s+\d+,\s+(\d{4})\s+to\s+\w+\s+\d+,\s+\d{4}/);
  if (match) return parseInt(match[2]);
  const yearMatch = text.match(/20\d{2}/);
  return yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
}

type Section = "deposits" | "withdrawals" | "checks" | "fees" | "unknown";

export function parseBofAStatement(text: string): ExtractionResult {
  const year = detectStatementYear(text);
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const transactions: ParsedTransaction[] = [];
  const summary: ParsedSummary = {};
  let currentSection: Section = "unknown";
  let pendingLine = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect section headers (pdf-parse concatenates header with amount sometimes)
    if (/^Deposits and other credits/i.test(line)) {
      flushPending(pendingLine, currentSection, year, transactions);
      pendingLine = "";
      currentSection = "deposits";
      continue;
    }
    if (/^Withdrawals and other debits/i.test(line)) {
      flushPending(pendingLine, currentSection, year, transactions);
      pendingLine = "";
      currentSection = "withdrawals";
      continue;
    }
    if (/^Checks\s/i.test(line) || /^Checks$/i.test(line) || /^Checks\s*-\s*continued/i.test(line)) {
      flushPending(pendingLine, currentSection, year, transactions);
      pendingLine = "";
      currentSection = "checks";
      continue;
    }
    if (/^Service fees/i.test(line)) {
      flushPending(pendingLine, currentSection, year, transactions);
      pendingLine = "";
      currentSection = "fees";
      continue;
    }
    if (/^Daily ledger balances/i.test(line)) {
      flushPending(pendingLine, currentSection, year, transactions);
      pendingLine = "";
      currentSection = "unknown";
      continue;
    }

    // Handle continuation lines in deposit/withdrawal/fee sections BEFORE skip filters
    // This ensures multi-line transactions (Zelle, CHECKCARD, etc.) are captured
    if ((currentSection === "deposits" || currentSection === "withdrawals" || currentSection === "fees") && pendingLine) {
      const startsWithDate = /^\d{2}\/\d{2}\/\d{2}\s/.test(line);
      // Don't treat known structural lines as continuations
      const isStructural = /^(Total |Beginning |Ending |Note |#\s+of |Average |Subtotal|Page\s+\d|LEGENDS HOMECARE|continued on|Date\s|Your\s|For\s+info|Card account)/i.test(line);
      if (!startsWithDate && !isStructural) {
        // Continuation line — append to pending (description overflow or amount-only)
        pendingLine += " " + line;
        continue;
      }
      // Flush pending before processing a structural line or new date line
      if (startsWithDate || isStructural) {
        flushPending(pendingLine, currentSection, year, transactions);
        pendingLine = "";
      }
    }

    // Skip non-transaction lines
    if (/^Date\s*(Check|Description|Transaction)/i.test(line)) continue;
    if (/^Page\s+\d+/i.test(line)) continue;
    if (/^LEGENDS HOMECARE/i.test(line)) continue;
    if (/^Your\s+(checking|Business)/i.test(line)) continue;
    if (/^continued on/i.test(line)) continue;
    if (/^Subtotal for card/i.test(line)) continue;
    if (/^Card account/i.test(line)) continue;
    if (/^Total\s+#\s+of/i.test(line)) continue;
    if (/^\*\s+There is/i.test(line)) continue;
    if (/^Help prevent/i.test(line)) continue;
    if (/^When you use/i.test(line)) continue;
    if (/^Consider writing/i.test(line)) continue;
    if (/^You can also/i.test(line)) continue;
    if (/^Scan the code/i.test(line)) continue;
    if (/^Mobile Banking requires/i.test(line)) continue;
    if (/^rates may/i.test(line)) continue;
    if (/^Please see/i.test(line)) continue;
    if (/^Moving from/i.test(line)) continue;

    // Extract summary totals
    if (/^Total deposits/i.test(line)) {
      const m = line.match(SUMMARY_AMOUNT_RE);
      if (m) summary.total_deposits = parseAmount(m[1]);
      continue;
    }
    if (/^Total withdrawals/i.test(line)) {
      const m = line.match(SUMMARY_AMOUNT_RE);
      if (m) summary.total_withdrawals = parseAmount(m[1]);
      continue;
    }
    if (/^Total checks/i.test(line)) {
      const m = line.match(SUMMARY_AMOUNT_RE);
      if (m) summary.total_checks = parseAmount(m[1]);
      continue;
    }
    if (/^Total service fees/i.test(line)) {
      const m = line.match(SUMMARY_AMOUNT_RE);
      if (m) summary.total_fees = parseAmount(m[1]);
      continue;
    }
    if (/^Beginning balance/i.test(line)) {
      const m = line.match(SUMMARY_AMOUNT_RE);
      if (m) summary.opening_balance = parseAmount(m[1]);
      continue;
    }
    if (/^Ending balance/i.test(line)) {
      const m = line.match(SUMMARY_AMOUNT_RE);
      if (m) summary.closing_balance = parseAmount(m[1]);
      continue;
    }

    // Parse checks section (two-column, with spaces)
    if (currentSection === "checks") {
      const checkMatches = [...line.matchAll(CHECK_ENTRY_RE)];
      for (const cm of checkMatches) {
        const date = parseDate(cm[1], year);
        const checkNum = cm[2] ? cm[2].replace("*", "") : undefined;
        const amt = parseAmount(cm[3]);
        const desc = checkNum ? `Check #${checkNum}` : "Check (no number)";
        transactions.push({
          date,
          description: desc,
          check_number: checkNum,
          money_out: Math.abs(amt),
          amount: Math.abs(amt),
          direction: "Money Out",
          section: "Checks",
          raw_text: line,
          payee: "",
          memo: desc,
          txType: "Check",
        });
      }
      continue;
    }

    // Parse deposit/withdrawal/fee transactions — new date lines start a new transaction
    if (currentSection === "deposits" || currentSection === "withdrawals" || currentSection === "fees") {
      const startsWithDate = /^\d{2}\/\d{2}\/\d{2}\s/.test(line);
      if (startsWithDate) {
        flushPending(pendingLine, currentSection, year, transactions);
        pendingLine = line;
      }
      // Non-date lines without a pending transaction are ignored
      continue;
    }
  }

  // Flush last pending
  flushPending(pendingLine, currentSection, year, transactions);

  return { transactions, summary };
}

function flushPending(
  line: string,
  section: Section,
  year: number,
  transactions: ParsedTransaction[]
) {
  if (!line) return;

  const match = line.match(TX_LINE_RE);
  if (!match) return;

  const date = parseDate(match[1], year);
  const description = match[2].trim();
  const rawAmount = parseAmount(match[3]);

  const isDeposit = section === "deposits";
  const amount = Math.abs(rawAmount);

  const sectionLabel =
    section === "deposits" ? "Deposits" :
    section === "withdrawals" ? "Withdrawals" :
    section === "fees" ? "Service Fees" : "Unknown";

  const { payee, memo } = extractPayeeAndMemo(description);
  const txType: QboTxType = isDeposit ? "Deposit" : "Expense";

  transactions.push({
    date,
    description,
    money_in: isDeposit ? amount : undefined,
    money_out: !isDeposit ? amount : undefined,
    amount,
    direction: isDeposit ? "Money In" : "Money Out",
    section: sectionLabel,
    raw_text: line,
    payee,
    memo,
    txType,
  });
}

/**
 * Extracts the payee name and memo from a BofA transaction description.
 * Handles common patterns: Zelle, CHECKCARD, ACH/DES, Counter Credit, ATM deposits, etc.
 */
function extractPayeeAndMemo(description: string): { payee: string; memo: string } {
  // Zelle payment to/from: "Zelle payment to  Name for \"memo\"; Conf# xxx"
  const zelleMatch = description.match(/^Zelle payment (?:to|from)\s+(.+?)\s+for\s+"(.+?)"/);
  if (zelleMatch) {
    return { payee: zelleMatch[1].trim(), memo: zelleMatch[2].trim() };
  }
  // Zelle without for clause: "Zelle payment to  Name; Conf# xxx"
  const zelleSimple = description.match(/^Zelle payment (?:to|from)\s+(.+?)(?:;|$)/);
  if (zelleSimple) {
    return { payee: zelleSimple[1].trim(), memo: description };
  }

  // CHECKCARD: "CHECKCARD  0102 STAPLES ... SOUTHINGTON  CT ..."
  const cardMatch = description.match(/^CHECKCARD\s+\d{4}\s+(.+?)\s{2,}/);
  if (cardMatch) {
    return { payee: titleCase(cardMatch[1].trim()), memo: description };
  }

  // ACH/EFT with DES and INDN: "EVERSOURCE  DES:WEB_PAY ... INDN:TRACY NTIM  CO ..."
  const achIndnMatch = description.match(/^(.+?)\s+DES:.+?INDN:(.+?)\s{2,}/);
  if (achIndnMatch) {
    return { payee: titleCase(achIndnMatch[2].trim()), memo: description };
  }
  // ACH without INDN: "COMPANY  DES:TYPE  ID:xxx"
  const achMatch = description.match(/^(.+?)\s+DES:/);
  if (achMatch) {
    return { payee: titleCase(achMatch[1].trim()), memo: description };
  }

  // Online Banking transfer: "Online Banking transfer from SAV 5806 Confirmation# xxx"
  const onlineMatch = description.match(/^Online Banking transfer from (\w+\s+\d+)/);
  if (onlineMatch) {
    return { payee: `Transfer from ${onlineMatch[1]}`, memo: description };
  }

  // ATM deposit: "BKOFAMERICA ATM 01/02 #000004962 DEPOSIT AMITY ... NEW HAVEN CT"
  const atmMatch = description.match(/^BKOFAMERICA ATM .+ DEPOSIT\s+(.+?)\s{2,}/);
  if (atmMatch) {
    return { payee: `ATM Deposit - ${titleCase(atmMatch[1].trim())}`, memo: description };
  }

  // Mobile deposit: "BKOFAMERICA MOBILE 01/05 3831137595 DEPOSIT ..."
  if (/^BKOFAMERICA MOBILE/.test(description)) {
    return { payee: "Mobile Deposit", memo: description };
  }

  // BKOFAMERICA BC (branch credit): "BKOFAMERICA BC  01/20 #000006267 FR CHKG"
  if (/^BKOFAMERICA BC/.test(description)) {
    return { payee: "Bank Transfer (Branch)", memo: description };
  }

  // Counter Credit
  if (/^Counter Credit/i.test(description)) {
    return { payee: "Counter Credit (Cash/Check Deposit)", memo: description };
  }

  // PURCHASE with merchant: "SHELL SERVICE   01/05 #000713553 PURCHASE SHELL SERVICE STA  NEW HAVEN CT"
  const purchaseMatch = description.match(/^(.+?)\s+\d{2}\/\d{2}\s+#\d+\s+PURCHASE\s+(.+?)\s{2,}/);
  if (purchaseMatch) {
    return { payee: titleCase(purchaseMatch[1].trim()), memo: description };
  }

  // PURCHASE without location pattern: "PURCHASE   0109 COMCAST / XFINITY 800-266-2278 NH"
  const purchaseAlt = description.match(/^PURCHASE\s+\d{4}\s+(.+?)\s+\d{3}/);
  if (purchaseAlt) {
    return { payee: titleCase(purchaseAlt[1].trim()), memo: description };
  }

  // Service fee descriptions
  if (/^(Excess Transaction Fee|Monthly Maintenance|Service Charge)/i.test(description)) {
    return { payee: "Bank of America", memo: description };
  }

  // Fallback: use first meaningful word(s) as payee
  const words = description.split(/\s+/).filter(w => w.length > 1);
  const payee = titleCase(words.slice(0, 3).join(" "));
  return { payee, memo: description };
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\b(Ct|Ca|Nh|Co|Ma)\b/gi, (st) => st.toUpperCase());
}
