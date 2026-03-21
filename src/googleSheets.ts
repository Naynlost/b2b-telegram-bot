import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import * as creds from '../google-credentials.json';

const serviceAccountAuth = new JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

export const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID as string, serviceAccountAuth);

export async function testSheetConnection() {
  try {
    await doc.loadInfo(); 
    console.log(`✅ Google Sheets Bağlantısı Başarılı! Açılan Tablo: ${doc.title}`);
  } catch (error) {
    console.error("❌ Google Sheets Bağlantı Hatası:", error);
  }
}

export async function getStoreHistoryFromSheets(storeName: string) {
  try {
    await doc.loadInfo(); 
    
    const sheet = doc.sheetsByTitle['АРХІВ'];
    if (!sheet) {
      console.error("❌ 'АРХІВ' sayfası bulunamadı. Lütfen sekme adını kontrol edin.");
      return null;
    }

    const rows = await sheet.getRows();
    
    const groupedHistory: Record<string, any[]> = {};
    let foundAny = false;

    for (const row of rows) {

      const rawData = (row as any)._rawData;
      
      if (!rawData || rawData.length < 4) continue; 

      const rowStoreName = rawData[2]; 

      if (rowStoreName === storeName) {
        foundAny = true;
        const date = rawData[0];            
        const product = rawData[3];         
        const qty = rawData[4];            
        const totalAmount = rawData[11] || "0"; 
        const status = rawData[13] || "Невідомо"; 

        if (!groupedHistory[date]) {
          groupedHistory[date] = [];
        }

        groupedHistory[date].push({ product, qty, totalAmount, status });
      }
    }

    return foundAny ? groupedHistory : null;

  } catch (error) {
    console.error("❌ Google Sheets Okuma Hatası:", error);
    return null;
  }
}

export async function findStoresByPhoneNumber(telegramPhone: string) {
  try {
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle['НАЛАШТУВАННЯ'];
    if (!sheet) return null;

    const rows = await sheet.getRows();
    const normalizedTelegramPhone = telegramPhone.replace(/\D/g, '').slice(-9);

    const stores: Array<{storeName: string, address: string}> = [];

    for (const row of rows) {
      const rawData = (row as any)._rawData;
      if (!rawData || rawData.length < 10) continue;

      const storeName = rawData[6]?.trim(); 
      const address = rawData[7]?.trim();   
      const phonesCellText = rawData[9]?.trim() || ""; 

      if (!phonesCellText) continue;

      const digitBlocks = phonesCellText.match(/\d{9,12}/g) || [];
      let isMatch = false;
      for (const block of digitBlocks) {
        if (block.endsWith(normalizedTelegramPhone)) {
          isMatch = true;
          break;
        }
      }

      if (isMatch && storeName) {
        if (!stores.find(s => s.storeName === storeName)) {
          stores.push({ storeName, address });
        }
      }
    }

    return stores.length > 0 ? stores : null;

  } catch (error) {
    console.error("❌ Tablodan телефон doğrulama hatası:", error);
    return null;
  }
}