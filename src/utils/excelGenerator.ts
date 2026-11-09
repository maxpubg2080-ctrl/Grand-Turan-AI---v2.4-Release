import ExcelJS from 'exceljs';
import { PassportRecord, FlightDetails } from '../types/passport';
import { ensureDotDate } from './mrzParser';

/**
 * Creates ExcelJS Workbook for Prestige / TAS SHARM format
 * Exact layout from real charter flight manifests (Images 6 & 7):
 * Row 2 Headers (A: Familiya, B: Ism, D: Familiya(lat), E: Ism(lat), G: Tug'.sana, H: MR/MRS, I: Seriya, J: №, K: Berilgan, L: Muddati, N: Fuqarolik, O: Jins, R: Davlat).
 * Green-marked fields (C, F, M, P, Q, S, T, U) are removed.
 */
export async function generatePrestigeWorkbook(records: PassportRecord[]): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Grand Turan AI — Muhammad Amin';
  workbook.lastModifiedBy = 'Grand Turan AI';
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet('Лист1', {
    views: [{ showGridLines: true }],
  });

  // Row 2 Headers (A: Familiya, B: Ism, D: Familiya(lat), E: Ism(lat), G: Tug'.sana, H: MR/MRS, I: Seriya, J: №, K: Berilgan, L: Muddati, N: Fuqarolik, O: Jins, R: Davlat)
  const headerRow = sheet.getRow(2);
  headerRow.height = 26;

  const headers = [
    { col: 1, val: 'Familiya' },               // A
    { col: 2, val: 'Ism' },                     // B
    // C: Removed (Green-marked)
    { col: 4, val: 'Familiya(lat)' },           // D
    { col: 5, val: 'Ism(lat)' },                // E
    // F: Removed (Green-marked)
    { col: 7, val: "Tug'.sana" },               // G
    { col: 8, val: 'MR/MRS' },                  // H
    { col: 9, val: 'Seriya' },                  // I
    { col: 10, val: '№' },                      // J
    { col: 11, val: 'Berilgan' },               // K
    { col: 12, val: 'Muddati' },                // L
    // M: Removed (Green-marked)
    { col: 14, val: 'Fuqarolik' },              // N
    { col: 15, val: 'Jins' },                   // O
    // P, Q: Removed (Green-marked)
    { col: 18, val: 'Davlat' },                 // R
    // S, T, U: Removed (Green-marked)
  ];

  headers.forEach(({ col, val }) => {
    const cell = headerRow.getCell(col);
    cell.value = val;
    cell.font = { bold: true, color: { argb: 'FF000000' }, size: 10, name: 'Calibri' };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };
  });

  // Populate Row 3+
  records.forEach((record, idx) => {
    const rowNum = idx + 3;
    const row = sheet.getRow(rowNum);
    row.height = 20;

    const birthDot = ensureDotDate(record.birthDate);
    const issueDot = ensureDotDate(record.issueDate);
    const expiryDot = ensureDotDate(record.expiryDate);

    // Country/Citizenship label
    const isUzb = record.nationality.toLowerCase().includes('uzb') || record.nationality.toLowerCase().includes("o'zbek");
    const nationalityStr = isUzb ? "O'zbekiston" : record.nationality || "O'zbekiston";
    const countryStr = isUzb ? "O'zbekiston" : record.country || "O'zbekiston";

    row.getCell(1).value = (record.surname || '').toUpperCase();         // A: Familiya
    row.getCell(2).value = (record.givenNames || '').toUpperCase();      // B: Ism
    // C: Removed
    row.getCell(4).value = (record.surnameLat || record.surname || '').toUpperCase(); // D: Familiya(lat)
    row.getCell(5).value = (record.givenNamesLat || record.givenNames || '').toUpperCase(); // E: Ism(lat)
    // F: Removed
    row.getCell(7).value = birthDot;                                     // G: Tug'.sana
    row.getCell(8).value = record.title || (record.gender === 'M' ? 'MR' : 'MRS'); // H: MR/MRS
    row.getCell(9).value = (record.series || 'FA').toUpperCase();         // I: Seriya
    row.getCell(10).value = record.number || '';                          // J: №
    row.getCell(11).value = issueDot;                                    // K: Berilgan
    row.getCell(12).value = expiryDot;                                   // L: Muddati
    // M: Removed
    row.getCell(14).value = nationalityStr;                              // N: Fuqarolik
    row.getCell(15).value = record.gender || (record.title === 'MRS' ? 'F' : 'M'); // O: Jins
    // P, Q: Removed
    row.getCell(18).value = countryStr;                                  // R: Davlat
    // S, T, U: Removed

    for (let c of [1, 2, 4, 5, 7, 8, 9, 10, 11, 12, 14, 15, 18]) {
      const cell = row.getCell(c);
      cell.font = { size: 10, name: 'Calibri' };
      cell.alignment = {
        vertical: 'middle',
        horizontal: [7, 8, 9, 10, 11, 12, 14, 15, 18].includes(c) ? 'center' : 'left',
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    }
  });

  // Column widths for remaining columns (A, B, D, E, G, H, I, J, K, L, N, O, R)
  sheet.columns = [
    { width: 18 }, // A Familiya
    { width: 16 }, // B Ism
    { width: 0 },  // C (hidden/removed)
    { width: 22 }, // D Familiya(lat)
    { width: 20 }, // E Ism(lat)
    { width: 0 },  // F (hidden/removed)
    { width: 16 }, // G Tug'.sana
    { width: 10 }, // H MR/MRS
    { width: 10 }, // I Seriya
    { width: 14 }, // J №
    { width: 16 }, // K Berilgan
    { width: 18 }, // L Muddati
    { width: 0 },  // M (hidden/removed)
    { width: 16 }, // N Fuqarolik
    { width: 8 },  // O Jins
    { width: 0 },  // P (hidden/removed)
    { width: 0 },  // Q (hidden/removed)
    { width: 16 }, // R Davlat
    { width: 0 },  // S (hidden/removed)
    { width: 0 },  // T (hidden/removed)
    { width: 0 },  // U (hidden/removed)
  ];

  return workbook;
}

