import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMrzLines,
  parsePassportTextRegex,
  stripPatronymic,
  formatUzbekDate,
  formatDotDate,
  ensureDotDate,
  computeMrzCheckDigit,
  verifyMrzLine2,
  computeExactAgeYears,
  resolvePassengerTitle,
} from './mrzParser';
import { generatePrestigeWorkbook, generateFlyKhivaWorkbook } from './excelGenerator';
import { collectProviderKeys } from './aiProviders';
import { PassportRecord } from '../types/passport';

test('formatUzbekDate formats day, month, and year correctly', () => {
  const result = formatUzbekDate(1990, 5, 14);
  assert.equal(result, '1990-yil 14-may');
});

test('formatDotDate zero-pads day and month', () => {
  const result = formatDotDate(2023, 1, 9);
  assert.equal(result, '09.01.2023');
});

test('ensureDotDate normalizes Uzbek and ISO dates to DD.MM.YYYY', () => {
  assert.equal(ensureDotDate('1990-yil 14-may'), '14.05.1990');
  assert.equal(ensureDotDate('2023-01-09'), '09.01.2023');
  assert.equal(ensureDotDate('22.09.1961'), '22.09.1961');
});

test('stripPatronymic removes father name / patronymics and preserves given name', () => {
  assert.equal(stripPatronymic("SARDOR ALISHER O'G'LI"), 'SARDOR');
  assert.equal(stripPatronymic('MALIKA AKMAL QIZI'), 'MALIKA');
  assert.equal(stripPatronymic('ANVAR'), 'ANVAR');
});

test('computeMrzCheckDigit & verifyMrzLine2 validate real ICAO 9303 passport checksums', () => {
  // Real Uzbek passport MRZ line 2 for ABDULKHAMIDOV RAVSHAN
  const realLine2 = 'FA38322803UZB8605076M31091223070586017002786';
  assert.equal(computeMrzCheckDigit('FA3832280'), '3');
  assert.equal(computeMrzCheckDigit('860507'), '6');
  assert.equal(computeMrzCheckDigit('310912'), '2');

  const valid = verifyMrzLine2(realLine2);
  assert.deepEqual(valid, {
    numberValid: true,
    dobValid: true,
    expiryValid: true,
  });

  // Corrupted passport number character (O instead of 0, check digit still 3)
  const corruptedLine2 = 'FA383228O3UZB8605076M31091223070586017002786';
  const corrupted = verifyMrzLine2(corruptedLine2);
  assert.equal(corrupted.numberValid, false);
  assert.equal(corrupted.dobValid, true);
  assert.equal(corrupted.expiryValid, true);
});

test('parseMrzLines extracts standard ICAO 9303 TD3 Uzbek passport', () => {
  const line1 = 'P<UZBKARIMOV<<SARDOR<<<<<<<<<<<<<<<<<<<<<<<<';
  const line2 = 'FA12345678UZB9005142M3301095<<<<<<<<<<<<<<02';
  const mrz = `${line1}\n${line2}`;

  const record = parseMrzLines(mrz);
  assert.ok(record, 'PassportRecord should be non-null');
  assert.equal(record.surname, 'KARIMOV');
  assert.equal(record.givenNames, 'SARDOR');
  assert.equal(record.series, 'FA');
  assert.equal(record.number, '1234567');
  assert.equal(record.gender, 'M');
  assert.equal(record.title, 'MR');
  assert.equal(record.birthDate, '1990-yil 14-may');
  assert.equal(record.expiryDate, '09.01.2033');
  assert.equal(record.nationality, "O'zbekiston");
});

test('parseMrzLines and parsePassportTextRegex NEVER fabricate fake records on invalid input', () => {
  assert.equal(parseMrzLines(''), null);
  assert.equal(parseMrzLines('random blurry image text without passport number'), null);
  assert.equal(parsePassportTextRegex('PASSPORT REPUBLIC OF UZBEKISTAN FA 1234567'), null);
});

