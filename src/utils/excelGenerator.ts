import ExcelJS from 'exceljs';
import { PassportRecord, FlightDetails } from '../types/passport';
import { ensureDotDate } from './mrzParser';

/**
 * Creates ExcelJS Workbook for Prestige / TAS SHARM format
 * Exact layout from real charter flight manifests (Images 6 & 7):
 * Row 1 Headers:
 * A: Фамилия, B: Имя, C: Отчество (Bo'sh / Umuman kerak emas), D: Фамилия по-латински,
 * E: Имя по-латински, F: Отчество по-латински (Bo'sh), G: Дата рождения (DD.MM.YYYY),
 * H: MR/MRS, I: Серия, J: № паспорта, K: Паспорт выдан (DD.MM.YYYY),
 * L: Паспорт действителен до (DD.MM.YYYY), M: Кем выдан паспорт (Bo'sh),
 * N: Гражданство, O: Пол, P: ИНН, Q: Место рождения, R: Страна рождения,
 * S: Телефон, T: Мобильный, U: Адрес
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

  const headerRow = sheet.getRow(1);
  headerRow.height = 26;

  const headers = [
    { col: 1, val: 'Фамилия' },                  // A
    { col: 2, val: 'Имя' },                      // B
    { col: 3, val: 'Отчество' },                 // C (Bo'sh - otasin ismi kerak emas)
    { col: 4, val: 'Фамилия по-латински' },      // D
    { col: 5, val: 'Имя по-латински' },          // E
    { col: 6, val: 'Отчество по-латински' },     // F (Bo'sh)
    { col: 7, val: 'Дата рождения' },            // G
    { col: 8, val: 'MR/MRS' },                   // H
    { col: 9, val: 'Серия' },                    // I
    { col: 10, val: '№ паспорта' },              // J
    { col: 11, val: 'Паспорт выдан' },           // K
    { col: 12, val: 'Паспорт действителен до' }, // L
    { col: 13, val: 'Кем выдан паспорт' },       // M (Bo'sh)
    { col: 14, val: 'Гражданство' },             // N
    { col: 15, val: 'Пол' },                     // O
    { col: 16, val: 'ИНН' },                     // P (Bo'sh)
    { col: 17, val: 'Место рождения' },          // Q (Bo'sh)
    { col: 18, val: 'Страна рождения' },         // R
    { col: 19, val: 'Телефон' },                 // S (Bo'sh)
    { col: 20, val: 'Мобильный' },               // T (Bo'sh)
    { col: 21, val: 'Адрес' },                   // U (Bo'sh)
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

  // Populate Row 2+
  records.forEach((record, idx) => {
    const rowNum = idx + 2;
    const row = sheet.getRow(rowNum);
    row.height = 20;

    const birthDot = ensureDotDate(record.birthDate);
    const issueDot = ensureDotDate(record.issueDate);
    const expiryDot = ensureDotDate(record.expiryDate);

    // Country/Citizenship label
    const isUzb = record.nationality.toLowerCase().includes('uzb') || record.nationality.toLowerCase().includes("o'zbek");
    const nationalityStr = isUzb ? 'Узбекистан' : record.nationality || 'Узбекистан';
    const countryStr = isUzb ? 'Узбекистан' : record.country || 'Узбекистан';

    row.getCell(1).value = (record.surname || '').toUpperCase();
    row.getCell(2).value = (record.givenNames || '').toUpperCase();
    row.getCell(3).value = ''; // C: Otчество — bo'sh (umuman kerak emas)
    row.getCell(4).value = (record.surnameLat || record.surname || '').toUpperCase();
    row.getCell(5).value = (record.givenNamesLat || record.givenNames || '').toUpperCase();
    row.getCell(6).value = ''; // F: Otчество по-латински — bo'sh
    row.getCell(7).value = birthDot;
    row.getCell(8).value = record.title || (record.gender === 'M' ? 'MR' : 'MRS');
    row.getCell(9).value = (record.series || 'FA').toUpperCase();
    row.getCell(10).value = record.number || '';
    row.getCell(11).value = issueDot;
    row.getCell(12).value = expiryDot;
    row.getCell(13).value = ''; // M: Кем выдан — bo'sh (yashil belgilangan joy)
    row.getCell(14).value = nationalityStr;
    row.getCell(15).value = record.gender || (record.title === 'MRS' ? 'F' : 'M');
    row.getCell(16).value = ''; // P: ИНН — bo'sh
    row.getCell(17).value = ''; // Q: Место рождения — bo'sh (yashil belgilangan joy)
    row.getCell(18).value = countryStr;
    row.getCell(19).value = ''; // S: Телефон — bo'sh
    row.getCell(20).value = ''; // T: Мобильный — bo'sh
    row.getCell(21).value = ''; // U: Адрес — bo'sh

    for (let c = 1; c <= 21; c++) {
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

  sheet.columns = [
    { width: 18 }, // A Фамилия
    { width: 16 }, // B Имя
    { width: 12 }, // C Отчество (bo'sh)
    { width: 22 }, // D Фамилия по-латински
    { width: 20 }, // E Имя по-латински
    { width: 12 }, // F Отчество по-латински (bo'sh)
    { width: 16 }, // G Дата рождения
    { width: 10 }, // H MR/MRS
    { width: 10 }, // I Серия
    { width: 14 }, // J № паспорта
    { width: 16 }, // K Паспорт выдан
    { width: 18 }, // L Паспорт действителен до
    { width: 14 }, // M Кем выдан
    { width: 16 }, // N Гражданство
    { width: 8 },  // O Пол
    { width: 8 },  // P ИНН
    { width: 12 }, // Q Место рождения
    { width: 16 }, // R Страна рождения
    { width: 10 }, // S Телефон
    { width: 10 }, // T Мобильный
    { width: 10 }, // U Адрес
  ];

  return workbook;
}

/**
 * Creates ExcelJS Workbook for "Список на авиабилеты" (Image 8 SSH - TAS 07.11.2026.xlsx format)
 * Exact aviation manifest:
 * Row 1: Список на авиабилеты
 * Row 3: Flight Date (e.g. 07.11.2026)
 * Row 4: Рейс: 2U 5508
 * Row 5: Время вылета: 23:50
 * Row 6: Маршрут: SSH-TAS
 * Row 7 Headers:
 * A: №, B: Фамилия, имя, C: (bo'sh), D: Пол, E: Дата Рождения, F: № паспорта (FA1234567),
 * G: Класс (Y), H: Гражданство (UZB), I: Срок действия, J: Кол-во мест, K: Ребенок пасс-ра,
 * L: Услуги на рейс туда, M: Услуги на рейс обратно, N: Мобильный телефон, O: Email, P: Багаж
 * Row 8+: Records
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

  // Row 7: Table Headers
  const headerRow = sheet.getRow(7);
  headerRow.height = 24;

  const headers = [
    { col: 1, val: '№' },                       // A
    { col: 2, val: 'Фамилия, имя' },            // B
    { col: 3, val: '' },                        // C (empty spacer column)
    { col: 4, val: 'Пол' },                     // D
    { col: 5, val: 'Дата Рождения' },           // E
    { col: 6, val: '№ паспорта' },              // F (combined series + number)
    { col: 7, val: 'Класс' },                   // G (Y)
    { col: 8, val: 'Гражданство' },             // H (UZB)
    { col: 9, val: 'Срок действия' },           // I
    { col: 10, val: 'Кол-во мест' },            // J
    { col: 11, val: 'Ребенок пасс-ра' },        // K
    { col: 12, val: 'Услуги на рейс туда' },    // L
    { col: 13, val: 'Услуги на рейс обратно' }, // M
    { col: 14, val: 'Мобильный телефон' },      // N
    { col: 15, val: 'Email' },                  // O
    { col: 16, val: 'Багаж' },                  // P
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

  // Row 8+: Data rows
  records.forEach((record, idx) => {
    const rowNum = idx + 8;
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
    row.getCell(2).value = fullName;                                     // B: Фамилия, имя
    row.getCell(3).value = '';                                           // C: (bo'sh)
    row.getCell(4).value = record.title || (record.gender === 'M' ? 'MR' : 'MRS'); // D: Пол
    row.getCell(5).value = birthDot;                                     // E: Дата Рождения
    row.getCell(6).value = passportFullNumber;                           // F: № паспорта
    row.getCell(7).value = 'Y';                                          // G: Класс (Y)
    row.getCell(8).value = grazhd;                                       // H: Гражданство (UZB)
    row.getCell(9).value = expiryDot;                                    // I: Срок действия
    row.getCell(10).value = '';                                          // J: Кол-во мест
    row.getCell(11).value = '';                                          // K: Ребенок пасс-ра
    row.getCell(12).value = '';                                          // L: Услуги на рейс туда
    row.getCell(13).value = '';                                          // M: Услуги на рейс обратно
    row.getCell(14).value = '';                                          // N: Мобильный телефон
    row.getCell(15).value = '';                                          // O: Email
    row.getCell(16).value = '';                                          // P: Багаж

    for (let c = 1; c <= 16; c++) {
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

  sheet.columns = [
    { width: 5 },  // A №
    { width: 32 }, // B Фамилия, имя
    { width: 4 },  // C spacer
    { width: 8 },  // D Пол
    { width: 16 }, // E Дата Рождения
    { width: 16 }, // F № паспорта (FA1234567)
    { width: 8 },  // G Класс
    { width: 14 }, // H Гражданство
    { width: 16 }, // I Срок действия
    { width: 12 }, // J Кол-во мест
    { width: 14 }, // K Ребенок пасс-ра
    { width: 18 }, // L Услуги туда
    { width: 20 }, // M Услуги обратно
    { width: 18 }, // N Телефон
    { width: 16 }, // O Email
    { width: 10 }, // P Багаж
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
