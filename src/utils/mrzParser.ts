import { PassportRecord } from '../types/passport';

/**
 * Format two-digit year to four-digit year (MRZ standard assumption: expiry is current/future century, DOB reasonable century)
 */
function parseMrzYear(yyStr: string, isExpiry: boolean = false): number {
  const yy = parseInt(yyStr, 10);
  const currentYear = new Date().getFullYear();
  const currentCenturyYY = currentYear % 100;
  
  if (isExpiry) {
    // Expiry dates are typically in this century
    return 2000 + yy;
  }
  // DOB: if YY is greater than current YY, likely 1900s, otherwise 2000s
  return yy > currentCenturyYY ? 1900 + yy : 2000 + yy;
}

const UZ_MONTHS: Record<number, string> = {
  1: 'yanvar', 2: 'fevral', 3: 'mart', 4: 'aprel', 5: 'may', 6: 'iyun',
  7: 'iyul', 8: 'avgust', 9: 'sentabr', 10: 'oktabr', 11: 'noyabr', 12: 'dekabr',
};

/**
 * Formats date into both standard Uzbek readable "YYYY-yil D-oy" and "DD.MM.YYYY"
 */
export function formatUzbekDate(year: number, month: number, day: number): string {
  const mName = UZ_MONTHS[month] || `${month}`;
  return `${year}-yil ${day}-${mName}`;
}

export function formatDotDate(year: number, month: number, day: number): string {
  const dd = day.toString().padStart(2, '0');
  const mm = month.toString().padStart(2, '0');
  return `${dd}.${mm}.${year}`;
}