/**
 * Creates ExcelJS Workbook for "Список на авиабилеты" (FlyKhiva)
 * Exact aviation manifest:
 * Row 8 Headers: A: №, B: Familiya,ism, C: Pol, D: Tug'.sana, E: № pasporta, F: Klass(Y), G: Grazhd(UZB), H: Srok
 * Green-marked fields (C, F, M, P, Q, S, T, U) are removed.
 */
export async function generateFlyKhivaWorkbook(
  records: PassportRecord[],
  flightDetails?: Partial<FlightDetails>
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FlyKhiva / Grand Turan AI — Muhammad Amin';
  workbook.lastModifiedBy = 'Grand Turan AI';
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet('Страница 1', {
    views: [{ showGridLines: true }],
  });

  const now = new Date();
  const defaultDate = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()}`;
  const fDate = flightDetails?.flightDate || defaultDate;
  const fNum = flightDetails?.flightNumber || '2U 5508';
  const fTime = flightDetails?.departureTime || '23:50';
  const fRoute = flightDetails?.route || 'SSH-TAS';

  // Row 1: Title (Times New Roman 10pt Bold)
  const r1 = sheet.getCell('A1');
  r1.value = 'Список на авиабилеты';
  r1.font = { name: 'Times New Roman', size: 10, bold: true };

  // Row 3: Flight Date
  const r3 = sheet.getCell('A3');
  r3.value = fDate;
  r3.font = { name: 'Times New Roman', size: 10 };

  // Row 4: Flight Number
  const r4 = sheet.getCell('A4');
  r4.value = `Рейс: ${fNum}`;
  r4.font = { name: 'Times New Roman', size: 10 };

  // Row 5: Departure Time
  const r5 = sheet.getCell('A5');
  r5.value = `Время вылета: ${fTime}`;
  r5.font = { name: 'Times New Roman', size: 10 };

  // Row 6: Route
  const r6 = sheet.getCell('A6');
  r6.value = `Маршрут: ${fRoute}`;
  r6.font = { name: 'Times New Roman', size: 10 };

  // Row 8 Headers: A: №, B: Familiya,ism, D: Tug'.sana, E: № pasporta, G: Grazhd(UZB), H: Srok
  // Green-marked fields (C, F, M, P, Q, S, T, U) removed
  const headerRow = sheet.getRow(8);
  headerRow.height = 24;

  const headers = [
    { col: 1, val: '№' },                       // A
    { col: 2, val: 'Familiya,ism' },            // B
    // C: Removed (Green-marked)
    // D: Tug'.sana (moved to col 3)
    { col: 3, val: "Tug'.sana" },               // D -> col 3
    // E: № pasporta (moved to col 4)
    { col: 4, val: '№ pasporta' },              // E -> col 4
    // F: Removed (Green-marked)
    // G: Klass(Y) (moved to col 5)
    { col: 5, val: 'Klass(Y)' },                // F -> col 5
    // H: Grazhd(UZB) (moved to col 6)
    { col: 6, val: 'Grazhd(UZB)' },             // G -> col 6
    // I: Srok (moved to col 7)
    { col: 7, val: 'Srok' },                    // H -> col 7
    // M, P, Q, S, T, U: Removed
  ];

  headers.forEach(({ col, val }) => {
    const cell = headerRow.getCell(col);
    cell.value = val;
    cell.font = { name: 'Times New Roman', size: 10, bold: true };
    cell.alignment = { vertical: 'middle', horizontal: col === 2 ? 'left' : 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
    };
  });

  // Row 9+: Data rows
  records.forEach((record, idx) => {
    const rowNum = idx + 9;
    const row = sheet.getRow(rowNum);
    row.height = 20;

    const fullName = `${record.surname} ${record.givenNames}`.trim().toUpperCase();
    const passportFullNumber = `${record.series || ''}${record.number || ''}`.replace(/\s+/g, '').toUpperCase();
    const birthDot = ensureDotDate(record.birthDate);
    const expiryDot = ensureDotDate(record.expiryDate);

    let grazhd = 'UZB';
    const natUpper = (record.nationality || '').toUpperCase();
    if (natUpper.includes('KGZ') || natUpper.includes('KIRGIZ')) grazhd = 'KGZ';
    else if (natUpper.includes('CAN')) grazhd = 'CAN';
    else if (natUpper.includes('TJK') || natUpper.includes('TOJIK')) grazhd = 'TJK';
    else if (natUpper.includes('KAZ')) grazhd = 'KAZ';
    else if (natUpper.includes('RUS')) grazhd = 'RUS';

    row.getCell(1).value = idx + 1;                                      // A: №
    row.getCell(2).value = fullName;                                     // B: Familiya,ism
    // C: Removed
    row.getCell(3).value = birthDot;                                     // D -> col 3: Tug'.sana
    row.getCell(4).value = passportFullNumber;                           // E -> col 4: № pasporta
    // F: Removed
    row.getCell(5).value = 'Y';                                          // G -> col 5: Klass(Y)
    row.getCell(6).value = grazhd;                                       // H -> col 6: Grazhd(UZB)
    row.getCell(7).value = expiryDot;                                    // I -> col 7: Srok

    for (let c of [1, 2, 3, 4, 5, 6, 7]) {
      const cell = row.getCell(c);
      cell.font = { name: 'Times New Roman', size: 10 };
      cell.alignment = {
        vertical: 'middle',
        horizontal: c === 2 ? 'left' : 'center',
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } },
      };
    }
  });

  // Column widths for remaining columns (A, B, D, E, G, H)
  sheet.columns = [
    { width: 5 },  // A №
    { width: 32 }, // B Familiya,ism
    { width: 0 },  // C (hidden/removed)
    { width: 16 }, // D Tug'.sana
    { width: 16 }, // E № pasporta
    { width: 0 },  // F (hidden/removed)
    { width: 8 },  // G Klass(Y)
    { width: 14 }, // H Grazhd(UZB)
    { width: 0 },  // I (hidden/removed)
    { width: 0 },  // J (hidden/removed)
    { width: 0 },  // K (hidden/removed)
    { width: 0 },  // L (hidden/removed)
    { width: 0 },  // M (hidden/removed)
    { width: 0 },  // N (hidden/removed)
    { width: 0 },  // O (hidden/removed)
    { width: 0 },  // P (hidden/removed)
    { width: 0 },  // Q (hidden/removed)
    { width: 0 },  // R (hidden/removed)
    { width: 0 },  // S (hidden/removed)
    { width: 0 },  // T (hidden/removed)
    { width: 0 },  // U (hidden/removed)
  ];

  return workbook;
}

/**
 * Helper to export workbook to Buffer (useful in Node.js server)
 */
export async function workbookToBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Helper to export workbook to Blob (browser client side)
 */
export async function workbookToBlob(workbook: ExcelJS.Workbook): Promise<Blob> {
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