test('generatePrestigeWorkbook matches exact TAS SHARM format with patronymic empty', async () => {
  const sampleRecords: PassportRecord[] = [
    {
      id: 'p1',
      surname: 'KARIMOV',
      givenNames: 'SARDOR',
      surnameLat: 'KARIMOV',
      givenNamesLat: 'SARDOR',
      birthDate: '1990-yil 14-may',
      title: 'MR',
      series: 'FA',
      number: '1234567',
      issueDate: '10.01.2023',
      expiryDate: '09.01.2033',
      nationality: "O'zbekiston",
      gender: 'M',
      country: "O'zbekiston",
      parsedAt: new Date().toISOString(),
    },
  ];

  const wb = await generatePrestigeWorkbook(sampleRecords);
  const sheet = wb.getWorksheet('Лист1');
  assert.ok(sheet, 'Prestige worksheet should exist');

  // Verify headers in Row 1 (Image 6 & 7)
  assert.equal(sheet.getCell('A1').value, 'Фамилия');
  assert.equal(sheet.getCell('B1').value, 'Имя');
  assert.equal(sheet.getCell('C1').value, 'Отчество');
  assert.equal(sheet.getCell('D1').value, 'Фамилия по-латински');
  assert.equal(sheet.getCell('E1').value, 'Имя по-латински');
  assert.equal(sheet.getCell('F1').value, 'Отчество по-латински');
  assert.equal(sheet.getCell('G1').value, 'Дата рождения');
  assert.equal(sheet.getCell('H1').value, 'MR/MRS');
  assert.equal(sheet.getCell('I1').value, 'Серия');
  assert.equal(sheet.getCell('J1').value, '№ паспорта');
  assert.equal(sheet.getCell('K1').value, 'Паспорт выдан');
  assert.equal(sheet.getCell('L1').value, 'Паспорт действителен до');
  assert.equal(sheet.getCell('M1').value, 'Кем выдан паспорт');
  assert.equal(sheet.getCell('N1').value, 'Гражданство');
  assert.equal(sheet.getCell('O1').value, 'Пол');
  assert.equal(sheet.getCell('R1').value, 'Страна рождения');

  // Verify records in Row 2: Otчество is strictly empty as user commanded
  assert.equal(sheet.getCell('A2').value, 'KARIMOV');
  assert.equal(sheet.getCell('B2').value, 'SARDOR');
  assert.equal(sheet.getCell('C2').value, ''); // strictly empty
  assert.equal(sheet.getCell('D2').value, 'KARIMOV');
  assert.equal(sheet.getCell('E2').value, 'SARDOR');
  assert.equal(sheet.getCell('F2').value, ''); // strictly empty
  assert.equal(sheet.getCell('G2').value, '14.05.1990');
  assert.equal(sheet.getCell('H2').value, 'MR');
  assert.equal(sheet.getCell('I2').value, 'FA');
  assert.equal(sheet.getCell('J2').value, '1234567');
  assert.equal(sheet.getCell('K2').value, '10.01.2023');
  assert.equal(sheet.getCell('L2').value, '09.01.2033');
  assert.equal(sheet.getCell('M2').value, ''); // strictly empty
  assert.equal(sheet.getCell('N2').value, 'Узбекистан');
  assert.equal(sheet.getCell('O2').value, 'M');
  assert.equal(sheet.getCell('R2').value, 'Узбекистан');
});

test('generateFlyKhivaWorkbook matches exact "Список на авиабилеты" format (Image 8)', async () => {
  const sampleRecords: PassportRecord[] = [
    {
      id: 'p1',
      surname: 'KOSIMOV',
      givenNames: 'ANVAR',
      surnameLat: 'KOSIMOV',
      givenNamesLat: 'ANVAR',
      birthDate: '1981-yil 25-yanvar',
      title: 'MR',
      series: 'FA',
      number: '5142207',
      issueDate: '03.03.2022',
      expiryDate: '03.03.2032',
      nationality: "O'zbekiston",
      gender: 'M',
      country: "O'zbekiston",
      parsedAt: new Date().toISOString(),
    },
  ];

  const wb = await generateFlyKhivaWorkbook(sampleRecords, {
    flightDate: '07.11.2026',
    flightNumber: '2U 5508',
    departureTime: '23:50',
    route: 'SSH-TAS',
  });
  const sheet = wb.getWorksheet('Страница 1');
  assert.ok(sheet, 'Flight manifest worksheet should exist');

  // Verify flight metadata
  assert.equal(sheet.getCell('A1').value, 'Список на авиабилеты');
  assert.equal(sheet.getCell('A3').value, '07.11.2026');
  assert.equal(sheet.getCell('A4').value, 'Рейс: 2U 5508');
  assert.equal(sheet.getCell('A5').value, 'Время вылета: 23:50');
  assert.equal(sheet.getCell('A6').value, 'Маршрут: SSH-TAS');

  // Verify headers in Row 7
  assert.equal(sheet.getCell('A7').value, '№');
  assert.equal(sheet.getCell('B7').value, 'Фамилия, имя');
  assert.equal(sheet.getCell('D7').value, 'Пол');
  assert.equal(sheet.getCell('E7').value, 'Дата Рождения');
  assert.equal(sheet.getCell('F7').value, '№ паспорта');
  assert.equal(sheet.getCell('G7').value, 'Класс');
  assert.equal(sheet.getCell('H7').value, 'Гражданство');
  assert.equal(sheet.getCell('I7').value, 'Срок действия');

  // Verify record in Row 8
  assert.equal(sheet.getCell('A8').value, 1);
  assert.equal(sheet.getCell('B8').value, 'KOSIMOV ANVAR');
  assert.equal(sheet.getCell('D8').value, 'MR');
  assert.equal(sheet.getCell('E8').value, '25.01.1981');
  assert.equal(sheet.getCell('F8').value, 'FA5142207'); // concatenated series + number
  assert.equal(sheet.getCell('G8').value, 'Y');
  assert.equal(sheet.getCell('H8').value, 'UZB');
  assert.equal(sheet.getCell('I8').value, '03.03.2032');
});