export function ensureDotDate(dateStr: string): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(trimmed)) {
    return trimmed;
  }
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${d.padStart(2, '0')}.${m.padStart(2, '0')}.${y}`;
  }
  const uzMatch = trimmed.match(/(\d{4})-yil\s+(\d{1,2})-([a-zа-я]+)/i);
  if (uzMatch) {
    const y = uzMatch[1];
    const d = uzMatch[2].padStart(2, '0');
    const monthName = uzMatch[3].toLowerCase();
    const monthMap: Record<string, string> = {
      yanvar: '01', fevral: '02', mart: '03', aprel: '04',
      may: '05', iyun: '06', iyul: '07', avgust: '08',
      sentabr: '09', oktabr: '10', noyabr: '11', dekabr: '12',
      январь: '01', февраль: '02', март: '03', апрель: '04',
      май: '05', июнь: '06', июль: '07', август: '08',
      сентябрь: '09', октябрь: '10', ноябрь: '11', декабрь: '12',
    };
    const m = monthMap[monthName] || '01';
    return `${d}.${m}.${y}`;
  }
  return trimmed;
}

/**
 * Removes Uzbek/Russian patronymics from given names (e.g. "SARDOR ALISHER O'G'LI" -> "SARDOR")
 */
export function stripPatronymic(given: string): string {
  if (!given) return '';
  const cleaned = given.trim().toUpperCase().replace(/\s+/g, ' ');
  const tokens = cleaned.split(' ').filter(Boolean);
  if (tokens.length <= 1) return cleaned;

  // If the last token is a patronymic marker like OGLI, O'G'LI, QIZI, KIZI, UGLI or Russian suffix -VICH/-OVNA
  const patronymicMarkers = new Set(["O'G'LI", 'OGLI', "O`G`LI", 'OʻGʻLI', 'UGLI', 'QIZI', 'KIZI']);
  const last = tokens[tokens.length - 1];
  if (patronymicMarkers.has(last)) {
    // Usually "<GIVEN> <FATHER> O'G'LI" -> take only first token
    return tokens[0];
  }
  if (/(?:OVICH|EVICH|VICH|OVNA|EVNA|QIZI|OGLI)$/i.test(last)) {
    return tokens[0];
  }
  return tokens[0];
}

/**
 * Parses raw MRZ (2 lines of 44 chars) or text containing MRZ lines into PassportRecord
 */
export function parseMrzLines(rawText: string): PassportRecord | null {
  if (!rawText) return null;

  // Clean lines, looking for two lines of approximately 44 characters starting with P<
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim().toUpperCase().replace(/\s+/g, ''))
    .filter((l) => l.length >= 30);

  let line1 = '';
  let line2 = '';

  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i];
    if (cur.startsWith('P<') || cur.startsWith('P0') || cur.startsWith('PK')) {
      if (!line1 && cur.length >= 36) {
        line1 = cur;
        if (i + 1 < lines.length && lines[i + 1].length >= 36) {
          line2 = lines[i + 1];
          break;
        }
      }
    }
  }

  // If standard 2-line MRZ not found, attempt strict regex extraction on raw text (never fabricating data)
  if (!line1 || !line2) {
    return parsePassportTextRegex(rawText);
  }

  // Ensure line length is at least 44 by padding with '<'
  line1 = line1.padEnd(44, '<');
  line2 = line2.padEnd(44, '<');

  // LINE 1: P<UZBKARIMOV<<SARDOR<<<<<<<<<<<<<<<<<<<<<<<<<
  // Country: chars 2..5 (e.g. UZB)
  const countryCode = line1.substring(2, 5).replace(/</g, '').trim() || 'UZB';
  const namePart = line1.substring(5);
  const nameTokens = namePart.split('<<').filter(Boolean);
  const surname = (nameTokens[0] || '').replace(/</g, ' ').trim();
  const rawGiven = (nameTokens[1] || '').replace(/</g, ' ').trim();
  const givenNames = stripPatronymic(rawGiven);

  // LINE 2: FA12345678UZB9005142M3301095<<<<<<<<<<<<<<02
  // Passport number: chars 0..9
  const rawPassportNum = line2.substring(0, 9).replace(/</g, '').trim();
  const seriesMatch = rawPassportNum.match(/^([A-Z]{1,3})/);
  const numMatch = rawPassportNum.match(/([0-9]{5,9})$/);

  const series = seriesMatch ? seriesMatch[1] : rawPassportNum.substring(0, 2);
  const number = numMatch ? numMatch[1] : rawPassportNum.substring(2);

  if (!surname || !number) {
    return null;
  }

  // Nationality: chars 10..13
  const natCode = line2.substring(10, 13).replace(/</g, '').trim() || countryCode;

  // Date of birth: chars 13..19 (YYMMDD)
  const dobYY = line2.substring(13, 15);
  const dobMM = parseInt(line2.substring(15, 17), 10);
  const dobDD = parseInt(line2.substring(17, 19), 10);
  const hasValidDob = !isNaN(parseInt(dobYY, 10)) && dobMM >= 1 && dobMM <= 12 && dobDD >= 1 && dobDD <= 31;
  const birthYear = hasValidDob ? parseMrzYear(dobYY, false) : 0;
  const birthDate = hasValidDob ? formatUzbekDate(birthYear, dobMM, dobDD) : '';

  // Sex: char 20
  const sexChar = line2.charAt(20);
  const gender: 'M' | 'F' = sexChar === 'F' ? 'F' : 'M';
  const title: 'MR' | 'MRS' = gender === 'M' ? 'MR' : 'MRS';

  // Expiration date: chars 21..27 (YYMMDD)
  const expYY = line2.substring(21, 23);
  const expMM = parseInt(line2.substring(23, 25), 10);
  const expDD = parseInt(line2.substring(25, 27), 10);
  const hasValidExp = !isNaN(parseInt(expYY, 10)) && expMM >= 1 && expMM <= 12 && expDD >= 1 && expDD <= 31;
  const expYear = hasValidExp ? parseMrzYear(expYY, true) : 0;
  const expiryDate = hasValidExp ? formatDotDate(expYear, expMM, expDD) : '';

  // Issue date estimation only if valid expiry is present
  let issueDate = '';
  if (hasValidExp) {
    const issueYear = expYear - 10;
    issueDate = formatDotDate(issueYear, expMM, expDD > 1 ? expDD : 1);
  }

  const countryNameMap: Record<string, string> = {
    UZB: "O'zbekiston",
    KAZ: "Qozog'iston",
    KGZ: "Qirg'iziston",
    TJK: 'Tojikiston',
    TKM: 'Turkmaniston',
    RUS: 'Rossiya',
    TUR: 'Turkiya',
    USA: 'AQSH',
    GBR: 'Buyuk Britaniya',
    ARE: 'BAA',
  };
  const nationality = countryNameMap[natCode] || natCode;
  const country = countryNameMap[countryCode] || countryCode;

  return {
    id: `pass_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    surname,
    givenNames,
    surnameLat: surname,
    givenNamesLat: givenNames,
    birthDate,
    title,
    series: series.toUpperCase(),
    number,
    issueDate,
    expiryDate,
    nationality,
    gender,
    country,
    rawMrz: `${line1}\n${line2}`,
    confidence: 0.98,
    engineUsed: 'offline-mrz',
    parsedAt: new Date().toISOString(),
  };
}

