import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMrzLines, formatUzbekDate, formatDotDate, ensureDotDate } from './mrzParser';
import { generatePrestigeWorkbook, generateFlyKhivaWorkbook } from './excelGenerator';
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