test('resolvePassengerTitle strictly enforces <2 INF, 2-11 CHD, and 12+ MR/MRS boundaries', async () => {
  const ref = new Date(2026, 10, 14); // 14.11.2026

  // Real case from user screenshot: born 2025-yil 9-dekabr -> 11 months old -> INF
  assert.equal(computeExactAgeYears('2025-yil 9-dekabr', ref), 0);
  assert.equal(resolvePassengerTitle('2025-yil 9-dekabr', 'M', ref), 'INF');
  assert.equal(resolvePassengerTitle('2025-yil 9-dekabr', 'F', ref), 'INF');

  // 1 day before 2nd birthday -> still 1 year old -> INF
  assert.equal(resolvePassengerTitle('15.11.2024', 'M', ref), 'INF');
  // Exact 2nd birthday today -> CHD
  assert.equal(resolvePassengerTitle('14.11.2024', 'M', ref), 'CHD');
  assert.equal(resolvePassengerTitle('14.11.2024', 'F', ref), 'CHD');

  // 1 day before 12th birthday -> still 11 years old -> CHD
  assert.equal(resolvePassengerTitle('15.11.2014', 'F', ref), 'CHD');
  // Exact 12th birthday today -> MR (M) / MRS (F)
  assert.equal(resolvePassengerTitle('14.11.2014', 'M', ref), 'MR');
  assert.equal(resolvePassengerTitle('14.11.2014', 'F', ref), 'MRS');

  // Verify Prestige & FlyKhiva workbooks export INF and CHD dynamically
  const babyAndChild: PassportRecord[] = [
    {
      id: 'b1',
      surname: 'SUNNATILLOEV',
      givenNames: 'USMON',
      surnameLat: 'SUNNATILLOEV',
      givenNamesLat: 'USMON',
      birthDate: '2025-yil 9-dekabr',
      title: 'MR', // even if stale MR was saved previously, Excel must resolve to INF
      series: 'FB',
      number: '3031444',
      issueDate: '',
      expiryDate: '15.10.2028',
      nationality: "O'zbekiston",
      gender: 'M',
      country: "O'zbekiston",
      parsedAt: new Date().toISOString(),
    },
    {
      id: 'c1',
      surname: 'KARIMOVA',
      givenNames: 'MADINA',
      surnameLat: 'KARIMOVA',
      givenNamesLat: 'MADINA',
      birthDate: '2020-yil 10-mart',
      title: 'MRS',
      series: 'FA',
      number: '1122334',
      issueDate: '',
      expiryDate: '10.03.2027',
      nationality: "O'zbekiston",
      gender: 'F',
      country: "O'zbekiston",
      parsedAt: new Date().toISOString(),
    },
  ];

  const prestigeWb = await generatePrestigeWorkbook(babyAndChild);
  const pSheet = prestigeWb.getWorksheet('Лист1')!;
  assert.equal(pSheet.getCell('H2').value, 'INF');
  assert.equal(pSheet.getCell('O2').value, 'M');
  assert.equal(pSheet.getCell('H3').value, 'CHD');
  assert.equal(pSheet.getCell('O3').value, 'F');

  const flyWb = await generateFlyKhivaWorkbook(babyAndChild);
  const fSheet = flyWb.getWorksheet('Страница 1')!;
  assert.equal(fSheet.getCell('D8').value, 'INF');
  assert.equal(fSheet.getCell('D9').value, 'CHD');
});

test('collectProviderKeys gathers 3 keys per provider (12 total) and skips placeholders', () => {
  const mockEnv: Record<string, string | undefined> = {
    GEMINI_API_KEY: 'MY_GEMINI_API_KEY',
    GEMINI_API_KEY_1: '"AIzaSyTestKeyOne12345"',
    GEMINI_API_KEY_2: 'AIzaSyTestKeyTwo12345',
    GEMINI_API_KEY_3: 'AIzaSyTestKeyThree123',
    GROQ_API_KEY: 'gsk_test_one_123456',
    GROQ_API_KEY_2: 'gsk_test_two_123456',
    GROQ_API_KEY_3: 'gsk_test_three_123456',
    OPENROUTER_API_KEYS: 'sk-or-v1-alpha123456, sk-or-v1-beta123456, sk-or-v1-gamma123456',
    MISTRAL_API_KEY: 'mistral_key_one_1234',
    MISTRAL_API_KEY_2: 'mistral_key_two_1234',
    MISTRAL_API_KEY_3: 'mistral_key_three_1234',
  };

  const gemini = collectProviderKeys(mockEnv, 'GEMINI');
  const groq = collectProviderKeys(mockEnv, 'GROQ');
  const openrouter = collectProviderKeys(mockEnv, 'OPENROUTER');
  const mistral = collectProviderKeys(mockEnv, 'MISTRAL');

  assert.equal(gemini.length, 3);
  assert.equal(gemini[0], 'AIzaSyTestKeyOne12345');
  assert.equal(groq.length, 3);
  assert.equal(openrouter.length, 3);
  assert.equal(mistral.length, 3);
  assert.equal(gemini.length + groq.length + openrouter.length + mistral.length, 12);
});