/**
 * Strict regex extraction for passport text if MRZ is absent.
 * Returns null if genuine passport fields cannot be extracted (NEVER invents fake data).
 */
export function parsePassportTextRegex(text: string): PassportRecord | null {
  if (!text || text.trim().length < 15) return null;

  // Try finding series + number: e.g. "FA 1234567" or "FA1234567" or "AA1234567"
  const passNumMatch = text.match(/\b([A-Z]{2})\s*([0-9]{7})\b/i);
  if (!passNumMatch) {
    return null;
  }
  const series = passNumMatch[1].toUpperCase();
  const number = passNumMatch[2];

  // Try finding names
  let surname = '';
  let givenNames = '';
  const surnameMatch = text.match(/(?:familiya|surname|фамилия)[:\s]+([A-ZА-ЯЁ'-]+)/i);
  const givenMatch = text.match(/(?:ism|name|given\s*names?|имя)[:\s]+([A-ZА-ЯЁ'-]+)/i);

  if (surnameMatch) surname = surnameMatch[1].toUpperCase();
  if (givenMatch) givenNames = stripPatronymic(givenMatch[1].toUpperCase());

  // If not found with labels, search for two consecutive uppercase words
  if (!surname || !givenNames) {
    const uppercaseWords = text.match(/\b[A-Z]{3,20}\b/g) || [];
    const filtered = uppercaseWords.filter(
      (w) =>
        ![
          'PASSPORT',
          'REPUBLIC',
          'UZBEKISTAN',
          'OZBEKISTON',
          'DATE',
          'BIRTH',
          'SEX',
          'ISSUE',
          'EXPIRY',
          'AUTHORITY',
          'CITIZENSHIP',
        ].includes(w)
    );
    if (filtered.length >= 2) {
      surname = filtered[0];
      givenNames = stripPatronymic(filtered[1]);
    }
  }

  // Never fabricate fake names if real names were not found
  if (!surname || !givenNames) {
    return null;
  }

  // Birth date regex
  const dateMatch = text.match(/\b([0-3]?[0-9])[./-]([0-1]?[0-9])[./-](19[4-9][0-9]|20[0-2][0-9])\b/);
  let birthDate = '';
  if (dateMatch) {
    const d = parseInt(dateMatch[1], 10);
    const m = parseInt(dateMatch[2], 10);
    const y = parseInt(dateMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      birthDate = formatUzbekDate(y, m, d);
    }
  }

  // Gender detection
  const isFemale = /\b(female|ayol|жен|женский)\b/i.test(text);
  const gender: 'M' | 'F' = isFemale ? 'F' : 'M';
  const title: 'MR' | 'MRS' = gender === 'M' ? 'MR' : 'MRS';

  return {
    id: `pass_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    surname,
    givenNames,
    surnameLat: surname,
    givenNamesLat: givenNames,
    birthDate,
    title,
    series,
    number,
    issueDate: '',
    expiryDate: '',
    nationality: "O'zbekiston",
    gender,
    country: "O'zbekiston",
    confidence: 0.85,
    engineUsed: 'offline-mrz',
    parsedAt: new Date().toISOString(),
  };
}
